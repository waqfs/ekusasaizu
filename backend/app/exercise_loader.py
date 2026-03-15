"""Exercise configuration loader — reads JSON configs from the exercises/ directory."""

import json
import logging
from pathlib import Path

logger = logging.getLogger("ekusasaizu.exercises")

_EXERCISES_DIR = Path(__file__).parent / "exercises"
_cache: dict[str, dict] = {}


def _load_all() -> dict[str, dict]:
    """Load all exercise configs from JSON files."""
    if _cache:
        return _cache

    if not _EXERCISES_DIR.exists():
        logger.warning("Exercises directory not found: %s", _EXERCISES_DIR)
        return _cache

    for path in sorted(_EXERCISES_DIR.glob("*.json")):
        try:
            with open(path, encoding="utf-8") as f:
                config = json.load(f)
            exercise_id = config.get("id", path.stem)
            _cache[exercise_id] = config
            logger.info("Loaded exercise config: %s (%s)", exercise_id, path.name)
        except (json.JSONDecodeError, KeyError) as e:
            logger.error("Failed to load exercise config %s: %s", path.name, e)

    return _cache


def list_exercises() -> list[dict]:
    """Return a summary list of all available exercises."""
    configs = _load_all()
    return [
        {
            "id": cfg["id"],
            "name": cfg["name"],
            "type": cfg["type"],
            "description": cfg["description"],
            "camera_angle": cfg.get("camera_angle", "front"),
        }
        for cfg in configs.values()
    ]


def get_exercise_config(exercise_id: str) -> dict | None:
    """Return the full MediaPipe configuration for an exercise."""
    configs = _load_all()
    return configs.get(exercise_id)


def reload_exercises() -> None:
    """Force reload all exercise configs from disk."""
    _cache.clear()
    _load_all()
