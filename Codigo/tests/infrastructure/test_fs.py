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

    assert not os.access(file_path, os.X_OK)
    fs.make_executable(file_path)
    assert file_path.stat().st_mode & stat.S_IEXEC


@patch("subprocess.run")
def test_git_root_property_success(mock_subprocess_run: Mock) -> None:
    """
    Verify that the git_root property correctly parses the output.
    """
    expected_path = "/path/to/git/root"
    mock_subprocess_run.return_value = subprocess.CompletedProcess(
        args=[], returncode=0, stdout=f"{expected_path}\n", stderr=""
    )
    service = GitService()
    found_root = service.git_root

    assert found_root == Path(expected_path)
    mock_subprocess_run.assert_called_once_with(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    )


@patch("subprocess.run")
def test_git_root_property_caches_value(mock_subprocess_run: Mock) -> None:
    """
    Verify that the git_root property caches the result after the first call.
    """
    expected_path = "/path/to/git/root"
    mock_subprocess_run.return_value = subprocess.CompletedProcess(
        args=[], returncode=0, stdout=f"{expected_path}\n", stderr=""
    )
    service = GitService()
    root1 = service.git_root
    root2 = service.git_root

    assert root1 == Path(expected_path)
    assert root2 == Path(expected_path)
    mock_subprocess_run.assert_called_once()


@patch("subprocess.run")
def test_git_root_property_not_in_repo(mock_subprocess_run: Mock) -> None:
    """
    Verify NotInGitRepositoryError is raised when the git command fails.
    """
    mock_subprocess_run.side_effect = subprocess.CalledProcessError(
        returncode=128, cmd="git", stderr="fatal: not a git repository"
    )
    service = GitService()
    with pytest.raises(NotInGitRepositoryError):
        _ = service.git_root


@patch("subprocess.run")
def test_set_hooks_path_success(mock_subprocess: Mock, tmp_path: Path) -> None:
    """Verify the correct git config command is executed on success."""
    service = GitService()
    service.git_root = tmp_path
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
def test_set_hooks_path_failure(mock_subprocess: Mock, tmp_path: Path) -> None:
    """Verify GitCommandError is raised when the git command fails."""
    service = GitService()
    service.git_root = tmp_path
    mock_subprocess.side_effect = subprocess.CalledProcessError(
        returncode=1, cmd="git", stderr="fatal: error"
    )
    hooks_dir = tmp_path / ".hookci" / "hooks"

    # Match the new, more specific error message
    with pytest.raises(GitCommandError, match="Git command 'config .*' failed"):
        service.set_hooks_path(hooks_dir)


@patch("subprocess.run")
def test_get_current_branch(mock_subprocess: Mock, tmp_path: Path) -> None:
    """Verify get_current_branch returns the correct branch name."""
    service = GitService()
    service.git_root = tmp_path
    mock_subprocess.return_value = subprocess.CompletedProcess(
        args=[], returncode=0, stdout="feature/login\n", stderr=""
    )
    branch = service.get_current_branch()

    assert branch == "feature/login"
    mock_subprocess.assert_called_once_with(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
        cwd=tmp_path,
    )
