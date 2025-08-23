#!/usr/bin/env python3
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

"""
Domain models for HookCI configuration.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Step:
    """Represents a single step in the CI process."""

    name: str
    command: str
    critical: bool = True
    env: Dict[str, str] = field(default_factory=dict)


@dataclass
class Docker:
    """Docker configuration."""

    image: Optional[str] = None
    dockerfile: Optional[str] = "Dockerfile"


@dataclass
class Hooks:
    """Git hooks configuration."""

    pre_commit: bool = True
    pre_push: bool = True


@dataclass
class Filters:
    """Filters for git events."""

    branches: Optional[str] = None
    commits: Optional[str] = None


@dataclass
class Configuration:
    """Main configuration model for HookCI."""

    version: str
    log_level: str = "INFO"
    docker: Docker = field(default_factory=Docker)
    hooks: Hooks = field(default_factory=Hooks)
    filters: Optional[Filters] = None
    steps: List[Step] = field(default_factory=list)


def create_default_config() -> Configuration:
    """
    Factory function to create a default HookCI configuration object.
    """
    return Configuration(
        version="1.0",
        log_level="INFO",
        docker=Docker(image="python:3.11-slim-bookworm"),
        hooks=Hooks(pre_commit=True, pre_push=True),
        steps=[
            Step(name="Linting", command="echo 'Linting...'"),
            Step(name="Testing", command="echo 'Testing...'"),
        ],
    )
