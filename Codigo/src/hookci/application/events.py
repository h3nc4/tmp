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
Event models for streaming pipeline status from the application to the presentation layer.
"""
from typing import Literal, Union

from pydantic import BaseModel

from hookci.domain.config import LogLevel, Step

EventStatus = Literal["SUCCESS", "FAILURE", "WARNING"]
LogStream = Literal["stdout", "stderr"]


class PipelineStart(BaseModel):
    """Event indicating the pipeline has started."""

    total_steps: int
    log_level: LogLevel


class ImageBuildStart(BaseModel):
    """Event indicating that a Docker image build has started."""

    dockerfile_path: str
    tag: str


class LogLine(BaseModel):
    """Event representing a single log line from a build or execution process."""

    line: str
    stream: LogStream
    step_name: str


class ImageBuildEnd(BaseModel):
    """Event indicating that the Docker image build has finished."""

    status: EventStatus


class StepStart(BaseModel):
    """Event indicating a new step is starting."""

    step: Step


class DebugShellStarting(BaseModel):
    """Event indicating a debug shell is about to be opened."""

    step: Step
    container_id: str


class StepEnd(BaseModel):
    """Event indicating a step has finished."""

    step: Step
    status: EventStatus
    exit_code: int


class PipelineEnd(BaseModel):
    """Event indicating the entire pipeline has finished."""

    status: EventStatus


# A type hint for any possible event that can be yielded by the service.
PipelineEvent = Union[
    PipelineStart,
    ImageBuildStart,
    LogLine,
    ImageBuildEnd,
    StepStart,
    DebugShellStarting,
    StepEnd,
    PipelineEnd,
]
