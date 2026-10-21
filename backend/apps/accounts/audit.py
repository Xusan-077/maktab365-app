"""Qayta ishlatiladigan audit servisi: `record(actor, action, target_type, ...)`."""

from typing import Any

from apps.core.net import client_ip

from .models import AuditLog

MAX_TEXT = 200


def _short(value: Any) -> Any:
    """Jurnalga qisqa qiymatlar: uzun matn kesiladi, murakkab qiymat matnga aylanadi."""
    if value is None or isinstance(value, bool | int | float):
        return value
    if isinstance(value, dict):
        return {key: _short(item) for key, item in value.items()}
    text = str(value)
    return text if len(text) <= MAX_TEXT else text[: MAX_TEXT - 1] + "…"


def snapshot(instance, fields: tuple[str, ...]) -> dict[str, Any]:
    """Model maydonlarining qisqa nusxasi (FK uchun `<nom>_id`)."""
    data = {}
    for name in fields:
        value = getattr(instance, name)
        if hasattr(value, "pk"):
            value = value.pk
        data[name] = _short(value)
    return data


def record(
    actor,
    action: str,
    target_type: str,
    target_id: Any = "",
    *,
    label: str = "",
    before: dict | None = None,
    after: dict | None = None,
    request=None,
) -> AuditLog:
    return AuditLog.objects.create(
        actor=actor if actor and actor.is_authenticated else None,
        actor_label=(getattr(actor, "email", None) or str(getattr(actor, "pk", "")))[:254],
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        target_label=str(label)[:200],
        before=_short(before) if before is not None else None,
        after=_short(after) if after is not None else None,
        ip=client_ip(request) if request is not None else None,
    )
