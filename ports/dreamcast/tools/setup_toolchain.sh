#!/bin/bash
# Sets up everything needed to build and test the Dreamcast port on Ubuntu 24.04 (what the sandbox runs).
# ON-DEMAND ONLY: nothing here is part of the permanent pipeline (see ../README.md).
#   1. SH-4 cross compiler and disc image tool dependencies (apt)
#   2. mkdcdisc (builds the .cdi disc image), built from source into /usr/local/bin
#   3. Flycast (the emulator) built from source into $FLYCAST_DIR/flycast/build/flycast (about 30 to 60 minutes on 4 cores)
# Usage: ports/dreamcast/tools/setup_toolchain.sh [work dir]      (default work dir /tmp/dcwork)
set -e
WORK="${1:-/tmp/dcwork}"; mkdir -p "$WORK"; cd "$WORK"
apt-get install -y -qq gcc-sh-elf binutils-sh-elf libnewlib-sh-elf-dev meson ninja-build pkg-config libisofs-dev git build-essential cmake
if ! command -v mkdcdisc >/dev/null; then
  [ -d mkdcdisc ] || git clone https://gitlab.com/simulant/mkdcdisc.git
  (cd mkdcdisc && meson setup build >/dev/null && meson compile -C build >/dev/null && cp build/mkdcdisc /usr/local/bin/)
fi
echo "mkdcdisc: $(command -v mkdcdisc)"; echo "sh-elf-gcc: $(sh-elf-gcc --version | head -1)"
if [ "${BUILD_FLYCAST:-1}" = 1 ] && [ ! -x "$WORK/flycast/build/flycast" ]; then
  apt-get install -y -qq libasound2-dev libpulse-dev libegl1-mesa-dev libgl1-mesa-dev libudev-dev libzip-dev libcurl4-openssl-dev zlib1g-dev libsdl2-dev libxi-dev libxext-dev libxrandr-dev libx11-dev libxcursor-dev libxinerama-dev libglu1-mesa-dev libgles2-mesa-dev libwayland-dev libxkbcommon-dev xvfb xdotool imagemagick
  [ -d flycast ] || git clone https://github.com/flyinghead/flycast.git
  (cd flycast && git checkout ea087b9 && git submodule update --init --recursive && mkdir -p build && cd build && cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DUSE_HOST_LIBZIP=ON -DUSE_VULKAN=OFF .. && ninja -j"$(nproc)")
fi
echo "flycast: $WORK/flycast/build/flycast"
