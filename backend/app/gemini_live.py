"""Gemini Live API session manager.

Uses the bidirectional streaming Live API for real-time audio conversation.
Based on the official Google example.

Model: gemini-2.5-flash-native-audio-preview-12-2025
Audio input: 16kHz mono PCM16 LE
Audio output: 24kHz mono PCM16 LE
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger("ekusasaizu.gemini_live")

LIVE_MODEL = "models/gemini-2.5-flash-native-audio-preview-12-2025"


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

    async def connect(self):
        """Establish a Gemini Live session."""
        try:
            from google import genai
            from google.genai import types
        except ImportError as exc:
            await self.on_error(f"google-genai not installed: {exc}")
            raise

        self.client = genai.Client(
            api_key=self.api_key,
            http_options={"api_version": "v1beta"},
        )

        config = types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=self.system_instruction,
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Kore")
                )
            ),
        )

        self._running = True
        self._stop_event.clear()
        self._ready_event.clear()
        self._failed_event.clear()
        self._startup_error = None

        self._live_task = asyncio.create_task(
            self._run_session(config), name="gemini-live"
        )

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
            await self.session.send(input=text.strip(), end_of_turn=True)
        except Exception as exc:
            await self.on_error(f"send_text_failed: {exc}")

    async def send_audio(self, pcm16_bytes: bytes):
        """Send audio chunk to Gemini using send_realtime_input."""
        if not self.session or not pcm16_bytes:
            return
        if len(pcm16_bytes) % 2 != 0:
            return
        try:
            from google.genai import types

            await self.session.send_realtime_input(
                audio=types.Blob(
                    data=pcm16_bytes,
                    mime_type="audio/pcm;rate=16000",
                )
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
        """Receive and dispatch responses from Gemini.

        session.receive() returns a turn iterator. We loop to handle
        multiple turns — after each turn completes, we restart.
        """
        try:
            logger.info("Gemini receive loop started")
            while self._running and self.session:
                turn = self.session.receive()
                async for response in turn:
                    if data := response.data:
                        await self.on_audio(data)
                    elif text := response.text:
                        await self.on_text(text)
                logger.debug("Turn complete, waiting for next turn...")
            logger.info("Gemini receive loop exiting")
        except asyncio.CancelledError:
            logger.info("Gemini receive loop cancelled")
            return
        except Exception as exc:
            logger.exception("Gemini receive loop failed")
            await self.on_error(f"receive_loop_failed: {exc}")
