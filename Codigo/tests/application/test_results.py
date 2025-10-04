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
Tests for the application result data models.
"""

from hookci.application.results import PipelineResult, StepResult
from hookci.domain.config import Step


def test_step_result_creation() -> None:
    """
    Verify that the StepResult model can be instantiated correctly.
    """
    step = Step(name="Test", command="pytest")
    result = StepResult(
        step=step, status="SUCCESS", stdout="All tests passed", stderr=""
    )
    assert result.step.name == "Test"
    assert result.status == "SUCCESS"
    assert result.stdout == "All tests passed"
    assert result.stderr == ""


def test_pipeline_result_creation() -> None:
    """
    Verify that the PipelineResult model can be instantiated correctly.
    """
    step = Step(name="Test", command="pytest")
    step_result = StepResult(step=step, status="FAILURE")
    pipeline_result = PipelineResult(status="FAILURE", step_results=[step_result])

    assert pipeline_result.status == "FAILURE"
    assert len(pipeline_result.step_results) == 1
    assert pipeline_result.step_results[0].status == "FAILURE"
