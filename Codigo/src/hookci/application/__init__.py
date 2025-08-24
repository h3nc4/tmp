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
The application layer package.

This package orchestrates the application's use cases by coordinating the
domain and infrastructure layers. It acts as an intermediary, translating
user actions from the presentation layer into a sequence of operations.

Application services within this package implement the logic for specific
features without containing core business rules or direct infrastructure
access details, thus decoupling the high-level policy from the low-level
implementation.
"""
