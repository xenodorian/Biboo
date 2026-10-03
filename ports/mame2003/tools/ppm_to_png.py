#!/usr/bin/env python3
"""PPM (P6) to PNG, stdlib only."""
import struct
import sys
import zlib
from pathlib import Path


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def main() -> None:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    data = src.read_bytes()
    if not data.startswith(b"P6\n"):
        sys.exit("not a P6 ppm")
    rest = data[3:]
    header, _, body = rest.partition(b"\n255\n")
    w_s, h_s = header.split()
    w, h = int(w_s), int(h_s)
    if len(body) != w * h * 3:
        sys.exit(f"ppm body {len(body)} != {w * h * 3}")
    raw = b"".join(b"\x00" + body[y * w * 3:(y + 1) * w * 3] for y in range(h))
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    dst.write_bytes(png)
    print(f"wrote {dst} ({len(png)} bytes)")


if __name__ == "__main__":
    main()
