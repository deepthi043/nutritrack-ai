"""AI provider abstraction.

    AIService
       │
       ├── LLMProvider   -> external AI API (requires AI_API_KEY)
       │
       └── MockAIProvider -> deterministic, rule-based text generated
                              entirely from the structured context dict —
                              no external calls, always available.

Every provider receives only the structured context dicts produced by
app/services/ai_context_builder.py — never a database session, never raw
SQL access. This keeps the AI layer swappable (a different vendor, or a
completely different model) without touching how user data is gathered.

`get_ai_provider()` is the single factory used by AIService: it honors
`settings.ai_provider`, but always falls back to MockAIProvider if "llm" is
selected without an API key configured, so the app never breaks due to
missing AI configuration.
"""

from abc import ABC, abstractmethod

from app.core.config import settings


class AIProvider(ABC):
    """Interface every AI backend must implement."""

    @abstractmethod
    def get_source_name(self) -> str:
        """Short identifier stored alongside generated insights ("mock"/"llm")."""
        raise NotImplementedError

    @abstractmethod
    def generate_daily_insight(self, context: dict) -> str:
        raise NotImplementedError

    @abstractmethod
    def generate_weekly_insight(self, context: dict) -> str:
        raise NotImplementedError

    @abstractmethod
    def answer_question(self, question: str, context: dict) -> str:
        raise NotImplementedError


class MockAIProvider(AIProvider):
    """Deterministic, rule-based provider for development and offline use.

    Produces genuinely useful, data-grounded text — not a placeholder — by
    applying straightforward rules to the real structured context. This is
    the default provider so the app is fully functional with zero external
    configuration.
    """

    def get_source_name(self) -> str:
        return "mock"

    def generate_daily_insight(self, context: dict) -> str:
        lines = []

        steps = context["steps"]
        step_goal = context["step_goal"]
        if steps > 0:
            pct = round((steps / step_goal) * 100) if step_goal else 0
            lines.append(
                f"You've logged {steps:,} steps today ({pct}% of your {step_goal:,}-step goal) "
                f"and {context['active_minutes']} active minutes."
            )
        else:
            lines.append("No activity has been logged yet today — even a short walk would get you started.")

        water_l = context["water_liters"]
        water_goal_l = context["water_goal_liters"]
        if water_l > 0:
            lines.append(f"Hydration is at {water_l}L of your {water_goal_l}L goal.")
        else:
            lines.append("No water has been logged yet today.")

        return " ".join(lines)

    def generate_weekly_insight(self, context: dict) -> str:
        activity = context["activity"]
        water = context["water"]
        consistency = context["consistency"]

        lines = []

        if activity["total_weekly_steps"] > 0:
            lines.append(
                f"This week you averaged {activity['average_daily_steps']:,.0f} steps per day "
                f"({activity['total_weekly_steps']:,} total), reaching {activity['goal_completion_percent']}% "
                f"of your step goal on average."
            )
            if activity.get("best_day_steps"):
                lines.append(f"Your most active day had {activity['best_day_steps']:,} steps.")
        else:
            lines.append("No activity was recorded this week.")

        if water["average_daily_ml"] > 0:
            lines.append(
                f"Average daily water intake was {water['average_daily_ml'] / 1000:.1f}L, reaching your goal on "
                f"{water['days_goal_reached']} of the last 7 days."
            )
        else:
            lines.append("No water was logged this week.")

        lines.append(
            f"Your overall weekly consistency score is {consistency['score_percent']}%, based on the average of "
            f"your activity and hydration completion rates."
        )

        return " ".join(lines)

    def answer_question(self, question: str, context: dict) -> str:
        q = question.lower()
        today = context["today"]
        week = context["week"]

        if "water" in q or "hydrat" in q:
            return (
                f"Today you've logged {today['water_liters']}L of water, out of a {today['water_goal_liters']}L goal. "
                f"This week your average daily intake was {week['water']['average_daily_ml'] / 1000:.1f}L."
            )

        if "step" in q or "walk" in q:
            if "week" in q:
                return (
                    f"This week you averaged {week['activity']['average_daily_steps']:,.0f} steps per day, "
                    f"totaling {week['activity']['total_weekly_steps']:,} steps."
                )
            return f"You've logged {today['steps']:,} steps today, out of your {today['step_goal']:,}-step goal."

        if "summar" in q or "week" in q:
            return self.generate_weekly_insight(week)

        if "trend" in q or "consisten" in q:
            return (
                f"Your weekly consistency score is {week['consistency']['score_percent']}%, calculated as the "
                f"average of your activity goal completion ({week['consistency']['components']['activity']}%) and "
                f"water goal completion ({week['consistency']['components']['water']}%)."
            )

        return (
            "I can answer questions about your logged steps, water, and weekly trends. "
            "Try asking something like \"How much water did I drink today?\" or \"Summarize my week.\""
        )


class LLMProvider(AIProvider):
    """External LLM-backed provider.

    Not connected to a live vendor in this build — get_ai_provider() only
    constructs this when both AI_PROVIDER=llm and AI_API_KEY are set, and
    even then, calling it without wiring in a real HTTP client will raise
    NotImplementedError. This class exists to define the extension point:
    a future implementation would send `context` (never raw DB access) to
    an external API and return its text response for the same safety layer
    to validate.
    """

    def __init__(self, api_key: str, model: str):
        self.api_key = api_key
        self.model = model

    def get_source_name(self) -> str:
        return "llm"

    def generate_daily_insight(self, context: dict) -> str:
        raise NotImplementedError("LLMProvider is not connected to a live vendor in this build.")

    def generate_weekly_insight(self, context: dict) -> str:
        raise NotImplementedError("LLMProvider is not connected to a live vendor in this build.")

    def answer_question(self, question: str, context: dict) -> str:
        raise NotImplementedError("LLMProvider is not connected to a live vendor in this build.")


def get_ai_provider() -> AIProvider:
    """Factory honoring AI_PROVIDER, with automatic safe fallback to mock."""
    if settings.ai_provider == "llm" and settings.ai_api_key:
        return LLMProvider(api_key=settings.ai_api_key, model=settings.ai_model)
    return MockAIProvider()
