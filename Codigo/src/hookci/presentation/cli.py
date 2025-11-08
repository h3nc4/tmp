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

import subprocess
from collections import defaultdict
from itertools import chain
from typing import Callable, DefaultDict, Dict, Iterable, List, Optional

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

from hookci.application.errors import ApplicationError, ConfigurationUpToDateError
from hookci.application.events import (
    DebugShellStarting,
    ImageBuildEnd,
    ImageBuildProgress,
    ImageBuildStart,
    ImagePullEnd,
    ImagePullStart,
    LogLine,
    PipelineEnd,
    PipelineEvent,
    PipelineStart,
    StepEnd,
    StepStart,
)
from hookci.containers import container
from hookci.domain.config import LogLevel, Step  # Strictly for type hinting
from hookci.infrastructure.errors import InfrastructureError  # Strictly for exceptions
from hookci.log import get_logger, setup_logging

try:
    from hookci._version import __version__  # type: ignore[import-not-found]
except ImportError:
    __version__ = "0.0.0-dev"

# Configure logging with default settings initially
setup_logging()
logger = get_logger("hookci.cli")


def _version_callback(value: bool) -> None:
    """Prints the version and exits."""
    if value:
        console.print(f"HookCI version {__version__}")
        raise typer.Exit()


app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="HookCI: A tool for running Continuous Integration locally with Git hooks and Docker.",
    rich_markup_mode="markdown",
)

console = Console()


@app.callback()
def main_options(
    version: Optional[bool] = typer.Option(
        None,
        "--version",
        "-V",
        help="Show the application's version and exit.",
        callback=_version_callback,
        is_eager=True,
    )
) -> None:
    """
    Manage HookCI, a tool for local CI with Git hooks and Docker.
    """


class PipelineUI:
    """Manages the Rich components for displaying pipeline progress and logs."""

    def __init__(self, console: Console):
        self.console = console
        self.overall_progress = Progress(
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=self.console,
        )
        self.steps_progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=self.console,
        )
        self.overall_task = self.overall_progress.add_task("[bold]Pipeline", total=1)
        self.step_tasks: Dict[str, TaskID] = {}
        self.docker_task: Optional[TaskID] = None
        self.log_level: LogLevel = LogLevel.INFO

        # State for log panels
        self.all_logs: DefaultDict[str, List[LogLine]] = defaultdict(list)
        self.active_info_panel: Optional[Panel] = None
        self.debug_panels: Dict[str, Panel] = {}
        self.error_panels: List[Panel] = []

    def _get_display_group(self) -> Group:
        """Constructs the renderable group based on the current UI state."""
        items: List[Panel | Progress] = [self.overall_progress, self.steps_progress]
        if self.active_info_panel:
            items.append(self.active_info_panel)
        items.extend(self.debug_panels.values())
        items.extend(self.error_panels)
        return Group(*items)

    def handle_event(self, event: PipelineEvent, live: Live) -> None:  # noqa: C901
        """Updates the UI based on a pipeline event."""
        processed = False
        if isinstance(event, PipelineStart):
            self.log_level = event.log_level
            self.overall_progress.update(self.overall_task, total=event.total_steps)
            processed = True
        elif isinstance(event, ImagePullStart):
            self.docker_task = self.steps_progress.add_task(
                f"  - Pulling image [cyan]{event.image_name}[/cyan]...", total=1
            )
            processed = True
        elif isinstance(event, ImagePullEnd):
            if self.docker_task is not None:
                description = (
                    "[green]✔[/] Pulled image"
                    if event.status == "SUCCESS"
                    else "[red]✖[/] Failed to pull image"
                )
                self.steps_progress.update(
                    self.docker_task, completed=1, description=description
                )
            processed = True
        elif isinstance(event, ImageBuildStart):
            self.docker_task = self.steps_progress.add_task(
                f"  - Building image [cyan]{event.tag}[/cyan]", total=event.total_steps
            )
            processed = True
        elif isinstance(event, ImageBuildProgress):
            if self.docker_task is not None:
                self.steps_progress.update(self.docker_task, completed=event.step)
            processed = True
        elif isinstance(event, ImageBuildEnd):
            if self.docker_task is not None:
                description = (
                    "[green]✔[/] Built image"
                    if event.status == "SUCCESS"
                    else "[red]✖[/] Failed to build image"
                )
                self.steps_progress.update(
                    self.docker_task,
                    completed=self.steps_progress.tasks[0].total,
                    description=description,
                )
            processed = True
        elif isinstance(event, StepStart):
            task_id = self.steps_progress.add_task(f"  - {event.step.name}", total=1)
            self.step_tasks[event.step.name] = task_id
            if self.log_level in (LogLevel.INFO, LogLevel.DEBUG):
                self._create_panel_for_step(event)
            processed = True
        elif isinstance(event, LogLine):
            self.all_logs[event.step_name].append(event)
            self._update_panel_with_log(event)
            processed = True
        elif isinstance(event, StepEnd):
            self._finalize_step(event)
            processed = True
        elif isinstance(event, PipelineEnd):
            self._finalize_pipeline(event)
            processed = True

        if processed:
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
            renderable = self.active_info_panel.renderable
            if isinstance(renderable, Group):
                renderable.renderables[1] = syntax
            else:
                self.active_info_panel.renderable = Group(renderable, syntax)

        elif self.log_level == LogLevel.DEBUG and event.step_name in self.debug_panels:
            panel = self.debug_panels[event.step_name]
            step_logs = "".join(log.line for log in self.all_logs[event.step_name])
            syntax = Syntax(step_logs, "bash", theme="monokai", word_wrap=True)
            renderable = panel.renderable
            if isinstance(renderable, Group):
                renderable.renderables[1] = syntax
            else:
                panel.renderable = Group(renderable, syntax)

    def _finalize_step(self, event: StepEnd) -> None:
        step = event.step
        task_id = self.step_tasks.get(step.name)
        if task_id is not None:
            description = f"  - {step.name}"
            if event.status == "SUCCESS":
                description = f"[green]✔[/] {description}"
                self.overall_progress.update(self.overall_task, advance=1)
            elif event.status == "FAILURE":
                description = f"[red]✖[/] {description}"
            else:  # WARNING
                description = f"[yellow]⚠[/] {description}"
            self.steps_progress.update(task_id, completed=1, description=description)

        # Clear active info panel for INFO level
        if self.log_level == LogLevel.INFO:
            self.active_info_panel = None

        # For failures, remove any existing debug panel and create a dedicated error panel
        if event.status == "FAILURE":
            if self.log_level == LogLevel.DEBUG and step.name in self.debug_panels:
                del self.debug_panels[step.name]

            log_content = "".join(log.line for log in self.all_logs[step.name])
            command_text = Text.from_markup(
                f"[bold]Command:[/] [cyan]{step.command}[/]\n"
            )
            error_group = Group(
                command_text,
                Syntax(log_content, "bash", theme="monokai", word_wrap=True),
            )
            self.error_panels.append(
                Panel(
                    error_group,
                    border_style="red",
                    title=f"Error Output: {step.name}",
                )
            )

    def _finalize_pipeline(self, event: PipelineEnd) -> None:
        description = "[bold red]❌ Pipeline Failed[/]"
        if event.status == "SUCCESS":
            description = "[bold green]✅ Pipeline Finished[/]"
        elif event.status == "WARNING":
            description = "[bold yellow]🔶 Pipeline Finished with Warnings[/]"

        # Update the overall task description without forcing completion to 100%.
        # The 'completed' count now accurately reflects successful steps.
        self.overall_progress.update(self.overall_task, description=description)


