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
from __future__ import annotations
from pydantic import BaseModel, Field, model_validator
from typing import Dict, List, Optional


class Step(BaseModel):
    """Represents a single step in the CI process."""

    name: str
    command: str
    critical: bool = True
    env: Dict[str, str] = Field(default_factory=dict)


class Docker(BaseModel):
    """Docker configuration."""

    image: Optional[str] = None
    dockerfile: Optional[str] = None

    @model_validator(mode="after")
    def check_image_or_dockerfile(self) -> Docker:
        if self.image is None and self.dockerfile is None:
            raise ValueError(
                'Either "image" or "dockerfile" must be provided in the docker configuration.'
            )
        if self.image is not None and self.dockerfile is not None:
            raise ValueError(
                'Provide either "image" or "dockerfile" in the docker configuration, not both.'
            )
        return self


class Hooks(BaseModel):
    """Git hooks configuration."""

    pre_commit: bool = True
    pre_push: bool = True


class Filters(BaseModel):
    """Filters for git events."""

    branches: Optional[str] = None
    commits: Optional[str] = None


def default_docker_config() -> Docker:
    """Provides a default Docker configuration."""
    return Docker(image="python:3.13-slim-trixie")


class Configuration(BaseModel):
    """Main configuration model for HookCI."""

    version: str
    log_level: str = "INFO"
    docker: Docker = Field(default_factory=default_docker_config)
    hooks: Hooks = Field(default_factory=Hooks)
    filters: Optional[Filters] = None
    steps: List[Step] = Field(default_factory=list)


def create_default_config() -> Configuration:
    """
    Factory function to create a default HookCI configuration object.
    """
    return Configuration(
        version="1.0",
        log_level="INFO",
        docker=default_docker_config(),
        hooks=Hooks(pre_commit=True, pre_push=True),
        steps=[
            Step(name="Linting", command="echo 'Linting...'"),
            Step(name="Testing", command="echo 'Testing...'"),
        ],
    )
