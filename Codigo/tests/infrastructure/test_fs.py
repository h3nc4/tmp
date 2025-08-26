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
Tests for filesystem and Git-related infrastructure services.
"""
import os
import stat
import subprocess
from pathlib import Path
from unittest.mock import Mock, patch

import pytest

from hookci.infrastructure.errors import GitCommandError, NotInGitRepositoryError
from hookci.infrastructure.fs import GitService, LocalFileSystem


def test_local_fs_create_and_write(tmp_path: Path) -> None:
    """Verify LocalFileSystem can create directories and write files."""
    fs = LocalFileSystem()
    dir_path = tmp_path / "testdir"
    file_path = dir_path / "test.txt"
    content = "hello world"

    fs.create_dir(dir_path)
    fs.write_file(file_path, content)

    assert dir_path.is_dir()
    assert file_path.read_text() == content


def test_local_fs_read_file(tmp_path: Path) -> None:
    """Verify LocalFileSystem can read a file's content."""
    fs = LocalFileSystem()
    file_path = tmp_path / "read_test.txt"
    content = "line 1\nline 2"
    file_path.write_text(content)

    read_content = fs.read_file(file_path)

    assert read_content == content


def test_local_fs_make_executable(tmp_path: Path) -> None:
    """Verify LocalFileSystem can make a file executable."""
    fs = LocalFileSystem()
    file_path = tmp_path / "script.sh"
    file_path.touch()

    # Ensure it's not initially executable
    assert not os.access(file_path, os.X_OK)

    fs.make_executable(file_path)

    # Check if the executable bit is set
    assert file_path.stat().st_mode & stat.S_IEXEC


@patch("subprocess.run")
def test_find_git_root_success(mock_subprocess_run: Mock) -> None:
    """
    Verify that find_git_root correctly parses the output of a successful git command.
    """
    expected_path = "/path/to/git/root"
    mock_subprocess_run.return_value = subprocess.CompletedProcess(
        args=[], returncode=0, stdout=f"{expected_path}\n", stderr=""
    )

    service = GitService()
    found_root = service.find_git_root()

    assert found_root == Path(expected_path)
    mock_subprocess_run.assert_called_once_with(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    )


@patch("subprocess.run")
def test_find_git_root_not_in_repo(mock_subprocess_run: Mock) -> None:
    """
    Verify NotInGitRepositoryError is raised when the git command fails.
    """
    mock_subprocess_run.side_effect = subprocess.CalledProcessError(
        returncode=128, cmd="git", stderr="fatal: not a git repository"
    )

    service = GitService()
    with pytest.raises(NotInGitRepositoryError):
        service.find_git_root()


@patch("subprocess.run")
@patch("hookci.infrastructure.fs.GitService.find_git_root")
def test_set_hooks_path_success(
    mock_find_root: Mock, mock_subprocess: Mock, tmp_path: Path
) -> None:
    """Verify the correct git config command is executed on success."""
    mock_find_root.return_value = tmp_path
    service = GitService()
    hooks_dir = tmp_path / ".hookci" / "hooks"

    service.set_hooks_path(hooks_dir)

    mock_subprocess.assert_called_once_with(
        ["git", "config", "core.hooksPath", ".hookci/hooks"],
        check=True,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )


@patch("subprocess.run")
@patch("hookci.infrastructure.fs.GitService.find_git_root")
def test_set_hooks_path_failure(
    mock_find_root: Mock, mock_subprocess: Mock, tmp_path: Path
) -> None:
    """Verify GitCommandError is raised when the git command fails."""
    mock_find_root.return_value = tmp_path
    mock_subprocess.side_effect = subprocess.CalledProcessError(
        returncode=1, cmd="git", stderr="fatal: error"
    )
    service = GitService()
    hooks_dir = tmp_path / ".hookci" / "hooks"

    with pytest.raises(GitCommandError, match="Failed to set git hooks path"):
        service.set_hooks_path(hooks_dir)
