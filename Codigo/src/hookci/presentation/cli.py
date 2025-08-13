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
This module defines the presentation layer of HookCI,
handling all command-line interface interactions.
"""

import typer
from rich.console import Console
from rich.table import Table
from pathlib import Path
from hookci.application.errors import ProjectAlreadyInitializedError
from hookci.application.services import ProjectInitializationService
from hookci.infrastructure.errors import NotInGitRepositoryError
from hookci.infrastructure.fs import GitService, LocalFileSystem
from hookci.infrastructure.yaml_handler import YamlConfigurationHandler

# Create a Typer app instance.
# add_completion=False disables shell completion installation commands.
# no_args_is_help=True shows the help message when no command is given.
app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="HookCI: A tool for running Continuous Integration locally with Git hooks and Docker.",
    rich_markup_mode="markdown"
)

console = Console()


@app.command(name="help")
def help_command() -> None:
    """
    Displays a detailed list of available commands.
    """
    table = Table(title="HookCI Commands", show_header=True, header_style="bold magenta")
    table.add_column("Command", style="dim", width=12)
    table.add_column("Description")

    table.add_row(
        "init",
        "Initializes HookCI in the current Git repository, creating a config file and installing hooks."
    )
    table.add_row(
        "run",
        "Manually triggers the CI pipeline execution based on the current configuration."
    )
    table.add_row(
        "migrate",
        "Migrates an existing HookCI configuration file to the latest version."
    )
    table.add_row(
        "help",
        "Shows this help message with a detailed command list."
    )

    console.print(table)


@app.command()
def init() -> None:
    """
    Initializes HookCI in the current repository.
    This creates a `hookci.yaml` file with default settings
    and prepares the repository to use HookCI hooks.
    """
    console.print("🚀 Initializing HookCI...")
    try:
        # Dependency Injection setup
        fs = LocalFileSystem()
        git_service = GitService()
        config_handler = YamlConfigurationHandler(fs)
        service = ProjectInitializationService(git_service, fs, config_handler)

        config_path = service.run()

        console.print(f"✅ [green]Success![/green] Configuration file created at: {config_path}")
        console.print("👉 Next steps: customize `hookci.yaml` to fit your project's needs.")

    except NotInGitRepositoryError:
        console.print("❌ [bold red]Error:[/bold red] This is not a Git repository. Please run `git init` first.")
        raise typer.Exit(code=1)
    except ProjectAlreadyInitializedError as e:
        console.print(f"👋 [yellow]Notice:[/yellow] {e}")
        raise typer.Exit(code=0)
    except Exception as e:
        console.print(f"🔥 [bold red]An unexpected error occurred:[/bold red] {e}")
        raise typer.Exit(code=1)


@app.command()
def run() -> None:
    """
    Manually runs the CI pipeline.
    """
    console.print("[yellow]Notice:[/yellow] The 'run' command is not yet implemented.")


@app.command()
def migrate() -> None:
    """
    Migrates the configuration file to the latest version.
    """
    console.print("[yellow]Notice:[/yellow] The 'migrate' command is not yet implemented.")


def main() -> None:
    """
    The main entry point for the Typer application.
    """
    app()
