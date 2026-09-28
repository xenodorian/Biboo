"""The move library: every animation the character has, with the controller input for each.

Inputs use the Dreamcast pad names (A, B, X, Y, L, R, Up, Down, Left, Right). '+' means pressed
together; '-' means pressed in sequence.
"""
from . import noncombat, basic, combos


def all_moves():
    out = []
    for mod in (noncombat, basic, combos):
        out += [f() for f in mod.ALL]
    return out
