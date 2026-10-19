import structlog
from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = structlog.get_logger(__name__)

NON_FIELD = "non_field_errors"


def _stringify(detail):
    """ErrorDetail daraxtini oddiy `str`/`list`/`dict` ga aylantiradi."""
    if isinstance(detail, dict):
        return {key: _stringify(value) for key, value in detail.items()}
    if isinstance(detail, list | tuple):
        return [_stringify(item) for item in detail]
    return str(detail)


def _validation_details(detail) -> dict:
    detail = _stringify(detail)
    return detail if isinstance(detail, dict) else {NON_FIELD: detail}


def error_body(code: str, message: str, details: dict | None = None) -> dict:
    body = {"code": code, "message": message}
    if details:
        body["details"] = details
    return body


def api_exception_handler(exc, context):
    """Yagona xato formati: `{code, message, details?}` (tekis, o'ramsiz)."""
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    response = drf_exception_handler(exc, context)
    if response is None:
        logger.exception("unhandled_exception", view=type(context.get("view")).__name__)
        _capture(exc)
        return Response(
            error_body("server_error", "Internal server error."),
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, exceptions.ValidationError):
        response.data = error_body(
            "validation_error", "Validation failed.", _validation_details(exc.detail)
        )
    elif isinstance(exc, exceptions.APIException):
        response.data = error_body(exc.default_code, str(exc.detail))
    return response


def _capture(exc) -> None:
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    except Exception:  # noqa: BLE001, S110 — monitoring xatosi so'rovni buzmasligi kerak
        pass
