#!/usr/bin/env python3
"""Copy this driver into a mame2003-plus-libretro checkout and register it.

    python3 ports/mame2003/tools/install_driver.py /path/to/mame2003-plus-libretro

Rebuilds the hash line's home only. Run `make -C ports/mame2003/game rom` first
so driver/rom_load.inc matches roms/parryperry.zip. Then build the core.
"""
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
FILES = ["parryperry.c", "fbdraw.c", "fbdraw.h", "font8x8_basic.h", "rom_load.inc"]
MARKER = "/* Biboo: Parry Perry */"
MAKE_MARK = "# Biboo: Parry Perry driver\n"


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: install_driver.py MAME2003_PLUS_ROOT")
    root = Path(sys.argv[1]).resolve()
    drivers = root / "src" / "drivers"
    driver_c = root / "src" / "driver.c"
    makefile = root / "Makefile.common"
    for p in (drivers, driver_c, makefile):
        if not p.exists():
            sys.exit(f"not a mame2003-plus tree, missing {p}")
    for name in FILES:
        src = HERE / "driver" / name
        if not src.exists():
            sys.exit(f"missing {src}, build the ROM first so rom_load.inc exists")
        shutil.copy2(src, drivers / name)
        print(f"copied {name}")

    text = driver_c.read_text()
    if "DRIVER( parryperry )" not in text and "DRIVER(parryperry)" not in text:
        matches = list(re.finditer(r"#endif\s*/\*\s*DRIVER_RECURSIVE\s*\*/", text))
        if not matches:
            sys.exit("could not find the driver list footer in src/driver.c")
        at = matches[-1].start()
        line = MARKER + "\nDRIVER( parryperry )\t/* 2026 homebrew */\n"
        text = text[:at] + line + text[at:]
        driver_c.write_text(text)
        print("registered DRIVER( parryperry )")
    else:
        print("driver.c already lists parryperry")

    make = makefile.read_text()
    if "drivers/parryperry.c" not in make:
        make += (
            "\n" + MAKE_MARK
            + "SOURCES_C += $(CORE_DIR)/drivers/parryperry.c $(CORE_DIR)/drivers/fbdraw.c\n"
        )
        makefile.write_text(make)
        print("added sources to Makefile.common")
    else:
        print("Makefile.common already builds parryperry")


if __name__ == "__main__":
    main()
