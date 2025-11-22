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

from enum import Enum
from typing import Dict, List, Optional, Set

from pydantic import BaseModel, Field, model_validator

from hookci.application.constants import LATEST_CONFIG_VERSION


class LogLevel(str, Enum):
    """Enumeration for logging verbosity levels."""

    DEBUG = "DEBUG"
    INFO = "INFO"
    ERROR = "ERROR"


class Step(BaseModel):
    """Represents a single step in the CI process."""

    name: str
    command: str
    critical: bool = True
    env: Dict[str, str] = Field(default_factory=dict)
    depends_on: List[str] = Field(default_factory=list)


class Docker(BaseModel):
    """Docker configuration."""

    image: Optional[str] = None
    dockerfile: Optional[str] = None

    @model_validator(mode="after")
    def check_image_or_dockerfile(self) -> Docker:
        """Ensures that either 'image' or 'dockerfile' is provided, but not both."""
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
    log_level: LogLevel = LogLevel.INFO
    docker: Docker = Field(default_factory=default_docker_config)
    hooks: Hooks = Field(default_factory=Hooks)
    filters: Optional[Filters] = None
    steps: List[Step] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_dag(self) -> Configuration:
        """
        Validates that the steps form a Directed Acyclic Graph (DAG).
        Checks for:
        1. Dependencies pointing to non-existent steps.
        2. Self-dependencies.
        3. Circular dependencies.
        """
        step_names = {s.name for s in self.steps}
        self._validate_dependencies_exist(step_names)
        self._detect_circular_dependencies(step_names)
        return self

    def _validate_dependencies_exist(self, step_names: Set[str]) -> None:
        """Ensures all dependencies point to existing steps and are not self-referential."""
        for step in self.steps:
            for dep in step.depends_on:
                if dep not in step_names:
                    raise ValueError(
                        f"Step '{step.name}' depends on unknown step '{dep}'."
                    )
                if dep == step.name:
                    raise ValueError(f"Step '{step.name}' cannot depend on itself.")

    def _detect_circular_dependencies(self, step_names: Set[str]) -> None:
        """Runs DFS to detect cycles in the dependency graph."""
        adjacency_list: Dict[str, List[str]] = {
            s.name: s.depends_on for s in self.steps
        }
        visited: Set[str] = set()
        recursion_stack: Set[str] = set()

        def is_cyclic(node: str) -> bool:
            visited.add(node)
            recursion_stack.add(node)

            for neighbor in adjacency_list[node]:
                if neighbor not in visited:
                    if is_cyclic(neighbor):
                        return True
                elif neighbor in recursion_stack:
                    return True

            recursion_stack.remove(node)
            return False

        for name in step_names:
            if name not in visited and is_cyclic(name):
                raise ValueError("Circular dependency detected in steps.")


def create_default_config() -> Configuration:
    """
    Factory function to create a default HookCI configuration object.
    """
    return Configuration(
        version=LATEST_CONFIG_VERSION,
        log_level=LogLevel.INFO,
        docker=default_docker_config(),
        hooks=Hooks(pre_commit=True, pre_push=True),
        steps=[
            Step(name="Linting", command="echo 'Linting...'"),
            Step(name="Testing", command="echo 'Testing...'", depends_on=["Linting"]),
        ],
    )
