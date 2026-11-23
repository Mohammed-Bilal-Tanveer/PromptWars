"""Contract error format: {"error": {"code", "message", "details"}}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("lablink.errors")


class AppError(Exception):
    status_code = 400
    code = "VALIDATION_ERROR"

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
    status_code = 400
    code = "VALIDATION_ERROR"


class NotFound(AppError):
    status_code = 404
    code = "NOT_FOUND"

    def __init__(self, message: str = "Resource not found", details: dict | None = None):
        super().__init__(message, details)


class SlotConflict(AppError):
    status_code = 409
    code = "SLOT_CONFLICT"


class InvalidState(AppError):
    status_code = 409
    code = "INVALID_STATE"


class RateLimited(AppError):
    status_code = 429
    code = "RATE_LIMITED"


def error_body(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=error_body(exc.code, exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError):
        errors = []
        for e in exc.errors():
            errors.append({"loc": [str(x) for x in e.get("loc", [])], "msg": e.get("msg", ""), "type": e.get("type", "")})
        return JSONResponse(status_code=422, content=error_body("VALIDATION_ERROR", "Request validation failed", {"errors": errors}))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException):
        code = {404: "NOT_FOUND", 429: "RATE_LIMITED"}.get(exc.status_code, "VALIDATION_ERROR" if exc.status_code < 500 else "INTERNAL_ERROR")
        return JSONResponse(status_code=exc.status_code, content=error_body(code, str(exc.detail)))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception):
        log.exception("Unhandled error", exc_info=exc)
        return JSONResponse(status_code=500, content=error_body("INTERNAL_ERROR", "Internal server error"))
