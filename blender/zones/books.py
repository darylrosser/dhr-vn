# Shelves of books: a bookcase filled with spines from a generated atlas
# (cloth and paper colours, bands, title blocks, wear), one draw call for all.

import math
import os

import bpy
import numpy as np

from lib import OUT, hex_rgb, join, photo

BOOK_COLOURS = ['#5a1f1b', '#1f3a4a', '#2f4a2a', '#6b4a1f', '#3a2a4a', '#7a6a55', '#1d1d22', '#8a3a1a', '#24504f', '#b08a4a', '#7c2d2a', '#d8cfb8']


def bookcase(z, rnd, wood, bays=2, bay_w=1.3, height=2.6, depth=0.38, levels=6, name='bookcase', **tags):
    """A bookcase in z's frame: its back on local z = -depth/2, facing +z,
    centred on x = 0. The frame is one object carrying the tags (the hotspot);
    the books join the rest of the bake group."""
    spines = photo('spines', spine_atlas(), rough=0.7, tex=1024)
    x0 = -bays * bay_w / 2
    frame = []
    for b in range(bays + 1):
        frame.append(z.box(f'{name}_side_{b}', (0.05, height, depth), (x0 + b * bay_w, height / 2, 0), material=wood, bake='hero', bevel=0.005))
    frame.append(z.box(f'{name}_back', (bays * bay_w, height, 0.02), (0, height / 2, -depth / 2), material=wood, bake='hero'))
    frame.append(z.box(f'{name}_crown', (bays * bay_w + 0.12, 0.08, depth + 0.06), (0, height + 0.04, 0.02), material=wood, bake='hero', bevel=0.01))
    level_h = (height - 0.12) / levels
    for i in range(levels + 1):
        y = 0.1 + i * level_h
        frame.append(z.box(f'{name}_shelf_{i}', (bays * bay_w, 0.03, depth), (0, y, 0), material=wood, bake='hero'))
        if i == levels:
            continue
        for b in range(bays):
            x = x0 + b * bay_w + 0.04
            end = x0 + (b + 1) * bay_w - 0.04
            while x < end - 0.03:
                if rnd.random() < 0.04:  # the odd gap
                    x += 0.06 + rnd.random() * 0.14
                    continue
                bw = 0.022 + rnd.random() * 0.04
                if x + bw > end:
                    break
                bh = level_h * (0.6 + rnd.random() * 0.28)
                lean = 0.18 if rnd.random() < 0.04 else 0.0
                book = z.box(f'{name}_book_{i}_{b}_{x:.3f}', (bw, bh, depth * (0.68 + rnd.random() * 0.2)),
                             (x + bw / 2 + (bh * 0.09 if lean else 0), y + 0.015 + bh / 2, 0.03), rot=(0, 0, -lean),
                             material=spines, bake='hero')
                spine_uv(book.data, bw, bh, rnd.randrange(SPINES_X * SPINES_Y))
                x += bw + (0.012 if lean else 0.0015)
    obj = join(frame, name)
    for k, v in tags.items():
        obj[k] = v
    return obj


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
    out = bpy.data.images.new('spines', W, H, alpha=False)
    px = np.ones((H, W, 4), np.float32)
    px[..., :3] = srgb[::-1]  # Blender images start at the bottom row
    out.pixels.foreach_set(px.ravel())
    os.makedirs(OUT, exist_ok=True)
    out.filepath_raw = os.path.join(OUT, 'spines.png')
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

