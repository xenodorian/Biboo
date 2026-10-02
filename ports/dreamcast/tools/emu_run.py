#!/usr/bin/env python3
"""Run a Dreamcast disc image in Flycast on a virtual screen, press keys, take screenshots. ON-DEMAND tool (see ../README.md).

    python3 ports/dreamcast/tools/emu_run.py ports/dreamcast/parryperry.cdi --out /tmp/dcshots \
        --script "3:shot:boot;4:key:Right:600;5:shot:right;6:key:x:100;7:shot:attack" --seconds 9

Script items are separated by ';' and each is  SECONDS:shot:NAME  or  SECONDS:key:KEY:HOLD_MS  (KEY is an xdotool key name:
Right Left Up Down Return, or x c s d for the Dreamcast A B X Y buttons of Flycast's default keyboard map; f and v are the
left and right triggers). Times count from the moment the emulator window appeared.

Needs: Xvfb, xdotool, Pillow, and a Flycast binary (default /tmp/dcwork/flycast/build/flycast, or --flycast PATH, or the
FLYCAST environment variable). Audio is turned off (SDL_AUDIODRIVER=dummy). Config and saves live in a throw-away HOME,
so every run starts clean (no memory card, no settings), unless --home DIR is given.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time

DISPLAY = ':97'
CFG = """[config]
Dreamcast.Cable = 3
Dreamcast.Region = 1
Dreamcast.Broadcast = 0
pvr.rend = 0
rend.Resolution = 480
UploadCrashLogs = no
PerGameVmu = no
autoload = no
[window]
fullscreen = no
width = 640
height = 480
maximized = no
[audio]
backend = auto
disable = yes
"""


def sh(cmd, **kw):
    return subprocess.run(cmd, shell=isinstance(cmd, str), **kw)


def run(cdi, out, script, seconds, flycast, home=None, size=(640, 480), keep=False, audio=None):
    from PIL import ImageGrab
    os.makedirs(out, exist_ok=True)
    tmp = home or tempfile.mkdtemp(prefix='dcemu_')
    cfgdir = os.path.join(tmp, '.config', 'flycast'); os.makedirs(cfgdir, exist_ok=True)
    os.makedirs(os.path.join(tmp, '.local', 'share', 'flycast'), exist_ok=True)       # Flycast makes no memory card if this is missing
    cfgpath = os.path.join(cfgdir, 'emu.cfg')
    if not os.path.exists(cfgpath):
        cfg = CFG.replace('width = 640', f'width = {size[0]}').replace('height = 480', f'height = {size[1]}')
        if audio:                                                  # record the sound: SDL's disk audio driver writes the raw output to a file
            cfg = cfg.replace('backend = auto', 'backend = SDL2').replace('disable = yes', 'disable = no')
        open(cfgpath, 'w').write(cfg)
    env = dict(os.environ, HOME=tmp, XDG_CONFIG_HOME=os.path.join(tmp, '.config'), XDG_DATA_HOME=os.path.join(tmp, '.local', 'share'),
               DISPLAY=DISPLAY, SDL_AUDIODRIVER='disk' if audio else 'dummy', LIBGL_ALWAYS_SOFTWARE='1', SDL_VIDEODRIVER='x11')
    if audio:
        env['SDL_DISKAUDIOFILE'] = os.path.abspath(audio)
    xvfb = subprocess.Popen(['Xvfb', DISPLAY, '-screen', '0', f'{size[0] + 64}x{size[1] + 64}x24', '-nolisten', 'tcp'],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.5)
    log = open(os.path.join(out, 'flycast.log'), 'w')
    emu = subprocess.Popen([flycast, os.path.abspath(cdi)], env=env, stdout=log, stderr=subprocess.STDOUT)
    t0 = time.time()
    shots = []
    try:
        # wait for the emulator window
        for _ in range(60):
            r = subprocess.run(['xdotool', 'search', '--onlyvisible', '--name', '.'], env=env, capture_output=True, text=True)
            if r.stdout.strip():
                break
            time.sleep(0.5)
        t0 = time.time()
        events = []
        for item in [s for s in script.split(';') if s.strip()]:
            p = item.strip().split(':')
            events.append((float(p[0]), p[1], p[2:]))
        events.sort(key=lambda e: e[0])
        for t, kind, args in events:
            while time.time() - t0 < t:
                time.sleep(0.02)
            if emu.poll() is not None:
                print('emulator exited early with code', emu.returncode); break
            if kind == 'shot':
                im = ImageGrab.grab(xdisplay=DISPLAY)
                path = os.path.join(out, args[0] + '.png'); im.save(path); shots.append(path)
            elif kind == 'chord':                                  # SEC:chord:Right+x+f:HOLD_MS : all keys down together, then all up
                keys, hold = args[0].split('+'), int(args[1]) if len(args) > 1 else 100
                for k in keys: subprocess.run(['xdotool', 'keydown', k], env=env)
                time.sleep(hold / 1000.0)
                for k in keys: subprocess.run(['xdotool', 'keyup', k], env=env)
            elif kind == 'seq':                                    # SEC:seq:Down,Right,x:GAP_MS : tap each key in turn (a key may be a+b for a chord step)
                steps, gap = args[0].split(','), int(args[1]) if len(args) > 1 else 120
                for st in steps:
                    ks = st.split('+')
                    for k in ks: subprocess.run(['xdotool', 'keydown', k], env=env)
                    time.sleep(0.04)
                    for k in ks: subprocess.run(['xdotool', 'keyup', k], env=env)
                    time.sleep(gap / 1000.0)
            elif kind == 'key':
                key, hold = args[0], int(args[1]) if len(args) > 1 else 100
                subprocess.run(['xdotool', 'keydown', key], env=env); time.sleep(hold / 1000.0)
                subprocess.run(['xdotool', 'keyup', key], env=env)
        while time.time() - t0 < seconds and emu.poll() is None:
            time.sleep(0.1)
    finally:
        emu.terminate()
        try:
            emu.wait(timeout=5)
        except Exception:
            emu.kill()
        xvfb.terminate()
        log.close()
        if not keep and not home:
            shutil.rmtree(tmp, ignore_errors=True)
    return shots


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cdi')
    ap.add_argument('--out', default='/tmp/dcshots')
    ap.add_argument('--script', default='3:shot:boot')
    ap.add_argument('--seconds', type=float, default=6)
    ap.add_argument('--flycast', default=os.environ.get('FLYCAST', '/tmp/dcwork/flycast/build/flycast'))
    ap.add_argument('--home', help='keep config and memory card in this folder between runs')
    ap.add_argument('--size', default='640x480')
    ap.add_argument('--keep', action='store_true')
    ap.add_argument('--audio', help='record the emulator sound to this raw file (signed 16 bit stereo, 44100 Hz) with SDL\'s disk audio driver')
    a = ap.parse_args()
    if not os.path.exists(a.flycast):
        sys.exit(f'Flycast not found at {a.flycast} (see tools/setup_toolchain.sh)')
    w, h = (int(v) for v in a.size.split('x'))
    for p in run(a.cdi, a.out, a.script, a.seconds, a.flycast, a.home, (w, h), a.keep, a.audio):
        print('wrote', p)


if __name__ == '__main__':
    main()
