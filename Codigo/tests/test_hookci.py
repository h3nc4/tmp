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
Tests for the main executable entry point.
"""

import runpy
from unittest.mock import patch


def test_main_entry_point() -> None:
    """
    Verify that executing the main script calls the CLI's main function.
    """
    with patch("hookci.presentation.cli.main") as mock_main:
        # Using runpy to execute the script in a way that __name__ == "__main__"
        runpy.run_path("src/hookci.py", run_name="__main__")
    mock_main.assert_called_once()
