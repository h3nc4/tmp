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
from pathlib import Path
from unittest.mock import patch, Mock

import pytest
from hookci.infrastructure.errors import NotInGitRepositoryError
from hookci.infrastructure.fs import GitService


@patch("pathlib.Path.cwd")
def test_find_git_root_from_subdir(mock_cwd: Mock, tmp_path: Path) -> None:
    """
    Verify that find_git_root can locate the .git directory from a subdirectory.
    """
    git_root = tmp_path / "project"
    git_dir = git_root / ".git"
    git_dir.mkdir(parents=True)

    subdir = git_root / "src" / "app"
    subdir.mkdir(parents=True)

    mock_cwd.return_value = subdir
    os.chdir(subdir)  # Change current directory for the test

    service = GitService()
    found_root = service.find_git_root()

    assert found_root == git_root


@patch("pathlib.Path.cwd")
def test_find_git_root_from_root(mock_cwd: Mock, tmp_path: Path) -> None:
    """
    Verify that find_git_root works correctly when called from the repository root.
    """
    git_root = tmp_path / "project"
    git_dir = git_root / ".git"
    git_dir.mkdir(parents=True)

    mock_cwd.return_value = git_root
    os.chdir(git_root)

    service = GitService()
    found_root = service.find_git_root()

    assert found_root == git_root


@patch("pathlib.Path.cwd")
def test_find_git_root_not_in_repo(mock_cwd: Mock, tmp_path: Path) -> None:
    """
    Verify that NotInGitRepositoryError is raised when not inside a Git repository.
    """
    # tmp_path is guaranteed to not be a git repo
    mock_cwd.return_value = tmp_path
    os.chdir(tmp_path)

    service = GitService()

    with pytest.raises(NotInGitRepositoryError, match="Not inside a Git repository."):
        service.find_git_root()
