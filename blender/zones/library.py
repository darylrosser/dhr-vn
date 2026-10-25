# Library / reading room: floor-to-ceiling shelves against the west wall, a
# rolling ladder, a wingback chair under a warm lamp, a rug, Edison bulbs.
# Warmer and quieter than the rest of the warehouse: it's the bridge into the
# /reading/ shelf app.
#
# Zone frame: origin (-8, 0, 0.5), facing +x (yaw 90°). Shelves run along
# local z = -1.9 (the west wall); the camera stands at local (0.5, 1.5, 2.4).

import math
import random

from lib import Zone, mat, emissive, join

GROUPS = {
    'hero': {'size': 2048, 'exposure': 1.5},  # shelves + books
    'env': {'size': 2048, 'exposure': 1.5},   # floor, wall, chair, rug, ladder
}

BOOK_COLOURS = ['#5a1f1b', '#1f3a4a', '#2f4a2a', '#6b4a1f', '#3a2a4a', '#7a6a55', '#1d1d22', '#8a3a1a', '#24504f', '#b08a4a', '#7c2d2a', '#d8cfb8']


def build(quick=False):
    rnd = random.Random(412)
    z = Zone('library', origin=(-8.0, 0, 0.5), yaw=math.pi / 2)

    boards = mat('l_boards', '#5a3d27', '#2b1c12', scale=9, pattern='stripes', coords='Object', stretch=(1, 0, 0))
    plaster = mat('l_wall', '#3a3029', '#1d1814', noise=0.4, scale=2, detail=8)
    oak = mat('l_oak', '#5c3f27', '#2f1f12', scale=3, pattern='wood', stretch=(1, 1, 8))
    dark_oak = mat('l_oak_dark', '#3a2617', '#1c120a', scale=3, pattern='wood', stretch=(1, 1, 8))
    brass = mat('l_brass', '#9a7a32', '#4a3612', noise=0.3, scale=30)
    leather = mat('l_leather', '#5a2a18', '#2a120a', noise=0.45, scale=14)
    rug = mat('l_rug', '#5a1a16', '#1c2440', noise=0.0, scale=7, pattern='wood', coords='Object', stretch=(1, 3, 1))
    linen = mat('l_shade', '#e8d6b0')
    covers = [mat(f'l_book_{i}', c, '#e6dcc4' if i % 3 == 0 else None, noise=0.0, scale=1, pattern='stripes' if i % 3 == 0 else None,
                  coords='Generated', stretch=(0, 0, 30)) for i, c in enumerate(BOOK_COLOURS)]

    # ------------------------------------------------------------ room (env)
    z.box('floor', (6.4, 0.1, 4.6), (0, -0.05, 0.3), material=boards, bake='env', texel=0.6)
    z.box('wall', (6.8, 6.0, 0.3), (0, 3.0, -2.35), material=plaster, bake='env', texel=0.5)
    z.box('rug', (3.0, 0.012, 2.0), (0.6, 0.006, 0.6), rot=(0, 0.1, 0), material=rug, bake='env')

    # ------------------------------------------------------------ shelves (hero): 4 bays, floor to 4.2 m
    BAYS, BW, SD, SH, LEVELS = 4, 1.35, 0.38, 4.2, 9
    x0 = -BAYS * BW / 2
    zc = -1.9
    frame = []
    for b in range(BAYS + 1):
        frame.append(z.box(f'shelf_side_{b}', (0.05, SH, SD), (x0 + b * BW, SH / 2, zc), material=dark_oak, bake='hero', bevel=0.005))
    frame.append(z.box('shelf_back', (BAYS * BW, SH, 0.02), (0, SH / 2, zc - SD / 2), material=dark_oak, bake='hero'))
    frame.append(z.box('shelf_crown', (BAYS * BW + 0.2, 0.14, SD + 0.12), (0, SH + 0.07, zc + 0.04), material=oak, bake='hero', bevel=0.02))
    frame.append(z.box('shelf_plinth', (BAYS * BW + 0.1, 0.12, SD + 0.06), (0, 0.06, zc + 0.02), material=oak, bake='hero', bevel=0.01))
    level_h = (SH - 0.2) / LEVELS
    for i in range(LEVELS + 1):
        y = 0.12 + i * level_h
        frame.append(z.box(f'shelf_{i}', (BAYS * BW, 0.03, SD), (0, y, zc), material=oak, bake='hero'))
        if i == LEVELS:
            continue
        for b in range(BAYS):
            x = x0 + b * BW + 0.04
            end = x0 + (b + 1) * BW - 0.04
            while x < end - 0.03:
                if rnd.random() < 0.03:  # the odd gap, a book lying flat
                    x += 0.06 + rnd.random() * 0.12
                    continue
                bw = 0.022 + rnd.random() * 0.04
                if x + bw > end:
                    break
                bh = level_h * (0.62 + rnd.random() * 0.28)
                lean = 0.18 if rnd.random() < 0.04 else 0.0
                z.box(f'book_{i}_{b}_{x:.3f}', (bw, bh, SD * (0.68 + rnd.random() * 0.2)),
                      (x + bw / 2 + (bh * 0.09 if lean else 0), y + 0.015 + bh / 2, zc + 0.03), rot=(0, 0, -lean),
                      material=covers[rnd.randrange(len(covers))], bake='hero')
                x += bw + (0.012 if lean else 0.0015)
    # the frame is one clickable object (the books join the rest after baking)
    shelves = join(frame, 'shelves')
    shelves['hotspot'] = 'reading'

    # brass rail + rolling ladder leaning on it
    z.cyl('ladder_rail', 0.015, BAYS * BW, (0, 3.3, zc + 0.3), rot=(0, 0, math.pi / 2), material=brass, bake='env', segs=10)
    lx, top_y, foot = 0.9, 3.3, 0.95
    rail_z = zc + 0.32
    lean = math.atan2(foot, top_y)
    for sx in (-0.22, 0.22):
        z.box(f'ladder_side_{sx}', (0.05, math.hypot(foot, top_y) + 0.1, 0.06), (lx + sx, top_y / 2, rail_z + foot / 2), rot=(-lean, 0, 0), material=oak, bake='env', bevel=0.006)
    for r in range(11):
        h = 0.25 + r * 0.3
        z.cyl(f'ladder_rung_{r}', 0.014, 0.44, (lx, h, rail_z + foot * (1 - h / top_y)), rot=(0, 0, math.pi / 2), material=oak, bake='env', segs=8)
    z.cyl('ladder_hook', 0.02, 0.5, (lx, 3.3, zc + 0.32), rot=(0, 0, math.pi / 2), material=brass, bake='env', segs=8)

    # ------------------------------------------------------------ wingback chair, side table, lamp
    cx, cz, cyaw = 1.25, 0.65, -0.65
    def part(name, size, local, rot=(0, 0, 0), bevel=0.04, m=leather):
        lx_, ly_, lz_ = local
        c, s = math.cos(cyaw), math.sin(cyaw)
        z.box(name, size, (cx + lx_ * c + lz_ * s, ly_, cz - lx_ * s + lz_ * c), rot=(rot[0], cyaw + rot[1], rot[2]), material=m, bake='env', bevel=bevel)
    part('chair_seat', (0.66, 0.18, 0.62), (0, 0.38, 0.02))
    part('chair_back', (0.7, 0.85, 0.16), (0, 0.85, -0.3), rot=(-0.12, 0, 0))
    for sx in (-1, 1):
        part(f'chair_arm_{sx}', (0.14, 0.32, 0.66), (0.37 * sx, 0.55, 0.0))
        part(f'chair_wing_{sx}', (0.1, 0.42, 0.26), (0.36 * sx, 1.02, -0.2), rot=(0, 0.3 * sx, 0))
        for fz in (-0.25, 0.25):
            part(f'chair_foot_{sx}_{fz}', (0.05, 0.16, 0.05), (0.28 * sx, 0.08, fz), bevel=0.01, m=dark_oak)
    part('chair_cushion', (0.56, 0.08, 0.5), (0, 0.5, 0.06), bevel=0.035)

    tx, tz = 2.0, 0.0
    z.cyl('side_table', 0.25, 0.03, (tx, 0.58, tz), material=oak, bake='env', segs=32, bevel=0.006)
    z.cyl('side_table_leg', 0.03, 0.56, (tx, 0.29, tz), material=dark_oak, bake='env', segs=12)
    z.cyl('side_table_foot', 0.18, 0.025, (tx, 0.013, tz), material=dark_oak, bake='env', segs=24)
    for i in range(3):
        z.box(f'table_book_{i}', (0.17, 0.035, 0.12), (tx - 0.05, 0.615 + i * 0.036, tz + 0.04), rot=(0, rnd.random() * 0.5, 0), material=covers[i * 4], bake='env', bevel=0.003)
    z.cyl('lamp_base', 0.07, 0.03, (tx + 0.1, 0.61, tz - 0.08), material=brass, bake='env', segs=16)
    z.cyl('lamp_stem', 0.01, 0.42, (tx + 0.1, 0.83, tz - 0.08), material=brass, bake='env', segs=8)
    z.cyl('lamp_shade', 0.16, 0.2, (tx + 0.1, 1.08, tz - 0.08), material=linen, bake='env', r2=0.11, cap=False, segs=24)
    z.cyl('lamp_bulb', 0.03, 0.05, (tx + 0.1, 1.04, tz - 0.08), material=emissive('l_bulb', '#ffcf8a', 8), live=1, segs=12)
    z.light('POINT', (tx + 0.1, 1.05, tz - 0.08), '#ffbf78', 55, size=0.08, name='reading_lamp')

    # Edison bulbs hanging over the shelves
    bulb = emissive('edison', '#ffb15a', 10)
    for i, x in enumerate((-1.9, -0.3, 1.3)):
        y = 3.2 - (i % 2) * 0.35
        z.tube(f'edison_cord_{i}', [(x, y + 0.05, -0.6), (x, 8.0, -0.6)], 0.004, material=mat('l_cord', '#111111'), bake='env')
        z.cyl(f'edison_{i}', 0.035, 0.1, (x, y, -0.6), material=bulb, live=1, segs=12, r2=0.02)
        z.light('POINT', (x, y - 0.03, -0.6), '#ffb15a', 45, size=0.05, name=f'edison_{i}')

    z.light('AREA', (0, 4.6, 0.8), '#ffcf96', 160, size=(5, 2.5), aim=(0, 1.8, -1.9), name='shelf_wash')
    z.light('AREA', (1.5, 3.0, 3.0), '#24364d', 60, size=(3, 3), aim=(0, 1, -1), name='cool_fill')
    return z
