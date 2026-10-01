# spriteedge

One file, `spriteedge.py`, that finds the drawn outline of a sprite in pixel-art images (GIF, PNG, sprite sheets) exactly,
by colour, not by guessing. It needs Python 3.8+, Pillow and numpy (scipy is used if installed, never required).
Everything an AI or a person needs to use it is in the comment at the top of the file: copy that one file anywhere.

    python3 spriteedge.py boar.gif --suggest                       # which colours look like backdrop and shadow
    python3 spriteedge.py boar.gif --outside 99,99,99 49,49,49     # frame 0 -> boar_edge/ (original, border in red, cutout, masks, report)
    python3 spriteedge.py boar.gif --outside 99,99,99 49,49,49 --frames all
    python3 spriteedge.py --self-test

How it decides: the outside is the backdrop colour plus any flat shadow colour you name; the sprite is everything else; the
boundary is the sprite pixels touching the outside; the border is the boundary pixels that are dark ink. Pale boundary pixels
(drool, a tusk tip with no black edge) are reported as skipped and never recoloured. Dark lines inside the sprite are never touched.

Limits: JPEG, blurred or anti-aliased art needs `--tolerance` and is approximate (see the numbers in the file). A soft gradient
shadow cannot be separated. The test is `tests/test_spriteedge.py` (or `--self-test`).
