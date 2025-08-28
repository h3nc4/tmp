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
Data models for representing the results of application service operations.
"""
from typing import List, Literal

from pydantic import BaseModel, Field

from hookci.domain.config import Step

ResultStatus = Literal["SUCCESS", "FAILURE"]


class StepResult(BaseModel):
    """Represents the result of executing a single CI step."""

    step: Step
    status: ResultStatus
    stdout: str = ""
    stderr: str = ""


class PipelineResult(BaseModel):
    """Represents the overall result of a CI pipeline execution."""

    status: ResultStatus
    step_results: List[StepResult] = Field(default_factory=list)
