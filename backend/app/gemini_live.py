"""Gemini Live API session manager.

Uses the bidirectional streaming Live API for real-time audio conversation.
Model: gemini-2.5-flash-native-audio-preview-12-2025
Audio input: 16kHz mono PCM16 LE
Audio output: 24kHz mono PCM16 LE
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger("ekusasaizu.gemini_live")

LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025"


class GeminiLiveSession:
    """Manages a single Gemini Live API bidirectional streaming session."""

    def __init__(
        self,
        api_key: str,
        system_instruction: str,
        on_text: Callable[[str], Awaitable[None]],
        on_audio: Callable[[bytes], Awaitable[None]],
        on_error: Callable[[str], Awaitable[None]],
    ):
        self.api_key = api_key
        self.system_instruction = system_instruction
        self.on_text = on_text
        self.on_audio = on_audio
        self.on_error = on_error

        self.client = None
        self.session = None
        self._receive_task: Optional[asyncio.Task] = None
        self._live_task: Optional[asyncio.Task] = None
        self._stop_event = asyncio.Event()
        self._ready_event = asyncio.Event()
        self._failed_event = asyncio.Event()
        self._startup_error: Optional[str] = None
        self._running = False
        self._genai_types = None

    async def connect(self):
        """Establish a Gemini Live session."""
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            await self.on_error(f"google-genai not installed: {exc}")
            raise

        self._genai_types = types
        self.client = genai.Client(api_key=self.api_key)

        config = {
            "response_modalities": ["AUDIO"],
        }

        self._running = True
        self._stop_event.clear()
        self._ready_event.clear()
        self._failed_event.clear()
        self._startup_error = None

        self._live_task = asyncio.create_task(
            self._run_session(config), name="gemini-live"
        )

        # Wait for either ready or failed
        wait_ready = asyncio.create_task(self._ready_event.wait())
        wait_failed = asyncio.create_task(self._failed_event.wait())
        done, pending = await asyncio.wait(
            {wait_ready, wait_failed}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()

        if self._failed_event.is_set():
            err = self._startup_error or "unknown error"
            raise RuntimeError(f"Gemini Live connect failed: {err}")

        logger.info("Gemini Live session connected")

        # Send system instruction as initial text (not in config for native audio model)
        if self.system_instruction:
            await self.send_text(self.system_instruction)

    async def close(self):
        """Close the Gemini Live session."""
        self._running = False
        self._stop_event.set()

        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except Exception:
                pass
            self._receive_task = None

        if self._live_task:
            try:
                await self._live_task
            except Exception:
                pass
            self._live_task = None

        self.session = None
        logger.info("Gemini Live session closed")

    async def send_text(self, text: str):
        """Send a text message to Gemini."""
        if not self.session or not text.strip():
            return
        try:
            if hasattr(self.session, "send"):
                await self.session.send(input=text.strip(), end_of_turn=True)
        except Exception as exc:
            await self.on_error(f"send_text_failed: {exc}")

    async def send_audio(
        self, pcm16_bytes: bytes, mime_type: str = "audio/pcm;rate=16000"
    ):
        """Send audio chunk to Gemini Live session."""
        if not self.session or not pcm16_bytes:
            return

        # Validate: must be even length (16-bit samples)
        if len(pcm16_bytes) % 2 != 0:
            return

        try:
            types = self._genai_types
            logger.debug(
                "Sending audio chunk: %d bytes, mime=%s", len(pcm16_bytes), mime_type
            )
            if hasattr(self.session, "send_realtime_input"):
                if types and hasattr(types, "Blob"):
                    await self.session.send_realtime_input(
                        audio=types.Blob(data=pcm16_bytes, mime_type=mime_type)
                    )
                else:
                    await self.session.send_realtime_input(
                        audio={"data": pcm16_bytes, "mime_type": mime_type}
                    )
            elif hasattr(self.session, "send"):
                await self.session.send(
                    {
                        "realtime_input": {
                            "audio": {"data": pcm16_bytes, "mime_type": mime_type}
                        }
                    }
                )
        except Exception as exc:
            logger.exception("send_audio failed")
            await self.on_error(f"send_audio_failed: {exc}")

    async def send_grounding_context(self, context: dict):
        """Send workout telemetry context as grounding text."""
        if not self.session:
            return
        compact = json.dumps({"workout_update": context}, separators=(",", ":"))
        try:
            if hasattr(self.session, "send"):
                await self.session.send(input=compact, end_of_turn=False)
        except Exception as exc:
            await self.on_error(f"send_context_failed: {exc}")

    async def _run_session(self, config: Any):
        """Run the Gemini Live session lifecycle."""
        try:
            async with self.client.aio.live.connect(
                model=LIVE_MODEL, config=config
            ) as session:
                self.session = session
                self._receive_task = asyncio.create_task(
                    self._receive_loop(), name="gemini-live-receive"
                )
                self._ready_event.set()
                await self._stop_event.wait()
        except Exception as exc:
            self._startup_error = str(exc)
            self._failed_event.set()
        finally:
            if self._receive_task:
                self._receive_task.cancel()
                try:
                    await self._receive_task
                except Exception:
                    pass
                self._receive_task = None
            self.session = None

    async def _receive_loop(self):
        """Receive and dispatch responses from Gemini."""
        try:
            logger.info("Gemini receive loop started")
            async for response in self.session.receive():
                texts, audios = self._extract_response_parts(response)

                if texts:
                    logger.debug("Gemini text response: %d parts", len(texts))
                if audios:
                    logger.debug(
                        "Gemini audio response: %d parts, total bytes=%d",
                        len(audios),
                        sum(len(a) for a in audios),
                    )

                for text in texts:
                    await self.on_text(text)

                for audio in audios:
                    await self.on_audio(audio)

        except asyncio.CancelledError:
            logger.info("Gemini receive loop cancelled")
            return
        except Exception as exc:
            logger.exception("Gemini receive loop failed")
            await self.on_error(f"receive_loop_failed: {exc}")

    def _extract_response_parts(self, response: Any) -> tuple[list[str], list[bytes]]:
        """Walk the response tree to extract text and audio parts."""
        texts: list[str] = []
        audios: list[bytes] = []

        def walk(node: Any):
            if node is None or isinstance(node, (bytes, str)):
                return

            if isinstance(node, dict):
                lowered = {str(k).lower(): v for k, v in node.items()}

                if isinstance(lowered.get("text"), str) and lowered["text"].strip():
                    texts.append(lowered["text"].strip())

                if "data" in lowered and isinstance(
                    lowered["data"], (bytes, bytearray)
                ):
                    mime = str(lowered.get("mime_type", "")).lower()
                    if "audio" in mime or not mime:
                        audios.append(bytes(lowered["data"]))

                for value in node.values():
                    walk(value)
                return

            if isinstance(node, (list, tuple, set)):
                for item in node:
                    walk(item)
                return

            if hasattr(node, "__dict__"):
                walk(vars(node))
                return

            for attr in ["text", "data", "inline_data", "parts", "candidates"]:
                if hasattr(node, attr):
                    walk(getattr(node, attr))

        walk(response)
        return texts, audios
