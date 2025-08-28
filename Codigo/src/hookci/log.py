# Copyright (C) 2025 PUC Minas, Henrique Almeida, Gabriel Dolabela
# This file is part of HookCI.

# HookCI is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.

# HookCI is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.

# You should have received a copy of the GNU Affero General Public License
# along with HookCI.  If not, see <https://www.gnu.org/licenses/>.

"""Centralized logging configuration for the application."""

import logging
from rich.logging import RichHandler


def setup_logging(level: str = "INFO") -> None:
    """
    Configures the root logger to use RichHandler for beautiful output.
    """
    log_level = getattr(logging, level.upper(), logging.INFO)
    handler = RichHandler(
        rich_tracebacks=True,
        show_path=False,
        log_time_format="[%X]",
        markup=True,
    )

    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        handlers=[handler],
    )


def get_logger(name: str) -> logging.Logger:
    """
    Returns a logger instance for the given name.
    """
    return logging.getLogger(name)
