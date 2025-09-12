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
from itertools import chain
from typing import Dict, List, Optional

import typer
from rich.console import Console, Group
from rich.live import Live
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskID,
    TextColumn,
    TimeElapsedColumn,
)
from rich.syntax import Syntax
from rich.text import Text

from hookci.application.errors import ApplicationError
from hookci.application.events import (
    LogLine,
    PipelineEnd,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.containers import container
from hookci.infrastructure.errors import InfrastructureError
from hookci.log import get_logger, setup_logging

# Configure logging with default settings initially
setup_logging()
logger = get_logger("hookci.cli")

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="HookCI: A tool for running Continuous Integration locally with Git hooks and Docker.",
    rich_markup_mode="markdown",
)

console = Console()


def _handle_error(e: Exception) -> None:
    """Logs errors and exits the application."""
    if isinstance(e, (ApplicationError, InfrastructureError)):
        logger.error(f"{e}")
    else:
        logger.exception(f"An unexpected error occurred: {e}")
    raise typer.Exit(code=1)


@app.command()
def init() -> None:
    """
    Initializes HookCI in the current repository.
    This creates a `.hookci/hookci.yaml` file with default settings
    and installs git hooks to `.hookci/hooks`.
    """
    try:
        logger.info("🚀 Initializing HookCI...")
        service = container.project_init_service
        config_path = service.run()

        console.print(
            "\n[bold green]✅ Success! HookCI has been initialized.[/bold green]"
        )
        console.print(f"   - Configuration file created at: [cyan]{config_path}[/cyan]")
        console.print("   - Git hooks have been installed and configured.")
        console.print(
            "\n👉 Next steps: customize the configuration file to fit your project's needs."
        )

    except Exception as e:
        _handle_error(e)


@app.command()
def run(
    hook_type: Optional[str] = typer.Option(
        None,
        "--hook-type",
        help="The type of git hook triggering the run (e.g., 'pre-commit').",
        hidden=True,
    )
) -> None:
    """
    Manually runs the CI pipeline based on the configuration file.
    """
    try:
        service = container.ci_execution_service
        event_generator = service.run(hook_type=hook_type)

        try:
            first_event = next(event_generator)
        except StopIteration:
            logger.info("Pipeline run was skipped based on configuration filters.")
            return

        # If we get here, the pipeline is running. Set up the UI.
        progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=console,
        )
        overall_task = progress.add_task("[bold]Pipeline", total=1)
        step_tasks: Dict[str, TaskID] = {}
        output_panel = Panel("", border_style="dim", title="Output")
        layout = Group(progress, output_panel)

        with Live(layout, console=console, screen=False, redirect_stderr=False) as live:
            final_status = "FAILURE"
            command_text: Text | None = None
            log_lines: List[str] = []

            # Chain the first event back with the rest of the generator
            all_events = chain([first_event], event_generator)

            for event in all_events:
                if isinstance(event, PipelineStart):
                    progress.update(overall_task, total=event.total_steps)

                elif isinstance(event, StepStart):
                    task_id = progress.add_task(f"  - {event.step.name}", total=1)
                    step_tasks[event.step.name] = task_id
                    log_lines = []
                    command_text = Text.from_markup(
                        f"[bold]Command:[/] [cyan]{event.step.command}[/]\n"
                    )
                    output_panel.renderable = command_text

                elif isinstance(event, LogLine):
                    log_lines.append(event.line)
                    if len(log_lines) > console.height:
                        log_lines.pop(0)
                    log_syntax = Syntax(
                        "".join(log_lines),
                        "bash",
                        theme="monokai",
                        word_wrap=True,
                    )
                    if command_text:
                        output_panel.renderable = Group(command_text, log_syntax)
                    else:
                        output_panel.renderable = log_syntax

                elif isinstance(event, StepEnd):
                    step_task_id: TaskID | None = step_tasks.get(event.step.name)
                    if step_task_id is not None:
                        description = f"  - {event.step.name}"
                        if event.status == "SUCCESS":
                            description = f"[green]✔[/] {description}"
                        elif event.status == "FAILURE":
                            description = f"[red]✖[/] {description}"
                        else:  # WARNING
                            description = f"[yellow]⚠[/] {description}"
                        progress.update(
                            step_task_id, completed=1, description=description
                        )
                    progress.update(overall_task, advance=1)

                elif isinstance(event, PipelineEnd):
                    final_status = event.status
                    if final_status == "SUCCESS":
                        progress.update(
                            overall_task,
                            description="[bold green]✅ Pipeline Finished[/]",
                        )
                    elif final_status == "WARNING":
                        progress.update(
                            overall_task,
                            description="[bold yellow]🔶 Pipeline Finished with Warnings[/]",
                        )
                    else:
                        progress.update(
                            overall_task, description="[bold red]❌ Pipeline Failed[/]"
                        )
                    live.stop()

            if final_status == "SUCCESS":
                console.print(
                    "[bold green]✅ Pipeline finished successfully![/bold green]"
                )
            elif final_status == "WARNING":
                console.print(
                    "[bold yellow]🔶 Pipeline finished with non-critical failures.[/bold yellow]"
                )
            else:
                console.print("[bold red]❌ Pipeline failed.[/bold red]")
                raise typer.Exit(code=1)

    except Exception as e:
        _handle_error(e)


@app.command()
def migrate() -> None:
    """
    Migrates the configuration file to the latest version.
    """
    logger.warning("The 'migrate' command is not yet implemented.")


def main() -> None:
    """
    The main entry point for the Typer application.
    """
    app()
