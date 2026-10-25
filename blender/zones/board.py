# Evidence board: the case file on Daryl. A rolling cork board with photos,
# index cards and red string, the folder on a side table under a banker's
# lamp, and a Voight-Kampff machine on its cart. /about/ lives here.
#
# Zone frame: origin (7.5, 0, 1.0), facing -x (yaw -90°), against the east
# wall. Local +z points at the camera; the board stands at the origin.

import math
import random

from lib import Zone, mat, emissive

GROUPS = {
    'hero': {'size': 2048, 'exposure': 1.6},
    'env': {'size': 1024, 'exposure': 1.6},
}


def build(quick=False):
    rnd = random.Random(7)
    z = Zone('board', origin=(7.5, 0, 1.0), yaw=-math.pi / 2)

    concrete = mat('b_floor', '#3e3f42', '#18191b', noise=0.45, scale=0.6, detail=10)
    brick = mat('b_brick', '#2e2724', '#151211', scale=2.2, pattern='tiles')
    steel = mat('b_steel', '#3a3d44', '#1d1f24', noise=0.3, scale=8)
    dark = mat('b_dark', '#1c1d21', '#0d0d0f', noise=0.25, scale=20)
    cork = mat('cork', '#7a5634', '#4a321d', noise=0.6, scale=60, detail=4)
    manila = mat('manila', '#c9a86a', '#a8874e', noise=0.3, scale=12)
    photo = mat('photo', '#5a5852', '#1e1d1b', noise=0.5, scale=9)
    photo2 = mat('photo_warm', '#6b5a48', '#2a2018', noise=0.55, scale=7)
    card = mat('index_card', '#e8e2d4', '#9fb4c8', scale=40, pattern='stripes', coords='Generated', stretch=(0, 0, 1))
    paper = mat('b_paper', '#ddd5c4', '#b8ae99', noise=0.2, scale=30)
    sticky = mat('sticky', '#e8cf4a')
    mapm = mat('map', '#b8b49a', '#6a7a6a', noise=0.55, scale=5, detail=12)
    red_ink = mat('red_ink', '#9a1c18')
    green = mat('banker_green', '#1f5a3a', '#0f2e1d', noise=0.3, scale=20)
    brass = mat('brass', '#8a6a2a', '#4a3612', noise=0.3, scale=30)
    wood = mat('b_wood', '#3b2a1c', '#21170f', scale=3, pattern='wood', stretch=(1, 1, 8))

    # ------------------------------------------------------------ floor + wall (env)
    z.box('floor', (5.0, 0.1, 4.0), (0, -0.05, 0.0), material=concrete, bake='env')
    z.box('wall', (6.0, 5.0, 0.3), (0, 2.5, -2.75), material=brick, bake='env', texel=0.6)
    for y in (3.9, 4.15):
        z.cyl(f'pipe_{y}', 0.06, 6.0, (0, y, -2.5), rot=(0, 0, math.pi / 2), material=steel, bake='env', segs=12)
    z.box('fusebox', (0.5, 0.7, 0.18), (-1.9, 1.7, -2.5), material=dark, bake='env', bevel=0.01)
    z.text('wall_stencil', 'KHU 7 // HỒ SƠ', 0.22, (1.6, 2.9, -2.59), material=mat('b_stencil', '#a99f8c'), bake='env')

    # ------------------------------------------------------------ the board on its frame (hero)
    BW, BH, BY = 2.0, 1.25, 1.55
    z.box('cork_board', (BW, BH, 0.04), (0, BY, 0), material=cork, bake='hero', hotspot='about')
    for y in (BY + BH / 2 + 0.03, BY - BH / 2 - 0.03):
        z.box(f'board_rail_{y:.2f}', (BW + 0.12, 0.06, 0.07), (0, y, 0.005), material=steel, bake='hero', bevel=0.008)
    for x in (-BW / 2 - 0.08, BW / 2 + 0.08):
        z.box(f'board_post_{x:.2f}', (0.05, 2.25, 0.05), (x, 1.125, -0.03), material=steel, bake='hero', bevel=0.006)
        z.box(f'board_foot_{x:.2f}', (0.06, 0.05, 0.6), (x, 0.06, -0.03), material=steel, bake='hero')
        for fz in (-0.3, 0.24):
            z.cyl(f'board_caster_{x:.2f}_{fz}', 0.03, 0.025, (x, 0.03, fz - 0.03), rot=(0, 0, math.pi / 2), material=dark, bake='hero', segs=10)

    # clues: photos, index cards, a map, sticky notes; pins + red string (live)
    clues = []
    layout = [
        (-0.72, 1.95, 0.26, 0.19, photo), (-0.28, 2.0, 0.2, 0.26, photo2), (0.18, 1.98, 0.28, 0.2, card),
        (0.66, 1.92, 0.24, 0.3, photo), (-0.7, 1.55, 0.3, 0.22, card), (-0.16, 1.5, 0.44, 0.32, mapm),
        (0.42, 1.55, 0.2, 0.25, photo2), (0.78, 1.45, 0.18, 0.14, sticky), (-0.75, 1.13, 0.22, 0.28, photo),
        (-0.28, 1.1, 0.26, 0.18, card), (0.2, 1.12, 0.22, 0.17, photo), (0.68, 1.12, 0.28, 0.2, paper),
    ]
    pin_mat = emissive('pin_red', '#ff2a2a', 2.0)
    for i, (x, y, w, h, m) in enumerate(layout):
        rz = (rnd.random() - 0.5) * 0.14
        z.box(f'clue_{i}', (w, h, 0.003), (x, y, 0.022 + i * 0.0004), rot=(0, 0, rz), material=m, bake='hero')
        if m in (photo, photo2):  # white photo border
            z.box(f'clue_border_{i}', (w + 0.02, h + 0.02, 0.002), (x, y, 0.0205 + i * 0.0004), rot=(0, 0, rz), material=paper, bake='hero')
        px, py = x - math.sin(rz) * (h / 2 - 0.02), y + math.cos(rz) * (h / 2 - 0.02)
        z.cyl(f'pin_{i}', 0.009, 0.012, (px, py, 0.032), rot=(math.pi / 2, 0, 0), material=pin_mat, live=1, segs=8)
        clues.append((px, py))
    string = emissive('red_string', '#ff3030', 1.3)
    for k, (a, b) in enumerate(((0, 5), (5, 11), (2, 5), (5, 6), (1, 4), (6, 10), (3, 6), (8, 9))):
        (ax, ay), (bx, by) = clues[a], clues[b]
        z.tube(f'string_{k}', [(ax, ay, 0.036), ((ax + bx) / 2, (ay + by) / 2 - 0.01, 0.04), (bx, by, 0.036)], 0.0018, material=string, live=1, segs=4)
    z.text('board_title', 'SUBJECT: D. HENSMAN-ROSSER', 0.045, (-0.3, 2.22, 0.024), material=red_ink, bake='hero')

    # ------------------------------------------------------------ side table: the case file under a banker's lamp
    tx, tz = -1.75, 0.55
    z.box('table_top', (0.9, 0.04, 0.6), (tx, 0.74, tz), rot=(0, 0.25, 0), material=wood, bake='hero', bevel=0.006)
    for dx in (-0.4, 0.4):
        for dz in (-0.25, 0.25):
            x = tx + dx * math.cos(0.25) + dz * math.sin(0.25)
            zz = tz - dx * math.sin(0.25) + dz * math.cos(0.25)
            z.box(f'table_leg_{dx}_{dz}', (0.035, 0.72, 0.035), (x, 0.36, zz), rot=(0, 0.25, 0), material=steel, bake='hero')
    z.box('case_file', (0.25, 0.012, 0.33), (tx + 0.05, 0.766, tz + 0.05), rot=(0, 0.1, 0), material=manila, bake='hero', hotspot='about')
    z.box('case_file_photo', (0.09, 0.002, 0.12), (tx + 0.1, 0.773, tz + 0.02), rot=(0, 0.3, 0), material=photo, bake='hero')
    z.text('case_stamp', 'CLASSIFIED', 0.04, (tx + 0.02, 0.7735, tz + 0.16), rot=(-math.pi / 2, 0.1, 0), material=red_ink, bake='hero')
    lx, lz = tx - 0.25, tz - 0.12
    z.box('lamp_base', (0.16, 0.03, 0.1), (lx, 0.775, lz), material=brass, bake='hero', bevel=0.006)
    z.cyl('lamp_stem', 0.008, 0.3, (lx, 0.93, lz), material=brass, bake='hero', segs=8)
    z.cyl('lamp_shade', 0.06, 0.32, (lx, 1.09, lz + 0.03), rot=(0, 0.25, math.pi / 2), material=green, bake='hero', r2=0.075, segs=16, cap=False)
    z.box('lamp_glow', (0.26, 0.01, 0.06), (lx, 1.055, lz + 0.03), rot=(0, 0.25, 0), material=emissive('banker_bulb', '#ffd9a0', 6), live=1)
    z.light('AREA', (lx, 1.04, lz + 0.03), '#ffcf96', 30, size=(0.3, 0.1), aim=(lx, 0, lz + 0.03), name='banker')

    # ------------------------------------------------------------ the VK machine on its cart
    vx, vz, vyaw = 1.55, 0.6, -0.45
    z.box('cart', (0.55, 0.7, 0.45), (vx, 0.4, vz), rot=(0, vyaw, 0), material=dark, bake='hero', bevel=0.01)
    z.box('cart_shelf', (0.6, 0.03, 0.5), (vx, 0.765, vz), rot=(0, vyaw, 0), material=steel, bake='hero')
    z.box('vk_body', (0.46, 0.17, 0.34), (vx, 0.87, vz), rot=(0, vyaw, 0), material=mat('vk_shell', '#2a2c30', '#141518', noise=0.3, scale=25), bake='hero', bevel=0.02, hotspot='about')
    # bellows: rings stacked, breathing in the real one
    for i in range(6):
        z.cyl(f'vk_bellow_{i}', 0.07 - i * 0.004, 0.025, (vx - 0.12 * math.cos(vyaw), 0.97 + i * 0.026, vz + 0.12 * math.sin(vyaw)), material=dark if i % 2 else mat('vk_rubber', '#0e0e10'), bake='hero', segs=16)
    # the eye on its arm, looking at you
    ax, az = vx + 0.1 * math.cos(vyaw), vz - 0.1 * math.sin(vyaw)
    z.cyl('vk_arm', 0.012, 0.3, (ax, 1.08, az), rot=(0.4, vyaw, 0), material=steel, bake='hero', segs=8)
    ex, ez = ax + math.sin(vyaw) * 0.08, az + math.cos(vyaw) * 0.08
    z.cyl('vk_lens_housing', 0.055, 0.08, (ex, 1.22, ez), rot=(math.pi / 2, vyaw + 0.4, 0), material=dark, bake='hero', segs=20, bevel=0.005)
    z.cyl('vk_eye', 0.04, 0.01, (ex + math.sin(vyaw + 0.4) * 0.045, 1.22, ez + math.cos(vyaw + 0.4) * 0.045), rot=(math.pi / 2, vyaw + 0.4, 0), material=emissive('vk_teal', '#2ad4c9', 5), role='pulse', segs=20)
    z.box('vk_screen', (0.2, 0.08, 0.005), (vx + math.sin(vyaw) * 0.172, 0.88, vz + math.cos(vyaw) * 0.172), rot=(0, vyaw, 0), material=emissive('vk_screen', '#ffb000', 1.8), live=1)

    # ------------------------------------------------------------ light
    z.light('SPOT', (0.4, 3.6, 2.2), '#ffd9a0', 700, size=0.15, aim=(0, 1.5, 0), spot=math.radians(48), blend=0.5, name='board_spot')
    z.light('POINT', (1.6, 1.3, 0.9), '#2ad4c9', 12, size=0.1, name='vk_glow')
    z.light('AREA', (0, 4.5, 0.5), '#2a3a50', 120, size=(5, 4), aim=(0, 0, 0.5), name='fill')
    return z