def _handle_error(e: Exception) -> None:
    """Logs errors and exits the application."""
    # Handle specific "info" cases that shouldn't look like errors
    if isinstance(e, ConfigurationUpToDateError):
        logger.info(str(e))
        # This is not an error, so we exit gracefully.
        raise typer.Exit(code=0)
    if isinstance(e, (ApplicationError, InfrastructureError)):
        logger.error(f"{e}")
    else:
        logger.exception(f"An unexpected error occurred: {e}")
    raise typer.Exit(code=1)


def _open_interactive_shell(container_id: str, step: Step) -> None:
    """Attempts to open an interactive shell inside the container."""
    console.print(
        f"\n[bold yellow]Step '{step.name}' failed. Opening debug shell...[/]"
    )
    console.print(f"[dim]Container ID: {container_id}. Type 'exit' to continue.[/dim]")

    shells = ["bash", "ash", "sh"]
    for shell in shells:
        try:
            # Use subprocess to get a fully interactive TTY
            result = subprocess.run(
                ["docker", "exec", "-it", container_id, shell],
                check=False,  # Don't raise on non-zero exit, we'll check it
            )
            # If the shell was found and exited (e.g. user typed 'exit'), we're done.
            # A non-zero exit code here might mean the shell itself isn't present.
            if result.returncode != 127 and result.returncode != 126:
                return
        except FileNotFoundError:
            logger.error(
                "`docker` command not found. Is Docker installed and in your PATH?"
            )
            return
        except Exception as e:
            logger.error(f"Failed to open interactive shell with '{shell}': {e}")
            continue

    logger.error("Could not find a valid shell (bash, ash, sh) in the container.")


