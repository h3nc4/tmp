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
import stat
import subprocess
from functools import cached_property
from pathlib import Path
from typing import Protocol

from hookci.infrastructure.errors import GitCommandError, NotInGitRepositoryError


class IFileSystem(Protocol):
    """Interface for filesystem operations."""

    def file_exists(self, path: Path) -> bool: ...
    def create_dir(self, path: Path) -> None: ...
    def write_file(self, path: Path, content: str) -> None: ...
    def read_file(self, path: Path) -> str: ...
    def make_executable(self, path: Path) -> None: ...


class IScmService(Protocol):
    """Interface for Git-related operations."""

    @property
    def git_root(self) -> Path: ...
    def set_hooks_path(self, hooks_path: Path) -> None: ...
    def get_current_branch(self) -> str: ...


class LocalFileSystem(IFileSystem):
    """Concrete implementation of IFileSystem using local disk."""

    def file_exists(self, path: Path) -> bool:
        return path.exists()

    def create_dir(self, path: Path) -> None:
        path.mkdir(parents=True, exist_ok=True)

    def write_file(self, path: Path, content: str) -> None:
        path.write_text(content)

    def read_file(self, path: Path) -> str:
        return path.read_text()

    def make_executable(self, path: Path) -> None:
        """Makes a file executable, similar to `chmod +x`."""
        current_permissions = path.stat().st_mode
        path.chmod(current_permissions | stat.S_IEXEC)


class GitService(IScmService):
    """Service for interacting with Git repositories."""

    @cached_property
    def git_root(self) -> Path:
        """
        Finds and caches the root directory of the Git repository.
        This command can run from anywhere inside the repo, so no cwd is needed.
        """
        try:
            process = subprocess.run(
                ["git", "rev-parse", "--show-toplevel"],
                check=True,
                capture_output=True,
                text=True,
            )
            return Path(process.stdout.strip())
        except subprocess.CalledProcessError as e:
            raise NotInGitRepositoryError("Not inside a Git repository.") from e

    def _run_git_command(self, *args: str) -> str:
        """Helper to run a git command from the git root and return its stdout."""
        try:
            process = subprocess.run(
                ["git", *args],
                check=True,
                capture_output=True,
                text=True,
                cwd=self.git_root,  # Now uses the cached property, preventing recursion.
            )
            return process.stdout.strip()
        except subprocess.CalledProcessError as e:
            raise GitCommandError(
                f"Git command '{' '.join(args)}' failed: {e.stderr.strip()}"
            ) from e

    def set_hooks_path(self, hooks_path: Path) -> None:
        """Sets the git `core.hooksPath` configuration for the repository."""
        relative_hooks_path = hooks_path.relative_to(self.git_root)
        self._run_git_command("config", "core.hooksPath", str(relative_hooks_path))

    def get_current_branch(self) -> str:
        """Gets the current active branch name."""
        return self._run_git_command("rev-parse", "--abbrev-ref", "HEAD")
