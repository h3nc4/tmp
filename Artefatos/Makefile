PLANTUML_CONFIG := ./config.plantuml
WSDS := $(shell find . -type f -name "*.wsd")
PNGS := $(WSDS:.wsd=.png)

all: $(PNGS)

%.png: %.wsd $(PLANTUML_CONFIG)
	plantuml -config $(PLANTUML_CONFIG) $<

clean:
	rm -f $(PNGS)

.PHONY: all clean
