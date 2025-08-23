#!/usr/bin/env python3
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
Filesystem and Git interaction services.
"""
from pathlib import Path
from typing import Protocol

from hookci.infrastructure.errors import NotInGitRepositoryError


class IFileSystem(Protocol):
    """Interface for filesystem operations."""

    def file_exists(self, path: Path) -> bool: ...

    def write_file(self, path: Path, content: str) -> None: ...


class IGitService(Protocol):
    """Interface for Git-related operations."""

    def find_git_root(self) -> Path: ...


class LocalFileSystem(IFileSystem):
    """Concrete implementation of IFileSystem using local disk."""

    def file_exists(self, path: Path) -> bool:
        return path.exists()

    def write_file(self, path: Path, content: str) -> None:
        path.write_text(content)


class GitService(IGitService):
    """Service for interacting with Git repositories."""

    def find_git_root(self) -> Path:
        """
        Finds the root directory of the Git repository.
        Traverses up from the current directory.
        """
        current_path = Path.cwd().resolve()
        while current_path != current_path.parent:
            if (current_path / ".git").is_dir():
                return current_path
            current_path = current_path.parent
        raise NotInGitRepositoryError("Not inside a Git repository.")
