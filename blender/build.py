# Build warehouse zones: model, bake, export a raw GLB per zone into out/.
#
#   python blender/build.py deck [board ...] [--quick]
#
# Run with the Python that has the `bpy` module (pip install bpy==5.2.3, a
# Python 3.13 venv outside the repo). Then `node blender/pack.mjs` compresses
# out/*.glb into src/models/. --quick bakes tiny, noisy maps for layout checks.

import importlib
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lib  # noqa: E402

ZONES = ['hall', 'deck', 'board', 'library', 'lounge', 'garage', 'gym']


def run(name, quick):
    t = time.time()
    print(f'[{name}]', flush=True)
    mod = importlib.import_module(f'zones.{name}')
    lib.reset(quick)
    lib._mats.clear()
    mod.build(quick)
    lib.bake_zone(name, mod.GROUPS, quick)
    lib.join_live(name)
    lib.export(name)
    print(f'[{name}] done in {time.time() - t:.0f}s', flush=True)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    quick = '--quick' in sys.argv
    for name in args or ZONES:
        run(name, quick)
