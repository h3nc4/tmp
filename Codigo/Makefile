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

include config.mk

DATE := $(shell date -R)

WSDS := $(shell find $(DOC_SOURCE) -type f -name "*.wsd" | sed 's|^$(DOC_SOURCE)||')
PNGS := $(addprefix $(DOC_OUTPUT), $(WSDS:.wsd=.png))

SRC_FILES := $(shell find src -type f)

SUITE ?=

all: hookci

debian/changelog:
	@echo "$(PACKAGE) ($(VERSION)) $(SUITE); urgency=medium\n\n  * Release for $(SUITE)\n\n -- $(DEBFULLNAME) <$(DEBEMAIL)>  $(DATE)\n" > debian/changelog

src/_version.py:
	@echo "__version__ = '$(VERSION)'" > src/_version.py

deb: $(SRC_FILES)
ifeq ($(SUITE),)
	@for suite in unstable testing stable; do \
		$(MAKE) deb SUITE=$$suite; \
	done
else
	$(MAKE) debian/changelog
	$(MAKE) src/_version.py
	dpkg-buildpackage -us -uc -b
	mv ../$(PACKAGE)_$(VERSION)_all.deb ../$(PACKAGE)_$(VERSION)_$(SUITE)_all.deb
	mv ../$(PACKAGE)_$(VERSION)_amd64.changes ../$(PACKAGE)_$(VERSION)_$(SUITE)_amd64.changes
	mv ../$(PACKAGE)_$(VERSION)_amd64.buildinfo ../$(PACKAGE)_$(VERSION)_$(SUITE)_amd64.buildinfo
	rm -f src/_version.py debian/changelog 
endif

hookci: $(SRC_FILES) src/_version.py
	pyinstaller --exclude-module=pkg_resources --exclude-module=setuptools --onefile src/hookci.py
	mv -f dist/hookci .
	rm -f src/_version.py

docs: $(PNGS)

$(DOC_OUTPUT)%.png: $(DOC_SOURCE)%.wsd $(PLANTUML_CONFIG)
	@mkdir -p $(dir $@)
	plantuml -config $(PLANTUML_CONFIG) $<
	@mv $(dir $<)/$(notdir $@) $@

clean:
	rm -rf build/ dist/ hookci.spec \
		debian/.debhelper/ debian/$(PACKAGE)/ debian/debhelper-build-stamp debian/files debian/hookci.substvars

.PHONY: all deb docs clean
