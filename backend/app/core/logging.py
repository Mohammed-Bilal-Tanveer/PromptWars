"""Logging configuration."""
import logging

from app.core.config import get_settings

LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"


def setup_logging() -> None:
    """Configure root logging from the LOG_LEVEL setting."""
    logging.basicConfig(
        level=getattr(logging, get_settings().log_level.upper(), logging.INFO),
        format=LOG_FORMAT,
    )
