# tests/presentation/test_cli.py
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
Tests for the command-line interface (presentation layer).
"""
import logging
from pathlib import Path
from typing import Generator
from unittest.mock import Mock

import pytest
from _pytest.logging import LogCaptureFixture
from typer.testing import CliRunner

from hookci.application.events import (
    LogLine,
    PipelineEnd,
    PipelineEvent,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.application.services import (
    CiExecutionService,
    ProjectInitializationService,
)
from hookci.containers import container
from hookci.domain.config import Step
from hookci.infrastructure.errors import NotInGitRepositoryError
from hookci.presentation.cli import app

runner = CliRunner()


@pytest.fixture
def mock_init_service(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Mocks the ProjectInitializationService in the container."""
    mock = Mock(spec=ProjectInitializationService)
    monkeypatch.setattr(container, "project_init_service", mock, raising=False)
    return mock


@pytest.fixture
def mock_ci_service(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Mocks the CiExecutionService in the container."""
    mock = Mock(spec=CiExecutionService)
    monkeypatch.setattr(container, "ci_execution_service", mock, raising=False)
    return mock


def test_cli_no_args_shows_help() -> None:
    """Verify that running the app with no arguments shows the help message."""
    result = runner.invoke(app, [])
    assert "Usage:" in result.stdout
    assert "HookCI: A tool for running Continuous Integration locally" in result.stdout
    assert "init" in result.stdout


def test_init_success(mock_init_service: Mock, caplog: LogCaptureFixture) -> None:
    """Test the 'init' command on a successful run."""
    config_path = Path("/path/to/repo/.hookci/hookci.yaml")
    mock_init_service.run.return_value = config_path

    with caplog.at_level(logging.INFO):
        result = runner.invoke(app, ["init"])

    assert result.exit_code == 0
    assert "Initializing HookCI..." in caplog.text
    assert "Success! HookCI has been initialized." in result.stdout
    mock_init_service.run.assert_called_once()


def test_init_not_in_git_repo(
    mock_init_service: Mock, caplog: LogCaptureFixture
) -> None:
    """Test the 'init' command when not inside a Git repository."""
    mock_init_service.run.side_effect = NotInGitRepositoryError("Not a repo")

    with caplog.at_level(logging.ERROR):
        result = runner.invoke(app, ["init"])

    assert result.exit_code == 1
    assert "Not a repo" in caplog.text


def test_run_success(mock_ci_service: Mock) -> None:
    """Test the 'run' command on a successful pipeline execution."""

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1)
        step = Step(name="Test", command="pytest")
        yield StepStart(step=step)
        yield LogLine(line="running tests...")
        yield StepEnd(step=step, status="SUCCESS", exit_code=0)
        yield PipelineEnd(status="SUCCESS")

    mock_ci_service.run.return_value = event_generator()

    result = runner.invoke(app, ["run"])

    assert result.exit_code == 0
    assert "Pipeline Finished" in result.stdout
    assert "Pipeline finished successfully!" in result.stdout
    mock_ci_service.run.assert_called_once()


def test_run_failure(mock_ci_service: Mock) -> None:
    """Test the 'run' command when the pipeline fails."""

    def event_generator() -> Generator[PipelineEvent, None, None]:
        yield PipelineStart(total_steps=1)
        step = Step(name="Test", command="pytest")
        yield StepStart(step=step)
        yield LogLine(line="test failed!")
        yield StepEnd(step=step, status="FAILURE", exit_code=1)
        yield PipelineEnd(status="FAILURE")

    mock_ci_service.run.return_value = event_generator()

    result = runner.invoke(app, ["run"])

    assert result.exit_code == 1
    assert "Pipeline Failed" in result.stdout
    assert "Pipeline failed." in result.stdout


def test_run_unexpected_error(mock_ci_service: Mock, caplog: LogCaptureFixture) -> None:
    """Test 'run' handles unexpected exceptions."""
    mock_ci_service.run.side_effect = ValueError("Kaboom")

    with caplog.at_level(logging.ERROR):
        result = runner.invoke(app, ["run"])

    assert result.exit_code == 1
    assert "An unexpected error occurred: Kaboom" in caplog.text
