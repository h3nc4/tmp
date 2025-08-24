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
from unittest.mock import patch

from typer.testing import CliRunner

from hookci.application.errors import ProjectAlreadyInitializedError
from hookci.infrastructure.errors import NotInGitRepositoryError
from hookci.presentation.cli import app

runner = CliRunner()


def test_cli_no_args_shows_help() -> None:
    """Verify that running the app with no arguments shows the help message."""
    result = runner.invoke(app)
    assert result.exit_code == 2
    assert "Usage: " in result.stdout
    assert "HookCI: A tool for running Continuous Integration locally" in result.stdout
    assert "init" in result.stdout


def test_cli_help_command() -> None:
    """Verify that the 'help' command shows the help message."""
    result = runner.invoke(app, ["help"])
    assert result.exit_code == 0
    assert "Usage: " in result.stdout
    assert "init" in result.stdout


@patch("hookci.presentation.cli.ProjectInitializationService")
def test_init_success(mock_init_service_cls: "patch") -> None:
    """Test the 'init' command on a successful run."""
    # Arrange
    mock_service_instance = mock_init_service_cls.return_value
    mock_service_instance.run.return_value = Path("/path/to/repo/hookci.yaml")

    # Act
    result = runner.invoke(app, ["init"])

    # Assert
    assert result.exit_code == 0
    assert "🚀 Initializing HookCI..." in result.stdout
    assert "✅ Success!" in result.stdout
    assert "Configuration file created at: /path/to/repo/hookci.yaml" in result.stdout
    mock_service_instance.run.assert_called_once()


@patch("hookci.presentation.cli.ProjectInitializationService")
def test_init_already_initialized(mock_init_service_cls: "patch") -> None:
    """Test the 'init' command when the project is already initialized."""
    # Arrange
    mock_service_instance = mock_init_service_cls.return_value
    mock_service_instance.run.side_effect = ProjectAlreadyInitializedError(
        "Project already initialized."
    )

    # Act
    result = runner.invoke(app, ["init"])

    # Assert
    assert result.exit_code == 0  # Should exit gracefully
    assert "👋 Notice: Project already initialized." in result.stdout


@patch("hookci.presentation.cli.ProjectInitializationService")
def test_init_not_in_git_repo(mock_init_service_cls: "patch") -> None:
    """Test the 'init' command when not inside a Git repository."""
    # Arrange
    mock_service_instance = mock_init_service_cls.return_value
    mock_service_instance.run.side_effect = NotInGitRepositoryError

    # Act
    result = runner.invoke(app, ["init"])

    # Assert
    assert result.exit_code == 1
    assert "❌ Error: This is not a Git repository." in result.stdout


@patch("hookci.presentation.cli.ProjectInitializationService")
def test_init_unexpected_error(mock_init_service_cls: "patch") -> None:
    """Test the 'init' command handles unexpected exceptions."""
    # Arrange
    mock_service_instance = mock_init_service_cls.return_value
    mock_service_instance.run.side_effect = ValueError("Something broke")

    # Act
    result = runner.invoke(app, ["init"])

    # Assert
    assert result.exit_code == 1
    assert "🔥 An unexpected error occurred: Something broke" in result.stdout
