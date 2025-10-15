#!/bin/sh
#
# Copyright (C) 2025  Henrique Almeida
# This file is part of WASudoku.
#
# WASudoku is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# WASudoku is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with WASudoku.  If not, see <https://www.gnu.org/licenses/>.

# Called by CI to update version numbers in various files based on the Git tag.
VERSION=${1#v}
sed -i 's/"version": ".*"/"version": "'"$VERSION"'"/' package.json
sed -i 's/sonar.projectVersion=.*/sonar.projectVersion='"$VERSION"'/' sonar-project.properties
sed -i 's/version = ".*"/version = "'"$VERSION"'"/' src/wasudoku-wasm/Cargo.toml
