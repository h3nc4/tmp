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
from pathlib import Path
from unittest.mock import Mock

import pytest
from typer.testing import CliRunner

from hookci.application.services import (
    CiExecutionService,
    ProjectInitializationService,
)
from hookci.containers import container
from hookci.infrastructure.errors import NotInGitRepositoryError
from hookci.presentation.cli import app

runner = CliRunner()


@pytest.fixture
def mock_init_service(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Mocks the ProjectInitializationService in the container."""
    mock = Mock(spec=ProjectInitializationService)
    monkeypatch.setattr(container, "_instances", {"project_init_service": mock})
    return mock


@pytest.fixture
def mock_ci_service(monkeypatch: pytest.MonkeyPatch) -> Mock:
    """Mocks the CiExecutionService in the container."""
    mock = Mock(spec=CiExecutionService)
    monkeypatch.setattr(container, "_instances", {"ci_execution_service": mock})
    return mock


def test_cli_no_args_shows_help() -> None:
    """Verify that running the app with no arguments shows the help message."""
    result = runner.invoke(app, [])
    assert "Usage:" in result.stdout
    assert "HookCI: A tool for running Continuous Integration locally" in result.stdout
    assert "init" in result.stdout


def test_init_success(mock_init_service: Mock) -> None:
    """Test the 'init' command on a successful run."""
    config_path = Path("/path/to/repo/.hookci/hookci.yaml")
    mock_init_service.run.return_value = config_path

    result = runner.invoke(app, ["init"])

    assert result.exit_code == 0
    assert "🚀 Initializing HookCI..." in result.stdout
    assert "✅ Success! HookCI has been initialized." in result.stdout
    assert f"Configuration file created at: {config_path}" in result.stdout
    mock_init_service.run.assert_called_once()


def test_init_not_in_git_repo(mock_init_service: Mock) -> None:
    """Test the 'init' command when not inside a Git repository."""
    mock_init_service.run.side_effect = NotInGitRepositoryError("Not a repo")

    result = runner.invoke(app, ["init"])

    assert result.exit_code == 1
    assert "❌ Error: Not a repo" in result.stdout


def test_run_success(mock_ci_service: Mock) -> None:
    """Test the 'run' command on a successful pipeline execution."""
    mock_ci_service.run.return_value = True

    result = runner.invoke(app, ["run"])

    assert result.exit_code == 0
    assert "🏃 Running HookCI pipeline..." in result.stdout
    assert "✅ Pipeline finished successfully!" in result.stdout
    mock_ci_service.run.assert_called_once()


def test_run_failure(mock_ci_service: Mock) -> None:
    """Test the 'run' command when the pipeline fails."""
    mock_ci_service.run.return_value = False

    result = runner.invoke(app, ["run"])

    assert result.exit_code == 1
    assert "❌ Pipeline failed." in result.stdout


def test_run_unexpected_error(mock_ci_service: Mock) -> None:
    """Test 'run' handles unexpected exceptions."""
    mock_ci_service.run.side_effect = ValueError("Kaboom")

    result = runner.invoke(app, ["run"])

    assert result.exit_code == 1
    assert "🔥 An unexpected error occurred: Kaboom" in result.stdout