class DebugUI:
    """Processes pipeline events and prints simple line-by-line output for debug mode."""

    def __init__(self) -> None:
        self.final_status = "FAILURE"
        self.current_step: Optional[Step] = None
        # A mapping of event types to their corresponding handler methods.
        self.event_handlers: Dict[
            type[PipelineEvent], Callable[[PipelineEvent], None]
        ] = {
            PipelineStart: self._handle_pipeline_start,
            ImagePullStart: self._handle_image_pull_start,
            ImagePullEnd: self._handle_image_pull_end,
            ImageBuildStart: self._handle_image_build_start,
            ImageBuildProgress: self._handle_image_build_progress,
            ImageBuildEnd: self._handle_image_build_end,
            StepStart: self._handle_step_start,
            LogLine: self._handle_log_line,
            StepEnd: self._handle_step_end,
            DebugShellStarting: self._handle_debug_shell,
            PipelineEnd: self._handle_pipeline_end,
        }

    def handle_event(self, event: PipelineEvent) -> None:
        """Dispatches an event to the appropriate handler."""
        handler = self.event_handlers.get(type(event))
        if handler:
            handler(event)

    def _handle_pipeline_start(self, event: PipelineEvent) -> None:
        assert isinstance(event, PipelineStart)
        console.print("[bold]🚀 Pipeline Started[/]")

    def _handle_image_pull_start(self, event: PipelineEvent) -> None:
        assert isinstance(event, ImagePullStart)
        console.print(f"  [bold]🐳 Pulling image:[/] {event.image_name}...")

    def _handle_image_pull_end(self, event: PipelineEvent) -> None:
        assert isinstance(event, ImagePullEnd)
        if event.status == "SUCCESS":
            console.print("  [bold green]✔ Image pulled successfully.[/]")
        else:
            console.print("  [bold red]✖ Image pull failed.[/]")

    def _handle_image_build_start(self, event: PipelineEvent) -> None:
        assert isinstance(event, ImageBuildStart)
        console.print(
            f"  [bold]🛠️ Building image from {event.dockerfile_path} ({event.total_steps} steps)...[/]"
        )

    def _handle_image_build_progress(self, event: PipelineEvent) -> None:
        assert isinstance(event, ImageBuildProgress)
        console.print(f"    [dim]{event.line}[/]")

    def _handle_image_build_end(self, event: PipelineEvent) -> None:
        assert isinstance(event, ImageBuildEnd)
        if event.status == "SUCCESS":
            console.print("  [bold green]✔ Image built successfully.[/]")
        else:
            console.print("  [bold red]✖ Image build failed.[/]")

    def _handle_step_start(self, event: PipelineEvent) -> None:
        assert isinstance(event, StepStart)
        self.current_step = event.step
        console.print(f"\n[bold]▶️ Running Step: {event.step.name}[/]")
        console.print(f"  [cyan]Command:[/] {event.step.command}")

    def _handle_log_line(self, event: PipelineEvent) -> None:
        assert isinstance(event, LogLine)
        stream_color = "red" if event.stream == "stderr" else "dim"
        console.print(f"  [{stream_color}]{event.line.strip()}[/]")

    def _handle_step_end(self, event: PipelineEvent) -> None:
        assert isinstance(event, StepEnd)
        if event.status == "SUCCESS":
            console.print(f"[bold green]✔ Step '{event.step.name}' Succeeded[/]")
        else:
            style = "red" if event.status == "FAILURE" else "yellow"
            console.print(
                f"[bold {style}]✖ Step '{event.step.name}' Failed (Status: {event.status})[/]"
            )

    def _handle_debug_shell(self, event: PipelineEvent) -> None:
        assert isinstance(event, DebugShellStarting)
        _open_interactive_shell(event.container_id, event.step)

    def _handle_pipeline_end(self, event: PipelineEvent) -> None:
        assert isinstance(event, PipelineEnd)
        self.final_status = event.status


def _run_debug_mode(
    event_iterable: Iterable[PipelineEvent],
) -> str:
    """Handles pipeline execution with simple line-by-line output for debug mode."""
    ui_handler = DebugUI()
    for event in event_iterable:
        ui_handler.handle_event(event)
    return ui_handler.final_status


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
    ),
    debug: bool = typer.Option(
        False,
        "--debug",
        help="On failure of a manual run, keep the container alive and open a debug shell.",
    ),
) -> None:
    """
    Manually runs the CI pipeline based on the configuration file.
    """
    final_status = "FAILURE"  # Default status
    try:
        service = container.ci_execution_service
        event_generator = service.run(hook_type=hook_type, debug=debug)

        try:
            first_event = next(event_generator)
        except StopIteration:
            logger.info("Pipeline run was skipped based on configuration filters.")
            return

        all_events = chain([first_event], event_generator)

        if debug:
            final_status = _run_debug_mode(all_events)
        else:
            pipeline_ui = PipelineUI(console)
            with Live(
                pipeline_ui._get_display_group(),
                console=console,
                screen=False,
                redirect_stderr=False,
                vertical_overflow="visible",
            ) as live:
                for event in all_events:
                    pipeline_ui.handle_event(event, live)
                    if isinstance(event, PipelineEnd):
                        final_status = event.status

    except Exception as e:
        _handle_error(e)

    if final_status == "SUCCESS":
        console.print("\n[bold green]✅ Pipeline finished successfully![/bold green]")
    elif final_status == "WARNING":
        console.print(
            "\n[bold yellow]🔶 Pipeline finished with non-critical failures.[/bold yellow]"
        )
    else:  # FAILURE
        console.print("\n[bold red]❌ Pipeline failed.[/bold red]")
        raise typer.Exit(code=1)


@app.command()
def migrate() -> None:
    """
    Migrates the configuration file to the latest version.
    """
    try:
        logger.info("🔎 Checking configuration for migration...")
        service = container.migration_service
        success_message = service.run()
        console.print(f"\n[bold green]✅ {success_message}[/bold green]")

    except Exception as e:
        _handle_error(e)


def main() -> None:
    """
    The main entry point for the Typer application.
    """
    app()
