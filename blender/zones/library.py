# Library / reading room: floor-to-ceiling shelves against the west wall, a
# rolling ladder, a wingback chair under a warm lamp, a rug, Edison bulbs.
# Warmer and quieter than the rest of the warehouse: it's the bridge into the
# /reading/ shelf app.
#
# Zone frame: origin (-8, 0, 0.5), facing +x (yaw 90°). Shelves run along
# local z = -1.9 (the west wall); the camera stands at local (0.5, 1.5, 2.4).

import math
import random

import os

import bpy
import numpy as np

from lib import OUT, Zone, emissive, join, mat, pbr, photo, hex_rgb

GROUPS = {
    'hero': {'size': 1024},  # shelves + books
    'env': {'size': 1024},   # floor, wall, chair, rug, ladder
}

BOOK_COLOURS = ['#5a1f1b', '#1f3a4a', '#2f4a2a', '#6b4a1f', '#3a2a4a', '#7a6a55', '#1d1d22', '#8a3a1a', '#24504f', '#b08a4a', '#7c2d2a', '#d8cfb8']


def build(quick=False):
    rnd = random.Random(412)
    z = Zone('library', origin=(-8.0, 0, 0.5), yaw=math.pi / 2)

    boards = pbr('l_boards', 'old_wood_floor', scale=2.0, tex=1024)
    plaster = pbr('l_wall', 'plastered_wall_04', scale=2.5, tint='#8a7a6a', tex=512)
    oak = pbr('l_oak', 'fine_grained_wood', scale=1.2, tex=512)
    dark_oak = pbr('l_oak_dark', 'dark_wood', scale=1.2, tex=512)
    brass = mat('l_brass', '#9a7a32', rough=0.35, metal=1.0)
    rug = pbr('l_rug', 'fabric_pattern_07', scale=1.2, tex=512)
    linen = mat('l_shade', '#e8d6b0', rough=0.9)
    spines = photo('l_spines', spine_atlas(), rough=0.7, tex=1024)
    covers = [mat(f'l_book_{i}', c, rough=0.7) for i, c in enumerate(BOOK_COLOURS)]

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
                book = z.box(f'book_{i}_{b}_{x:.3f}', (bw, bh, SD * (0.68 + rnd.random() * 0.2)),
                             (x + bw / 2 + (bh * 0.09 if lean else 0), y + 0.015 + bh / 2, zc + 0.03), rot=(0, 0, -lean),
                             material=spines, bake='hero')
                spine_uv(book.data, bw, bh, rnd.randrange(SPINES_X * SPINES_Y))
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
    z.model('reading_chair', 'ArmChair_01', (1.25, 0, 0.65), rot=(0, -0.65, 0), bake='env', max_tris=6000, tex=512)
    tx, tz = 2.0, 0.0
    z.model('side_table', 'side_table_tall_01', (tx, 0, tz), bake='env', tex=256)
    for i in range(3):
        z.book(f'table_book_{i}', (0.17, 0.035, 0.12), (tx - 0.05, 0.778 + 0.0175 + i * 0.036, tz + 0.04), rot=(0, rnd.random() * 0.5, 0), cover=covers[i * 4], bake='env')
    z.model('oil_lamp', 'vintage_oil_lamp', (tx + 0.08, 0.76, tz - 0.06), bake='env', tex=256)
    z.light('POINT', (tx + 0.08, 1.0, tz - 0.06), '#ffbf78', 55, size=0.05, name='reading_lamp')

    # SÁCH ("books") in teal neon over the shelves
    z.text('neon_sach', 'SÁCH', 0.8, (0, 4.85, -1.95), material=emissive('l_neon', '#2ad4c9', 7), tube=0.014, role='flicker')
    for x in (-0.9, 0.9):
        z.cyl(f'neon_sach_rod_{x}', 0.006, 3.5, (x, 6.6, -1.95), material=brass, bake='env', segs=6)

    # Edison bulbs hanging over the shelves
    bulb = emissive('edison', '#ffb15a', 10)
    for i, x in enumerate((-1.9, -0.3, 1.3)):
        y = 3.2 - (i % 2) * 0.35
        z.tube(f'edison_cord_{i}', [(x, y + 0.05, -0.6), (x, 8.0, -0.6)], 0.004, material=mat('l_cord', '#111111', rough=0.6), bake='env')
        z.cyl(f'edison_{i}', 0.035, 0.1, (x, y, -0.6), material=bulb, live=1, segs=12, r2=0.02)
        z.light('POINT', (x, y - 0.03, -0.6), '#ffb15a', 45, size=0.05, name=f'edison_{i}')

    z.light('AREA', (0, 4.6, 0.8), '#ffcf96', 160, size=(5, 2.5), aim=(0, 1.8, -1.9), name='shelf_wash')
    z.light('AREA', (1.5, 3.0, 3.0), '#24364d', 60, size=(3, 3), aim=(0, 1, -1), name='cool_fill')
    return z


