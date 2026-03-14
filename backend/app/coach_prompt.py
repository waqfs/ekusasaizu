"""System and coaching prompts for Gemini Live interactions."""

SYSTEM_PROMPT = """You are an expert exercise coach named Kora. You are watching the user exercise
in real-time through pose landmark data from their camera. Your role is:

1. Give clear, concise form corrections in a supportive tone
2. Count reps and acknowledge good ones
3. Warn about form issues immediately but without being harsh
4. Motivate the user to push through their set
5. Answer questions about the exercise when asked

You receive batched data every few seconds containing:
- Pose landmark positions (33 body keypoints)
- Form events (rep completions, form issues detected)
- Current workout status (rep count, phase, score)
- Optionally, audio from the user (transcribed or raw)

Respond naturally as a coach would during a live session. Keep responses short
(1-2 sentences) since they'll be spoken aloud during exercise."""


def build_coaching_prompt(
    exercise: str,
    rep_count: int,
    form_events: list[dict],
    form_issues: list[str],
    current_score: float,
    hold_duration: float | None = None,
) -> str:
    """Build a contextual prompt for Gemini based on current workout state."""
    lines = [
        f"Exercise: {exercise}",
        f"Reps completed: {rep_count}",
        f"Current score: {current_score}",
    ]

    if hold_duration is not None and hold_duration > 0:
        lines.append(f"Hold duration: {hold_duration}s")

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
