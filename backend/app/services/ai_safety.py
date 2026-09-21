"""Safety validation layer for AI-generated wellness content.

Applied to every response before it reaches the user, regardless of which
provider (mock or LLM) produced it. This is a defense-in-depth check —
providers are also instructed not to produce unsafe content — not the only
line of defense.

Blocks:
  - Diagnostic language ("you have diabetes", "this is a symptom of...")
  - Claims that a food cures/treats a disease
  - Dangerously restrictive calorie/diet prescriptions
  - Language presenting the output as a substitute for professional care

Never silently drops content it flags — instead returns a safe, clearly
labelled fallback message so the user always gets *something* useful and
knows why a claim was withheld.
"""

import re

STANDARD_DISCLAIMER = (
    "This is a general wellness observation based on your logged data, not medical advice. "
    "If you have health concerns, please consult a qualified healthcare professional."
)

# Patterns indicating a diagnostic or disease-attribution claim.
_DIAGNOSIS_PATTERNS = [
    r"\byou (have|might have|likely have|probably have)\b.{0,40}\b(diabetes|cancer|hypertension|disease|disorder|syndrome|deficiency)\b",
    r"\bthis (is|could be|indicates?) a symptom of\b",
    r"\byou (are|might be) (diabetic|anemic|hypertensive)\b",
    r"\bdiagnos(e|is|ed|ing)\b",
]

# Patterns claiming a food cures/treats/prevents disease.
_CURE_CLAIM_PATTERNS = [
    r"\b(cures?|treats?|heals?|prevents?)\b.{0,30}\b(diabetes|cancer|disease|illness|condition)\b",
]

# Patterns prescribing dangerously low calorie targets or extreme restriction.
_DANGEROUS_PRESCRIPTION_PATTERNS = [
    r"\beat (only|just)\b.{0,30}\b(calories|kcal)\b",
    r"\b(under|below|less than)\s*(800|900|1000)\s*(calories|kcal)\b",
    r"\byou (must|should) (stop eating|fast for|not eat)\b",
]

# Patterns claiming the AI replaces professional medical advice.
_REPLACES_DOCTOR_PATTERNS = [
    r"\byou (don't|do not) need (a doctor|to see a doctor|medical care)\b",
    r"\binstead of (seeing|consulting) a doctor\b",
]

_ALL_BLOCKED_PATTERNS = (
    _DIAGNOSIS_PATTERNS + _CURE_CLAIM_PATTERNS + _DANGEROUS_PRESCRIPTION_PATTERNS + _REPLACES_DOCTOR_PATTERNS
)

_COMPILED_PATTERNS = [re.compile(p, flags=re.IGNORECASE) for p in _ALL_BLOCKED_PATTERNS]

SAFE_FALLBACK_MESSAGE = (
    "I wasn't able to generate a safe response for that. I can share general observations about your "
    "logged activity and hydration, but I can't provide medical diagnoses, disease-related "
    "claims, or prescriptive restrictions. " + STANDARD_DISCLAIMER
)


def is_content_safe(text: str) -> bool:
    return not any(pattern.search(text) for pattern in _COMPILED_PATTERNS)


def sanitize_response(text: str) -> str:
    """Validate `text` and return it unchanged if safe, or a safe fallback
    message if it trips any blocked pattern. Always appends the standard
    disclaimer if the text doesn't already carry one, so no path out of
    this module produces medical-advice-shaped content without a caveat.
    """
    if not is_content_safe(text):
        return SAFE_FALLBACK_MESSAGE

    if STANDARD_DISCLAIMER not in text:
        return f"{text.strip()}\n\n{STANDARD_DISCLAIMER}"
    return text