SPINES_X, SPINES_Y = 16, 2


def spine_atlas(seed=412):
    """A sheet of 32 book spines: cloth or paper colour, head and tail bands,
    a title block with lines of 'type', a publisher mark, wear."""
    W, H = 1024, 512
    cw, ch = W // SPINES_X, H // SPINES_Y
    rng = np.random.default_rng(seed)
    img = np.zeros((H, W, 3), np.float32)
    lin = lambda h: np.array(hex_rgb(h)[:3], np.float32)
    inks = [lin('#e8d9a8'), lin('#c9a24a'), lin('#111111'), lin('#f0ece0')]
    for cy in range(SPINES_Y):
        for cx in range(SPINES_X):
            c = img[cy * ch:(cy + 1) * ch, cx * cw:(cx + 1) * cw]
            c[:] = lin(BOOK_COLOURS[rng.integers(len(BOOK_COLOURS))]) * (0.8 + 0.4 * rng.random())
            ink = inks[rng.integers(len(inks))]
            for y0 in (int(ch * 0.06), int(ch * 0.9)):  # head + tail bands
                if rng.random() < 0.7:
                    c[y0:y0 + max(2, int(ch * 0.025)), 4:-4] = ink
            if rng.random() < 0.5:  # a title panel
                c[int(ch * 0.18):int(ch * 0.62), 6:-6] = inks[rng.integers(len(inks))] * 0.9
                ink = lin('#151515') if ink.mean() > 0.3 else inks[0]
            for k in range(rng.integers(2, 4)):  # lines of type, running up the spine
                x = 12 + k * 12 + rng.integers(-2, 3)
                if x > cw - 10:
                    break
                y = int(ch * 0.22) + rng.integers(0, 10)
                while y < ch * 0.58:
                    ln = rng.integers(3, 9)
                    c[y:y + ln, x:x + 5] = ink
                    y += ln + rng.integers(1, 4)
            c[int(ch * 0.74):int(ch * 0.79), cw // 2 - 6:cw // 2 + 6] = ink  # publisher mark
            # rounded spine: darker at the edges; wear speckle
            edge = 0.65 + 0.35 * np.sin(np.linspace(0.15, np.pi - 0.15, cw))[None, :, None]
            c *= edge * (0.9 + 0.2 * rng.random((ch, cw, 1)))
    srgb = np.where(img <= 0.0031308, img * 12.92, 1.055 * np.power(np.clip(img, 0, 1), 1 / 2.4) - 0.055)
    out = bpy.data.images.new('l_spines', W, H, alpha=False)
    px = np.ones((H, W, 4), np.float32)
    px[..., :3] = srgb[::-1]  # Blender images start at the bottom row
    out.pixels.foreach_set(px.ravel())
    os.makedirs(OUT, exist_ok=True)
    out.filepath_raw = os.path.join(OUT, 'library_spines.png')
    out.file_format = 'PNG'
    out.save()
    return out.filepath_raw


def spine_uv(mesh, bw, bh, cell):
    """Map a book box onto one spine of the atlas (the spine faces +z)."""
    u0, v0 = (cell % SPINES_X) / SPINES_X, (cell // SPINES_X) / SPINES_Y
    uv = mesh.uv_layers['UVMap'].data
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co  # Blender: x, -z, y
            u = min(max(co.x / bw + 0.5, 0.02), 0.98)
            v = min(max(co.z / bh + 0.5, 0.0), 1.0)
            uv[li].uv = (u0 + u / SPINES_X, 1 - (v0 + (1 - v) / SPINES_Y))

