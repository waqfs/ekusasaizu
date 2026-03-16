"""System and coaching prompts for Gemini Live interactions."""

from .exercise_loader import list_exercises


def _build_exercise_catalog() -> str:
    """Build a text list of available exercises for the system prompt."""
    exercises = list_exercises()
    if not exercises:
        return "No exercises currently loaded."
    lines = []
    for ex in exercises:
        lines.append(f"- {ex['id']}: {ex['name']} ({ex['type']}) — {ex['description']}")
    return "\n".join(lines)


def get_system_prompt() -> str:
    """Build the system prompt with current exercise catalog."""
    catalog = _build_exercise_catalog()
    return f"""You are an expert exercise coach named Kora. You guide users through workouts
using real-time pose tracking from their camera. You are warm, supportive, and knowledgeable.

Your capabilities:
1. Recommend exercises from the available catalog based on user goals or conditions
2. Switch exercises using the set_exercise tool when the user is ready
3. Give clear, concise form corrections during exercise
4. Count reps and acknowledge good ones
5. Motivate the user throughout their workout
6. Answer questions about exercises, form, physical therapy, etc.

Available exercises:
{catalog}

IMPORTANT — Switching exercises:
When the user wants to start or change an exercise, use the set_exercise tool with the
exercise_id from the catalog above. For example, if the user says "let's do squats",
call set_exercise with exercise_id="squat". The client will automatically switch to
tracking that exercise in real-time.

During exercise, you receive batched pose data every few seconds containing:
- Current exercise, rep count, score, phase
- Joint angle values
- Form events (rep completions, form issues)

Keep coaching responses short (1-2 sentences) during active exercise.
For conversation outside of exercise, be friendly and helpful — you can be a bit more verbose."""


def build_coaching_prompt(
    exercise: str,
    rep_count: int,
    form_events: list[dict],
    form_issues: list[str],
    current_score: float,
    hold_duration: float | None = None,
    angle_values: dict[str, float] | None = None,
) -> str:
    """Build a contextual prompt for Gemini based on current workout state."""
    lines = [
        "[WORKOUT DATA UPDATE]",
        f"Exercise: {exercise}",
        f"Reps completed: {rep_count}",
        f"Current score: {current_score}",
    ]

    if hold_duration is not None and hold_duration > 0:
        lines.append(f"Hold duration: {hold_duration}s")

    if angle_values:
        angle_strs = [f"  {name}: {val:.0f}°" for name, val in angle_values.items()]
        lines.append("Current joint angles:\n" + "\n".join(angle_strs))

    if form_events:
        event_strs = [
            f"- {e['type']}" + (f" (score: {e.get('score')})" if e.get("score") else "")
            for e in form_events
        ]
        lines.append("Recent form events:\n" + "\n".join(event_strs))

    if form_issues:
        lines.append(
            "Current form issues:\n" + "\n".join(f"- {i}" for i in form_issues)
        )
    else:
        lines.append("Form looks good — no issues detected.")

    lines.append(
        "\nBased on this data, give a short coaching response (1-2 sentences)."
    )

    return "\n".join(lines)
