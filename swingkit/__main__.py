"""Command line: python -m swingkit [--out DIR] [--scales 3 1] [--no-check] [--no-moves]"""
import argparse
import sys
from pathlib import Path

from .paths import OUT
from . import build, checks


def main(argv=None):
    ap = argparse.ArgumentParser(prog='swingkit', description='Build the greatsword swing scene and animation.')
    ap.add_argument('--out', type=Path, default=OUT, help='output folder (default: ./out)')
    ap.add_argument('--scales', type=int, nargs='+', default=[3, 1], help='GIF integer scales to write')
    ap.add_argument('--no-check', action='store_true', help='skip the consistency checks')
    ap.add_argument('--no-moves', action='store_true', help='skip the move library (out/moves)')
    a = ap.parse_args(argv)
    frames = build.build(a.out, scales=a.scales)
    if not a.no_moves:
        from . import movekit
        movekit.build_all(a.out)
    if a.no_check:
        return 0
    results = checks.run_all(frames, [(a.out / f'swing_x{s}.gif', s) for s in a.scales])
    failed = 0
    for name, (ok, msg) in results:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {msg}")
        failed += not ok
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
