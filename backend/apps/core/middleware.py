import re
import time
import uuid

import structlog

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

logger = structlog.get_logger("request")


class RequestIdMiddleware:
    """Har so'rovga id beradi (to'g'ri `X-Request-ID` kelsa o'shani), log va javobga yozadi."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = incoming if _VALID_ID.match(incoming) else uuid.uuid4().hex
        request.request_id = request_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        started = time.perf_counter()
        response = self.get_response(request)
        elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
        response[REQUEST_ID_HEADER] = request_id
        logger.info(
            "request",
            method=request.method,
            path=request.path,
            status=response.status_code,
            duration_ms=elapsed_ms,
        )
        structlog.contextvars.clear_contextvars()
        return response
