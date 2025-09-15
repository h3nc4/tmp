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
from __future__ import annotations

from collections import defaultdict
from itertools import chain
from typing import DefaultDict, Dict, List, Optional

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
    PipelineEvent,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.containers import container
from hookci.domain.config import LogLevel
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


class PipelineUI:
    """Manages the Rich components for displaying pipeline progress and logs."""

    def __init__(self, console: Console):
        self.console = console
        self.progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=self.console,
        )
        self.overall_task = self.progress.add_task("[bold]Pipeline", total=1)
        self.step_tasks: Dict[str, TaskID] = {}
        self.log_level: LogLevel = LogLevel.INFO

        # State for log panels
        self.all_logs: DefaultDict[str, List[LogLine]] = defaultdict(list)
        self.active_info_panel: Optional[Panel] = None
        self.debug_panels: Dict[str, Panel] = {}
        self.error_panels: List[Panel] = []

    def _get_display_group(self) -> Group:
        """Constructs the renderable group based on the current UI state."""
        items: List[Panel | Progress] = [self.progress]
        if self.active_info_panel:
            items.append(self.active_info_panel)
        items.extend(self.debug_panels.values())
        items.extend(self.error_panels)
        return Group(*items)

    def handle_event(self, event: PipelineEvent, live: Live) -> None:
        """Updates the UI based on a pipeline event."""
        if isinstance(event, PipelineStart):
            self.log_level = event.log_level
            self.progress.update(self.overall_task, total=event.total_steps)

        elif isinstance(event, StepStart):
            task_id = self.progress.add_task(f"  - {event.step.name}", total=1)
            self.step_tasks[event.step.name] = task_id
            if self.log_level in (LogLevel.INFO, LogLevel.DEBUG):
                self._create_panel_for_step(event)

        elif isinstance(event, LogLine):
            self.all_logs[event.step_name].append(event)
            self._update_panel_with_log(event)

        elif isinstance(event, StepEnd):
            self._finalize_step(event)

        elif isinstance(event, PipelineEnd):
            self._finalize_pipeline(event)

        live.update(self._get_display_group())

    def _create_panel_for_step(self, event: StepStart) -> None:
        command_text = Text.from_markup(
            f"[bold]Command:[/] [cyan]{event.step.command}[/]\n"
        )
        panel = Panel(
            command_text, border_style="dim", title=f"Output: {event.step.name}"
        )

        if self.log_level == LogLevel.INFO:
            self.active_info_panel = panel
        elif self.log_level == LogLevel.DEBUG:
            self.debug_panels[event.step.name] = panel

    def _update_panel_with_log(self, event: LogLine) -> None:
        if self.log_level == LogLevel.INFO and self.active_info_panel:
            step_logs = "".join(log.line for log in self.all_logs[event.step_name])
            syntax = Syntax(step_logs, "bash", theme="monokai", word_wrap=True)
            if isinstance(self.active_info_panel.renderable, Group):
                self.active_info_panel.renderable.renderables[1] = syntax
            else:
                self.active_info_panel.renderable = Group(
                    self.active_info_panel.renderable, syntax
                )

        elif self.log_level == LogLevel.DEBUG and event.step_name in self.debug_panels:
            panel = self.debug_panels[event.step_name]
            step_logs = "".join(log.line for log in self.all_logs[event.step_name])
            syntax = Syntax(step_logs, "bash", theme="monokai", word_wrap=True)
            if isinstance(panel.renderable, Group):
                panel.renderable.renderables[1] = syntax
            else:
                panel.renderable = Group(panel.renderable, syntax)

    def _finalize_step(self, event: StepEnd) -> None:
        task_id = self.step_tasks.get(event.step.name)
        if task_id:
            description = f"  - {event.step.name}"
            if event.status == "SUCCESS":
                description = f"[green]✔[/] {description}"
            elif event.status == "FAILURE":
                description = f"[red]✖[/] {description}"
            else:  # WARNING
                description = f"[yellow]⚠[/] {description}"
            self.progress.update(task_id, completed=1, description=description)

        self.progress.update(self.overall_task, advance=1)

        if self.log_level == LogLevel.INFO:
            self.active_info_panel = None

        if self.log_level == LogLevel.ERROR and event.status == "FAILURE":
            log_content = "".join(log.line for log in self.all_logs[event.step.name])
            command_text = Text.from_markup(
                f"[bold]Command:[/] [cyan]{event.step.command}[/]\n"
            )
            error_group = Group(
                command_text,
                Syntax(log_content, "bash", theme="monokai", word_wrap=True),
            )
            self.error_panels.append(
                Panel(
                    error_group,
                    border_style="red",
                    title=f"Error Output: {event.step.name}",
                )
            )

    def _finalize_pipeline(self, event: PipelineEnd) -> None:
        description = "[bold red]❌ Pipeline Failed[/]"
        if event.status == "SUCCESS":
            description = "[bold green]✅ Pipeline Finished[/]"
        elif event.status == "WARNING":
            description = "[bold yellow]🔶 Pipeline Finished with Warnings[/]"

        # Explicitly mark the overall task as complete to remove the spinner
        overall_task_details = self.progress.tasks[self.overall_task]
        if overall_task_details.total is not None:
            self.progress.update(
                self.overall_task,
                description=description,
                completed=overall_task_details.total,
            )
        else:  # Fallback for an indeterminate task
            self.progress.update(
                self.overall_task, description=description, completed=1
            )


def _handle_error(e: Exception) -> None:
    """Logs errors and exits the application."""
    # Catch typer.Exit and re-raise it to prevent it from being logged as an unexpected error.
    if isinstance(e, typer.Exit):
        raise e
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
    final_status = "FAILURE"  # Default status
    try:
        service = container.ci_execution_service
        event_generator = service.run(hook_type=hook_type)

        try:
            first_event = next(event_generator)
        except StopIteration:
            logger.info("Pipeline run was skipped based on configuration filters.")
            return

        pipeline_ui = PipelineUI(console)
        all_events = chain([first_event], event_generator)

        with Live(
            pipeline_ui._get_display_group(),
            console=console,
            screen=False,
            redirect_stderr=False,
        ) as live:
            for event in all_events:
                pipeline_ui.handle_event(event, live)
                if isinstance(event, PipelineEnd):
                    final_status = event.status

    except Exception as e:
        _handle_error(e)
        return

    if final_status == "SUCCESS":
        console.print("[bold green]✅ Pipeline finished successfully![/bold green]")
    elif final_status == "WARNING":
        console.print(
            "[bold yellow]🔶 Pipeline finished with non-critical failures.[/bold yellow]"
        )
    else:  # FAILURE
        console.print("[bold red]❌ Pipeline failed.[/bold red]")
        raise typer.Exit(code=1)


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
