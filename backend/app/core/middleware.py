"""
Custom middleware:
  - Request/response logging with timing
  - Global exception handler returning consistent JSON errors
"""
import time
import traceback
import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("portal")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            elapsed = (time.perf_counter() - start) * 1000
            logger.info(f"{method} {path}  →  {response.status_code}  ({elapsed:.1f}ms)")
            return response

        except Exception as exc:
            elapsed = (time.perf_counter() - start) * 1000
            logger.error(
                f"{method} {path}  →  500  ({elapsed:.1f}ms)\n"
                + traceback.format_exc()
            )
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "error": str(exc)},
            )
