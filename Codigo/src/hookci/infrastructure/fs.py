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
from typing import Protocol, runtime_checkable

from hookci.infrastructure.errors import (
    FileSystemError,
    GitCommandError,
    NotInGitRepositoryError,
)


@runtime_checkable
class IFileSystem(Protocol):
    """Interface for filesystem operations."""

    def file_exists(self, path: Path) -> bool: ...
    def create_dir(self, path: Path) -> None: ...
    def write_file(self, path: Path, content: str) -> None: ...
    def read_file(self, path: Path) -> str: ...
    def make_executable(self, path: Path) -> None: ...


@runtime_checkable
class IScmService(Protocol):
    """Interface for Git-related operations."""

    @property
    def git_root(self) -> Path: ...
    def set_hooks_path(self, hooks_path: Path) -> None: ...
    def get_current_branch(self) -> str: ...
    def get_staged_commit_message(self) -> str: ...


class LocalFileSystem(IFileSystem):
    """Concrete implementation of IFileSystem using local disk."""

    def file_exists(self, path: Path) -> bool:
        try:
            return path.exists()
        except OSError as e:
            raise FileSystemError(f"Failed to check if file exists: {path}") from e

    def create_dir(self, path: Path) -> None:
        try:
            path.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            raise FileSystemError(f"Failed to create directory: {path}") from e

    def write_file(self, path: Path, content: str) -> None:
        try:
            path.write_text(content, encoding="utf-8")
        except OSError as e:
            raise FileSystemError(f"Failed to write to file: {path}") from e

    def read_file(self, path: Path) -> str:
        try:
            return path.read_text(encoding="utf-8")
        except OSError as e:
            raise FileSystemError(f"Failed to read file: {path}") from e

    def make_executable(self, path: Path) -> None:
        """Makes a file executable, similar to `chmod +x`."""
        try:
            current_permissions = path.stat().st_mode
            path.chmod(current_permissions | stat.S_IEXEC)
        except OSError as e:
            raise FileSystemError(
                f"Failed to change permissions for file: {path}"
            ) from e


class GitService(IScmService):
    """Service for interacting with Git repositories."""

    def __init__(self, fs: IFileSystem):
        self._fs = fs

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
                encoding="utf-8",
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
                encoding="utf-8",
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

    def get_staged_commit_message(self) -> str:
        """
        Gets the staged commit message from the standard Git message file.

        For a `pre-commit` hook, the commit object does not exist yet. The
        message proposed by the user is stored in `.git/COMMIT_EDITMSG`.
        This method reads that file to allow filtering based on its content.
        """
        commit_msg_path = self.git_root / ".git" / "COMMIT_EDITMSG"
        try:
            if not self._fs.file_exists(commit_msg_path):
                return ""
            content = self._fs.read_file(commit_msg_path)
            # Filter out comment lines (starting with '#') and strip whitespace
            lines = [
                line
                for line in content.splitlines()
                if not line.strip().startswith("#")
            ]
            return "\n".join(lines).strip()
        except Exception as e:
            # We catch Exception here because file ops might fail with FileSystemError
            # or other unforeseen issues, and we want to wrap it in GitCommandError.
            raise GitCommandError(
                f"Could not read or parse commit message file: {e}"
            ) from e
