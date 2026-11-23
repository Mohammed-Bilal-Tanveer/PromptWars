"""Contract error format: {"error": {"code", "message", "details"}}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("lablink.errors")


class AppError(Exception):
    """Base domain error rendered as the contract error envelope."""

    status_code: int = 400
    code: str = "VALIDATION_ERROR"

    def __init__(self, message: str, details: dict | None = None, status_code: int | None = None,
                 code: str | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code


class ValidationFailed(AppError):
    """Request is well-formed but violates a business rule (400)."""

    status_code = 400
    code = "VALIDATION_ERROR"


class NotFound(AppError):
    """Requested resource does not exist (404)."""

    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, message: str = "Resource not found", details: dict | None = None):
        super().__init__(message, details)


class SlotConflict(AppError):
    """Requested slot overlaps an existing booking or maintenance window (409)."""

    status_code = 409
    code = "SLOT_CONFLICT"


class InvalidState(AppError):
    """Operation not allowed in the resource's current state (409)."""

    status_code = 409
    code = "INVALID_STATE"


class RateLimited(AppError):
    """Client exceeded a rate limit (429)."""

    status_code = 429
    code = "RATE_LIMITED"


def error_body(code: str, message: str, details: dict | None = None) -> dict:
    """Build the contract error envelope."""
    return {"error": {"code": code, "message": message, "details": details or {}}}


_HTTP_CODE_BY_STATUS = {404: "NOT_FOUND", 429: "RATE_LIMITED"}
HTTP_SERVER_ERROR_MIN = 500


def register_exception_handlers(app: FastAPI) -> None:
    """Map domain, validation, HTTP and unhandled errors to the contract envelope."""

    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"loc": [str(x) for x in e.get("loc", [])], "msg": e.get("msg", ""), "type": e.get("type", "")}
                  for e in exc.errors()]
        return JSONResponse(status_code=422, content=error_body("VALIDATION_ERROR", "Request validation failed", {"errors": errors}))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        fallback = "VALIDATION_ERROR" if exc.status_code < HTTP_SERVER_ERROR_MIN else "INTERNAL_ERROR"
        code = _HTTP_CODE_BY_STATUS.get(exc.status_code, fallback)
        return JSONResponse(status_code=exc.status_code, content=error_body(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(status_code=500, content=error_body("INTERNAL_ERROR", "Internal server error"))
