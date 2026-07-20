"""
Simulated AI logic for the tax platform.

Nothing here calls a real model. Confidence scores and explanations are
generated from simple, deterministic rules based on a field's shape
(category, whether a calculation was applied, whether it's tied to a source
document) so the same field always produces the same "AI" output, and the
story stays consistent between the seeded data and the explain endpoint.
"""

import random

# Seeded once at import time: stable across runs, but still varies field to
# field instead of using flat round numbers everywhere.
_rng = random.Random(42)


def generate_field_ai_data(label, category, has_source_doc, has_transform, force_state=None):
    """
    Decide the (state, confidence, reason) for a field while it's being
    built in seed.py, before it's saved to the database.
    """
    if force_state == "editable":
        return "editable", None, None

    if force_state == "locked":
        return "locked", 1.0, "Reviewed and locked by preparer; no longer AI-controlled."

    if force_state == "verified":
        # no confidence score once a human has signed off — showing "94%"
        # on something already verified would undercut the verification.
        return "verified", None, "Reviewed and approved by preparer."

    if not has_source_doc:
        # entered directly (e.g. a questionnaire answer) — no extraction involved
        return "editable", None, None

    if has_transform:
        score = round(_rng.uniform(0.80, 0.92), 2)
        reason = f"Derived by applying a calculation to one or more source values for {label}."
        return "ai_generated", score, reason

    score = round(_rng.uniform(0.90, 0.99), 2)
    reason = f"Extracted directly from the source document for {label}."
    return "ai_generated", score, reason


def force_low_confidence(label):
    """Used for a small number of deliberately flagged demo fields."""
    score = round(_rng.uniform(0.45, 0.65), 2)
    reason = (
        f"Source document for {label} was low quality (handwritten or "
        "partially obscured); extraction may be inaccurate."
    )
    return "ai_generated", score, reason


def explain(field):
    """
    Build the full explanation payload for one field, used by the
    Challenge 10 "why" popover. `field` is a live Field model instance,
    so its relationships (source_document) are available.
    """
    if field.state == "editable":
        return {
            "summary": "This value was entered directly and was never touched by AI.",
            "evidence": [],
            "uncertainty": None,
            "recommended_action": None,
        }

    if field.state == "locked":
        return {
            "summary": "This value has been manually reviewed and locked by a preparer.",
            "evidence": [{"type": "review", "detail": "Verified during preparer review."}],
            "uncertainty": None,
            "recommended_action": None,
        }

    doc = field.source_document
    evidence = []
    if doc:
        evidence.append({
            "type": "document",
            "detail": f"{doc.name}, page {field.source_page}",
            "region": field.source_region,
        })
    if field.transform:
        evidence.append({"type": "calculation", "detail": field.transform})

    if field.confidence is not None and field.confidence < 0.7:
        uncertainty = "Low confidence — source document was hard to read clearly. Recommend manual verification."
        action = "verify"
    elif field.confidence is not None and field.confidence < 0.9:
        uncertainty = "Moderate confidence — a calculation was applied on top of extracted values."
        action = "spot_check"
    else:
        uncertainty = None
        action = "none"

    return {
        "summary": f"AI extracted this value with {int((field.confidence or 0) * 100)}% confidence.",
        "evidence": evidence,
        "uncertainty": uncertainty,
        "recommended_action": action,
    }


def suggest_correction(field):
    """
    Returns a fabricated alternate reading for deliberately low-confidence
    fields, to power the 'correct the AI' interaction. Returns None for
    fields that don't have a plausible alternate reading.
    """
    if field.confidence is None or field.confidence >= 0.7:
        return None

    try:
        current = float(str(field.value).replace(",", "").replace("$", ""))
    except (TypeError, ValueError):
        return None

    alt_value = round(current * 1.1, 2)  # a plausible nearby misread
    return {
        "suggested_value": f"{alt_value:,.2f}",
        "rationale": (
            "A cleaner scan of the same region suggests a slightly different "
            "digit sequence. Confirm against the original document before accepting."
        ),
    }
