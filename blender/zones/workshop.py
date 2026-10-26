# The workshop: one dusty room, late light pouring through a big factory
# window, the time machine with cables running off it across the floor. You
# stand behind the desk, straight on to its screens, and look around (no
# walking): the desk (home; the monitor is your browser, the books open the
# reading list, the phone is contact; the robot arm that jacks you in is JS),
# the TV wall (the blog), the bookcase (reading), the tool wall, the evidence
# board (about), the car right of the screens (projects).
# Warm haze; the tech stays cyberpunk (amber and teal screens, neon on the kit).
#
# World frame. The room: x -7 … 7, z -10 (the window wall) … 5.5, 6.5 m to the
# roof. The desk sits at the origin as world.js expects (DESK_TOP, the
# monitor at (0, ~1.16, -0.12)); you look past it to the car and the window.

import math
import os
import random
import re

import bmesh
from PIL import Image

import textures
from lib import SITE, B, Zone, emissive, finish, image_pbr, join, mat, noise_texture, pbr, photo
from zones import books, delorean

GROUPS = {
    'desk': {'size': 1024},   # the desk and everything on it
    'room': {'size': 1024},   # floor, walls, roof: big surfaces, the sun's patches
    'hero': {'size': 1024},   # the benches, the TVs, the board
    'car': {'size': 1024},    # the time machine and its cables
    'env': {'size': 1024},    # the window frame, trusses, shelves, the junk
}

DESK_TOP = 0.775
X0, X1, Z0, Z1, H = -7.0, 7.0, -10.0, 5.5, 6.5
WIN_W, WIN_Y0, WIN_Y1 = 8.0, 1.5, 5.7
CAR = ((3.4, 0, -5.4), 2.73)   # where the car stands and its yaw: side-on to your spot, nose to the right


def build(quick=False):
    rnd = random.Random(88)
    z = Zone('workshop')

    # ------------------------------------------------------------ materials (Poly Haven scans, CC0)
    floor = pbr('w_floor', 'concrete_floor_damaged_01', scale=3.0, rough=0.6, tint='#5e5a54', tex=1024)
    brick = pbr('w_brick', 'factory_brick', scale=2.4, tint='#a89c90', tex=1024)
    plaster = pbr('w_plaster', 'concrete_wall_004', scale=2.5, tint='#8a8278', tex=512)
    steel = pbr('w_steel', 'metal_plate', scale=1.0, tint='#8a8f98', tex=256)
    dark_steel = pbr('w_steel_dark', 'metal_plate_02', scale=0.8, tint='#4a4c52', tex=256)
    wood = pbr('w_wood', 'dark_wood', scale=1.2, tex=512)
    bench_top = pbr('w_bench', 'wood_table_worn', scale=1.5, tex=512)
    black = mat('w_black', '#1a1a1d', rough=0.5)
    crt_shell = mat('w_crt', '#b8ad96', rough=0.55)       # yellowed beige plastic
    crt_dark = mat('w_crt_dark', '#2a2a2c', rough=0.5)
    cable = mat('w_cable', '#121214', rough=0.65)
    hose = mat('w_hose', '#3a3d42', rough=0.5, metal=0.6)

    # ------------------------------------------------------------ the room (env)
    W, D = X1 - X0, Z1 - Z0
    cx, cz = (X0 + X1) / 2, (Z0 + Z1) / 2
    z.box('floor', (W, 0.1, D), (cx, -0.05, cz), material=floor, bake='room', texel=1.6)
    for i, (x, zz, w, d, yaw) in enumerate(((-2.2, -3.0, 1.6, 1.1, 0.4), (2.6, -6.6, 1.2, 0.8, -0.3), (-0.8, 2.6, 0.9, 0.6, 1.0))):
        z.box(f'oil_{i}', (w, 0.003, d), (x, 0.0015, zz), rot=(0, yaw, 0), material=mat('w_oil', '#0c0b0a', rough=0.1), bake='env')
    z.box('wall_w', (0.3, H, D), (X0 - 0.15, H / 2, cz), material=brick, bake='room', texel=0.7)
    z.box('wall_e', (0.3, H, D), (X1 + 0.15, H / 2, cz), material=brick, bake='room', texel=0.7)
    z.box('wall_s', (W + 0.6, H, 0.3), (cx, H / 2, Z1 + 0.15), material=brick, bake='room', texel=0.7)
    # the window wall: brick around a big factory window
    side = (W - WIN_W) / 2
    z.box('wall_n_l', (side, H, 0.3), (X0 + side / 2, H / 2, Z0 - 0.15), material=brick, bake='room', texel=0.7)
    z.box('wall_n_r', (side, H, 0.3), (X1 - side / 2, H / 2, Z0 - 0.15), material=brick, bake='room', texel=0.7)
    z.box('wall_n_b', (WIN_W, WIN_Y0, 0.3), (0, WIN_Y0 / 2, Z0 - 0.15), material=brick, bake='room', texel=0.7)
    z.box('wall_n_t', (WIN_W, H - WIN_Y1, 0.3), (0, (H + WIN_Y1) / 2, Z0 - 0.15), material=brick, bake='room', texel=0.7)
    z.box('sill', (WIN_W + 0.2, 0.1, 0.45), (0, WIN_Y0, Z0 + 0.1), material=plaster, bake='env')
    gz = Z0 - 0.08
    cols, rows = 6, 3
    for i in range(cols + 1):
        x = -WIN_W / 2 + i * WIN_W / cols
        z.box(f'win_mull_{i}', (0.12 if 0 < i < cols else 0.18, WIN_Y1 - WIN_Y0, 0.14), (x, (WIN_Y0 + WIN_Y1) / 2, gz), material=dark_steel, bake='env')
    for j in range(rows + 1):
        y = WIN_Y0 + j * (WIN_Y1 - WIN_Y0) / rows
        z.box(f'win_tran_{j}', (WIN_W, 0.09 if 0 < j < rows else 0.16, 0.12), (0, y, gz), material=dark_steel, bake='env')
    # smaller glazing bars inside each pane
    for i in range(cols):
        x = -WIN_W / 2 + (i + 0.5) * WIN_W / cols
        z.box(f'win_bar_v_{i}', (0.03, WIN_Y1 - WIN_Y0, 0.05), (x, (WIN_Y0 + WIN_Y1) / 2, gz), material=dark_steel, bake='env')
    for j in range(rows):
        y = WIN_Y0 + (j + 0.5) * (WIN_Y1 - WIN_Y0) / rows
        z.box(f'win_bar_h_{j}', (WIN_W, 0.03, 0.05), (0, y, gz), material=dark_steel, bake='env')
    z.empty('window', (0, (WIN_Y0 + WIN_Y1) / 2, Z0 - 0.2), role='window', w=WIN_W, h=WIN_Y1 - WIN_Y0)
    # the bright haze outside, for the bake only (JS draws the view)
    haze = z.plane('haze_proxy', WIN_W + 6, WIN_Y1 + 4, (0, (WIN_Y1 + 4) / 2, Z0 - 2.5), material=emissive('w_haze', '#ffd9a8', 3.0), proxy=1)
    haze.visible_shadow = False  # the sun shines through it
    # the light pouring in: a shaft the shape of the window, along the sun (JS
    # draws it; the direction matches the 'sun' light below)
    sun_dir = (-1.2, -10.0, 16.0)
    z.empty('window_beam', (0, (WIN_Y0 + WIN_Y1) / 2, Z0 - 0.05), role='shaft', w=WIN_W, h=WIN_Y1 - WIN_Y0,
            dx=sun_dir[0], dy=sun_dir[1], dz=sun_dir[2], length=9.0, color='#ffd9a0', opacity=0.05)
    # roof and trusses
    z.box('roof', (W + 0.6, 0.2, D + 0.6), (cx, H + 0.1, cz), material=dark_steel, bake='room', texel=0.2)
    for i in range(5):
        zz = Z0 + 1.5 + i * 3.2
        z.box(f'truss_{i}', (W, 0.4, 0.25), (cx, H - 0.5, zz), material=steel, bake='env', texel=0.3)
    z.model('pipes', 'modular_industrial_pipes_01', (X1 - 0.2, 3.2, -6.0), rot=(0, -math.pi / 2, 0), bake='env', tex=128)
    z.model('clock', 'wall_clock', (-5.5, 4.6, Z0 + 0.02), bake='env', tex=128)
    z.model('fusebox', 'power_box_01', (5.6, 1.4, Z0 + 0.02), bake='env', tex=128)

    # ------------------------------------------------------------ the desk (home)
    desk(z, rnd, wood, steel, dark_steel, black, cable)

    # ------------------------------------------------------------ the time machine + its cables
    (car_pos, car_yaw) = CAR
    delorean.build(z, origin=car_pos, yaw=car_yaw, open_door=-1)  # your side's door up, the cabin on show
    car = z.sub(car_pos, car_yaw)
    # kit bolted on: a box of electronics on the bonnet, a display on the roof, glowing valves at the back
    car.box('kit_hood', (0.55, 0.14, 0.5), (-1.45, 0.78, 0.05), rot=(0, 0, 0.12), material=dark_steel, bake='car', bevel=0.01)
    car.box('kit_hood_panel', (0.22, 0.08, 0.004), (-1.35, 0.84, 0.31), rot=(0, 0, 0.12), material=emissive('w_kit_teal', '#2ad4c9', 2.5), live=1)
    car.box('kit_roof', (0.5, 0.2, 0.06), (0.0, 1.27, 0.0), rot=(0, math.pi / 2, 0), material=dark_steel, bake='car', bevel=0.008)
    car.plane('kit_roof_screen', 0.42, 0.13, (0.0, 1.28, 0.032), rot=(0, 0, 0), material=emissive('w_roof_screen', '#ffb000', 2.0, textured=True), role='display', painter='syslog')
    valve = emissive('w_valve', '#ff9a3c', 3.5)
    for k in range(5):
        car.cyl(f'valve_{k}', 0.025, 0.11, (1.5 + (k % 2) * 0.08, 1.02, -0.35 + k * 0.17), material=valve, live=1, segs=10, r2=0.018)
    # ribbed hoses from the reactor round the flanks
    car.tube('hose_1', [(1.7, 1.0, 0.45), (1.4, 0.95, 0.9), (0.6, 0.62, 1.0), (-0.2, 0.55, 0.98)], 0.05, material=hose, bake='car', segs=10)
    # (your side's hose drops to the floor clear of the open door)
    car.tube('hose_-1', [(1.7, 1.0, -0.45), (1.4, 0.95, -0.9), (0.95, 0.6, -1.05), (0.75, 0.08, -1.15), (0.2, 0.05, -1.35)], 0.05, material=hose, bake='car', segs=10)
    # cables off the car, snaking across the floor to the benches and the desk
    ends = [(-5.6, 0.95, -4.0), (-5.6, 0.95, -2.6), (-5.4, 0.95, -6.0), (-0.9, 0.5, -0.4), (0.9, 0.5, -0.4),
            (5.4, 0.9, -5.6), (5.2, 0.9, -7.2), (3.5, 0.0, -1.5), (-3.2, 0.0, -8.2), (2.2, 0.0, -8.8)]
    W_ = z.W(car_pos)
    for i, end in enumerate(ends):
        c, s = math.cos(car_yaw), math.sin(car_yaw)
        lx, lz = (rnd.random() - 0.5) * 2.8, (0.95 if rnd.random() < 0.5 else -0.95)
        start = (W_.x + lx * c + lz * s, 0.45, W_.z - lx * s + lz * c)
        pts = [start, (start[0], 0.02, start[2])]
        for k in range(1, 4):
            t = k / 4
            pts.append((start[0] + (end[0] - start[0]) * t + (rnd.random() - 0.5) * 1.6, 0.015, start[2] + (end[2] - start[2]) * t + (rnd.random() - 0.5) * 1.6))
        pts += [(end[0], 0.015, end[2]), end] if end[1] > 0.1 else [end]
        z.tube(f'cable_{i}', pts, 0.012 + rnd.random() * 0.01, material=cable, bake='car', segs=6)

    # ------------------------------------------------------------ the TV wall (west): the blog's here
    bench(z, 'bench_w', (-6.2, 0, -4.2), math.pi / 2, 4.6, bench_top, dark_steel)
    tv_wall(z, rnd, wood, dark_steel, crt_shell, crt_dark)
    z.model('radio', 'vintage_radio_transceiver', (-6.3, 0.92, -2.4), rot=(0, math.pi / 2, 0), bake='hero', max_tris=1500, tex=256)
    # two dashboards on the east bench
    for i, (pos, yaw, size) in enumerate((((5.95, 0.92, -6.3), -math.pi / 2 + 0.2, 0.4), ((6.2, 1.78, -5.6), -math.pi / 2, 0.34))):
        crt(z, f'crt_e{i}', pos, yaw, size, crt_shell, crt_dark, col=20 + i, row=0)

    # ------------------------------------------------------------ shelves of junk (both walls, back corners)
    for i, (pos, yaw) in enumerate((((-6.6, 0, -8.6), math.pi / 2), ((-6.6, 0, -7.6), math.pi / 2), ((6.6, 0, -8.6), -math.pi / 2), ((6.6, 0, -7.6), -math.pi / 2))):
        z.model(f'shelf_{i}', 'steel_frame_shelves_02', pos, rot=(0, yaw, 0), bake='env', tex=128)
        sx = pos[0] + (0.05 if pos[0] < 0 else -0.05)
        for level, y in enumerate((0.13, 0.64, 1.15, 1.65)):  # the model's shelf tops
            for k in range(2):
                zz = pos[2] - 0.14 + k * 0.28
                pick = rnd.random()
                if pick < 0.35:
                    z.model(f'box_{i}_{level}_{k}', 'cardboard_box_01', (sx, y, zz), rot=(0, math.pi / 2 + (rnd.random() - 0.5) * 0.3, 0), scale=0.6, bake='env', max_tris=200, tex=128)
                elif pick < 0.7:
                    z.model(f'tin_{i}_{level}_{k}', 'oil_tin', (sx, y, zz), rot=(0, rnd.random() * 3, 0), bake='env', max_tris=180, tex=128)
                else:
                    z.model(f'can_{i}_{level}_{k}', 'can_rusted', (sx, y, zz), rot=(0, rnd.random() * 3, 0), bake='env', max_tris=180, tex=128)
    z.model('tool_chest', 'metal_tool_chest', (6.2, 0, -4.2), rot=(0, -math.pi / 2, 0), bake='env', tex=128)
    bench(z, 'bench_e', (6.2, 0, -6.6), -math.pi / 2, 2.2, bench_top, dark_steel)
    z.model('gas', 'propane_tank', (5.9, 0, -3.3), bake='env', tex=128)
    for i, (x, zz) in enumerate(((4.6, -9.2), (5.2, -9.4))):
        tyre_flat(z, f'tyre_{i}', (x, 0, zz), tex=128)

    # floor clutter round the car and in the corners
    junk(z, rnd, bench_top, dark_steel, cable, car_pos, car_yaw)
    z.model('tool_cart', 'tool_cart', (-2.7, 0, -4.6), rot=(0, 0.6, 0), bake='env', tex=128)
    z.model('welder', 'portable_welding_cart', (-2.6, 0, -7.4), rot=(0, 0.7, 0), bake='env', tex=128)
    z.model('hand_truck', 'hand_truck', (5.9, 0, 3.6), rot=(0, -1.3, 0), bake='env', tex=128)
    for i, (x, zz, yaw) in enumerate(((-5.9, -9.2, 0.2), (-5.2, -9.4, 1.1), (-6.3, -8.4, 2.0))):
        z.model(f'drum_{i}', 'Barrel_01', (x, 0, zz), rot=(0, yaw, 0), bake='env', tex=128)
    for i, (x, y, zz, yaw, s_) in enumerate(((3.4, 0, -9.3, 0.1, 1.0), (3.5, 0.0, -8.4, -0.3, 0.9), (3.45, 0.35, -9.2, 0.4, 0.8))):
        z.model(f'crate_{i}', 'wooden_crate_01' if i != 1 else 'wooden_crate_02', (x, y, zz), rot=(0, yaw, 0), scale=s_, bake='env', tex=128)
    for i, (x, zz) in enumerate(((1.6, -8.9), (1.9, -9.1))):
        z.model(f'jerrycan_{i}', 'metal_jerrycan', (x, 0, zz), rot=(0, 0.3 + i, 0), bake='env', tex=128)
    z.model('tv', 'Television_01', (6.25, 0.92, -7.3), rot=(0, -math.pi / 2 + 0.3, 0), bake='hero', tex=256)

    # ------------------------------------------------------------ the tool wall (west, near you): pegboard over a bench
    bench(z, 'bench_tools', (X0 + 0.42, 0, 2.2), math.pi / 2, 2.6, bench_top, dark_steel)
    peg = z.sub((X0 + 0.02, 1.85, 2.2), math.pi / 2)  # faces +x, into the room
    peg.plane('pegboard', 2.4, 1.3, (0, 0, 0), material=photo('w_pegboard', textures.pegboard(), rough=0.9, tex=512), bake='hero')
    hang = [  # (tool, x along the board, y, yaw spin in the board's plane)
        ('cross_pein_hammer', -0.95, -0.15, 0.0), ('adjustable_wrench', -0.65, -0.1, 0.0), ('combination_wrench', -0.45, 0.05, 1.0),
        ('tongue_groove_pliers', -0.2, 0.05, 1.0), ('pliers', 0.05, -0.15, 0.0), ('screwdrivers_02', 0.35, 0.05, 1.0),
        ('measuring_tape_01', 0.65, -0.05, 0.0),
    ]
    for i, (tool, x, y, flat) in enumerate(hang):
        # the flat-lying scans are stood up; all turned to face the room
        peg.model(f'peg_{i}', tool, (x, y - 0.12, 0.02), rot=(-math.pi / 2 * flat, 0, 0), bake='hero', max_tris=800, tex=128)
    z.model('bench_toolbox', 'metal_toolbox', (X0 + 0.45, 0.92, 1.4), rot=(0, 1.3, 0), bake='hero', max_tris=1200, tex=256)
    z.model('bench_cans', 'spray_paint_bottles', (X0 + 0.35, 0.92, 3.0), rot=(0, 2.0, 0), bake='hero', max_tris=800, tex=256)
    z.model('bench_oil', 'small_oil_can_01', (X0 + 0.5, 0.92, 2.55), rot=(0, 0.6, 0), bake='hero', max_tris=800, tex=256)
    z.model('bench_lamp_w', 'desk_lamp_arm_01', (X0 + 0.3, 0.92, 1.85), rot=(0, 1.6, 0), bake='hero', max_tris=2000, tex=256)
    z.light('SPOT', (X0 + 0.6, 1.6, 2.1), '#ffd9a0', 90, size=0.06, aim=(X0 + 0.4, 0.9, 2.3), spot=math.radians(80), blend=0.5, name='tool_lamp')
    # the bookcase: steel uprights, plank shelves, full of books (the reading list too)
    books.bookcase(z.sub((X0 + 0.21, 0, -0.4), math.pi / 2), rnd, dark_steel, bench_top, bays=2, bay_w=1.2, height=3.0, levels=6, hotspot='reading')
    # XƯỞNG ("workshop") in teal neon over the tool wall
    z.text('neon_dhr', 'DHR.VN', 0.36, (X0 + 0.05, 2.95, 2.2), rot=(0, math.pi / 2, 0), material=emissive('w_neon_teal', '#2ad4c9', 2.6), tube=0.008, role='flicker')
    z.light('AREA', (X0 + 0.4, 2.95, 2.2), '#2ad4c9', 20, size=(0.3, 1.1), aim=(X0 + 3, 2.5, 2.2), name='neon_spill')

    # ------------------------------------------------------------ the evidence board (about), east wall
    evidence_board(z.sub((6.55, 0, -1.6), -math.pi / 2), rnd)

    # ------------------------------------------------------------ a payphone on the east wall (contact is the phone on the desk)
    z.model('payphone', 'korean_public_payphone_01', (6.82, 1.05, 1.1), rot=(0, -math.pi / 2, 0), bake='hero', max_tris=3000, tex=256)
    z.text('payphone_sign', 'GỌI ĐIỆN', 0.14, (6.83, 2.1, 1.1), rot=(0, -math.pi / 2, 0), material=emissive('w_sign', '#ff4f8a', 4), tube=0.006)

    # ------------------------------------------------------------ light
    # late sun through the window, low and warm; the sky's glow; bulbs and screens inside
    # (sunlight ~32° up: the window's grid lands on the floor from z ≈ -7.6 to -1, over the car)
    z.light('SUN', (1.2, 10.0, Z0 - 10.0), '#ffc98a', 12.0, size=math.radians(1.5), aim=(0, 0, -4.0), name='sun')  # along sun_dir
    z.light('AREA', (0, (WIN_Y0 + WIN_Y1) / 2, Z0 - 0.6), '#ffe3b8', 1300, size=(WIN_W, WIN_Y1 - WIN_Y0), aim=(0, 1.5, 0), name='window_sky')
    bulb = emissive('w_edison', '#ffb15a', 9)
    for i, (x, y, zz) in enumerate(((-4.6, 3.2, -4.6), (-3.9, 2.9, 1.5), (4.4, 3.1, -5.8), (3.8, 3.0, -0.6), (-1.6, 3.3, -7.8))):
        z.tube(f'bulb_cord_{i}', [(x, y + 0.06, zz), (x, H, zz)], 0.004, material=cable, bake='env')
        z.cyl(f'bulb_{i}', 0.035, 0.11, (x, y, zz), material=bulb, live=1, segs=12, r2=0.022)
        z.light('POINT', (x, y - 0.03, zz), '#ffb15a', 45, size=0.05, name=f'edison_{i}')
    z.light('AREA', (0, H - 0.3, cz), '#3a4a60', 200, size=(W - 1, D - 1), aim=(0, 0, cz), name='cool_fill')
    return z


# ---------------------------------------------------------------- pieces

# ---------------------------------------------------------------- the desk

def reading_now(n=6):
    """The most recently read books that have covers: (path, pages)."""
    src = open(os.path.join(SITE, 'public', 'reading', 'data.js')).read()
    books = []
    for m in re.finditer(r"readDate: '([\d-]+)',\s*isbn: (\d+),.*?numberOfPages: (\d+)", src, re.S):
        path = os.path.join(SITE, 'public', 'reading', 'covers', f'{m.group(2)}.jpg')
        if os.path.exists(path):
            books.append((m.group(1), path, int(m.group(3))))
    books.sort(reverse=True)
    return [(p, pages) for _, p, pages in books[:n]]


def cover_book(z, name, path, pages, pos, yaw, **tags):
    """A real book lying flat, its cover on top (spine to the left)."""
    img = Image.open(path).convert('RGB')
    w_px, h_px = img.size
    d = 0.2                          # cover height (front to back)
    w = d * w_px / h_px              # cover width
    t = 0.008 + pages * 0.00007      # thickness from the page count
    edge = img.crop((0, 0, max(2, w_px // 12), h_px)).resize((1, 1)).getpixel((0, 0))
    spine = mat(f'{name}_spine', '#%02x%02x%02x' % edge, rough=0.6)
    # (texel: thin page edges need room in the lightmap, or brighter light bleeds in)
    book = z.book(name, (w, t, d), pos, rot=(0, yaw, 0), cover=spine, bake='desk', texel=4.0, **tags)
    c, s = math.cos(yaw), math.sin(yaw)
    top = z.plane(f'{name}_cover', w - 0.002, d - 0.002, (pos[0], pos[1] + t / 2 + 0.0004, pos[2]), rot=(-math.pi / 2, yaw, 0),
                  material=photo(f'{name}_art', path, rough=0.45, tex=256), bake='desk', texel=4.0, **tags)
    return join([book, top], name), t


def desk(z, rnd, wood, steel, dark_steel, black, cable):
    """The desk at the origin: a battered workbench, the terminal in the middle
    (world.js builds that monitor; the robot arm and the phone are JS too)
    with three more screens round it, and a life's worth of stuff on it."""
    top = pbr('w_desk_top', 'wood_table_worn', scale=1.1, tint='#7a6a58', rough=0.8, tex=1024)
    frame = pbr('w_desk_frame', 'rusty_metal_02', scale=1.2, tint='#6a625a', tex=512)
    keycap = mat('w_keycap', '#2b2a28', rough=0.55)
    paper = mat('w_paper', '#d8d0bf', rough=0.9)
    z.box('desk_top', (2.4, 0.07, 1.0), (0, DESK_TOP - 0.035, 0), material=top, bake='desk', bevel=0.006)
    for sz in (-0.5, 0.5):  # steel angle along the long edges
        z.box(f'desk_edge_{sz}', (2.42, 0.075, 0.02), (0, DESK_TOP - 0.037, sz), material=frame, bake='desk')
    for sx in (-1.1, 1.1):
        for sz in (-0.43, 0.43):
            z.box(f'desk_leg_{sx}_{sz}', (0.06, DESK_TOP - 0.07, 0.06), (sx, (DESK_TOP - 0.07) / 2, sz), material=frame, bake='desk')
        z.box(f'desk_rail_{sx}', (0.05, 0.05, 0.86), (sx, DESK_TOP - 0.1, 0), material=frame, bake='desk')
        z.box(f'desk_low_rail_{sx}', (0.05, 0.05, 0.86), (sx, 0.18, 0), material=frame, bake='desk')
    z.box('desk_brace', (2.2, 0.05, 0.05), (0, 0.18, -0.43), material=frame, bake='desk')
    z.box('desk_shelf', (2.15, 0.03, 0.8), (0, 0.21, 0), material=top, bake='desk')
    z.box('drawers', (0.45, 0.5, 0.7), (-0.82, 0.48, -0.05), material=dark_steel, bake='desk', bevel=0.008)
    for i in range(3):
        z.box(f'drawer_pull_{i}', (0.14, 0.015, 0.02), (-0.82, 0.64 - i * 0.15, 0.31), material=steel, bake='desk')
    z.box('pc_tower', (0.22, 0.48, 0.5), (0.75, 0.47, -0.05), material=black, bake='desk', bevel=0.01)
    z.box('pc_led', (0.004, 0.2, 0.004), (0.639, 0.5, 0.2), material=emissive('w_pc_led', '#2ad4c9', 4), live=1)

    # the desk mat, the keyboard on it (every keycap with its legend), its amber backlight
    z.plane('desk_mat', 0.95, 0.42, (-0.05, DESK_TOP + 0.001, 0.26), rot=(-math.pi / 2, 0, 0),
            material=photo('w_desk_mat', textures.desk_mat(), rough=0.9, tex=512), bake='desk')
    unit = 0.019
    keys, (KW, KD) = textures.keyboard_layout(unit)
    caps = photo('w_keycaps', textures.keyboard_texture(unit), rough=0.5, tex=1024)
    kb_y, kb_z, tilt = DESK_TOP + 0.014, 0.25, 0.06
    z.box('kb_case', (KW + 0.022, 0.022, KD + 0.022), (0, kb_y, kb_z), rot=(tilt, 0, 0), material=black, bake='desk', bevel=0.004)
    z.plane('kb_glow', KW, KD, (0, kb_y + 0.0115, kb_z), rot=(-math.pi / 2 + tilt, 0, 0), material=emissive('kb_backlight', '#ffb000', 0.45), live=1)
    caps_objs = []
    for i, (label, kx, kz, kw, kd) in enumerate(keys):
        y = kb_y + 0.017 - math.sin(tilt) * kz
        o = z.box(f'key_{i}', (kw - 0.003, 0.011, kd - 0.003), (kx, y, kb_z + kz * math.cos(tilt)), rot=(tilt, 0, 0), material=caps, bake='desk')
        key_uv(o.data, kx, kz, KW, KD)
        caps_objs.append(o)
    join(caps_objs, 'keycaps')

    # the books on the go: a stack of what's being read (real covers) → /reading/
    y = DESK_TOP
    stack = []
    for i, (path, pages) in enumerate(reading_now(6)):
        b, t = cover_book(z, f'reading_{i}', path, pages, (-0.92 + (rnd.random() - 0.5) * 0.03, y, 0.26), (rnd.random() - 0.5) * 0.4)
        b.location.z += t / 2  # book() centres on pos
        stack.append(b)
        y += t
    pile = join(stack, 'reading_pile')
    pile['hotspot'] = 'reading'

    # handwriting: a notepad of to-dos, glasses on it; sticky notes on the screens
    z.plane('notepad', 0.15, 0.21, (-0.55, DESK_TOP + 0.0095, 0.32), rot=(-math.pi / 2, 0.25, 0),
            material=photo('w_notepad', textures.note('notepad', ['TODO', '~fix flux capacitor', 'order 1.21 GW', 'blog: Saigon books pt 2', '~coffee', 'call the vet re: Mochi'], size=(512, 720)), rough=0.85, tex=512), bake='desk')
    z.box('notepad_back', (0.152, 0.008, 0.212), (-0.55, DESK_TOP + 0.004, 0.32), rot=(0, 0.25, 0), material=mat('w_card', '#6b5a44', rough=0.9), bake='desk')
    z.model('glasses', 'round_spectacles', (-0.5, DESK_TOP + 0.0095, 0.3), rot=(0, 0.6, 0), bake='desk', max_tris=800, tex=256)
    for i, (x, y_, lines, col, rot) in enumerate(((-1.02, 1.0, ['BACK UP', 'THE', 'BACKUPS'], '#e8cf4a', 0.06),)):
        side = -1 if x < 0 else 1
        ang = -side * 0.5
        z.plane(f'sticky_{i}', 0.07, 0.07, (x, y_, 0.13 if side < 0 else 0.12), rot=(0, ang, rot),
                material=photo(f'w_sticky_{i}', textures.note(f'sticky_{i}', lines, paper=col, ink='#202020', ruled=False, size=(256, 256), font_size=44), rough=0.85, tex=256), bake='desk')

    # coffee, tools, the rest of the life on the desk (Poly Haven scans)
    mug(z, (0.68, DESK_TOP, 0.4))
    z.model('plant', 'potted_plant_04', (-1.05, DESK_TOP, -0.32), bake='desk', max_tris=1500, tex=512)
    z.model('duck', 'rubber_duck_toy', (-0.36, DESK_TOP, -0.02), rot=(0, 0.7, 0), scale=0.35, bake='desk', max_tris=900, tex=256)
    z.model('clock', 'alarm_clock_01', (-0.6, DESK_TOP, -0.3), rot=(0, 0.35, 0), bake='desk', max_tris=1200, tex=256)
    z.model('meter', 'retro_multimeter', (-0.86, DESK_TOP, -0.22), rot=(0, 0.5, 0), bake='desk', max_tris=1200, tex=256)
    z.model('pcb', 'circuit_board', (0.62, DESK_TOP, -0.33), rot=(0, 0.4, 0), scale=0.6, bake='desk', max_tris=1000, tex=256)
    z.model('screwdrivers', 'screwdrivers_02', (0.3, DESK_TOP, 0.06), rot=(0, 1.2, 0), bake='desk', max_tris=900, tex=256)
    z.model('pliers', 'tongue_groove_pliers', (0.84, DESK_TOP, -0.14), rot=(0, 2.4, 0), bake='desk', max_tris=1200, tex=256)
    z.model('lighter', 'vintage_lighter', (-0.3, DESK_TOP, 0.42), rot=(math.pi / 2, 0.4, 0), bake='desk', max_tris=1000, tex=256)
    z.model('pens', 'stationery_supplies', (-1.05, DESK_TOP, -0.05), rot=(0, 0.3, 0), bake='desk', max_tris=1000, tex=256)
    z.model('tape', 'measuring_tape_01', (1.12, DESK_TOP, 0.42), rot=(0, 0.8, 0), bake='desk', max_tris=1000, tex=256)
    z.model('cassette', 'cassette_player', (-0.25, DESK_TOP, -0.36), rot=(0, -0.2, 0), bake='desk')
    # soldering station, iron in its stand
    sx_, sz_ = 1.02, -0.3
    z.box('solder_stn', (0.14, 0.09, 0.12), (sx_, DESK_TOP + 0.045, sz_), rot=(0, -0.3, 0), material=dark_steel, bake='desk', bevel=0.006)
    z.box('solder_lcd', (0.07, 0.03, 0.002), (sx_ + 0.02, DESK_TOP + 0.06, sz_ + 0.061), rot=(0, -0.3, 0), material=emissive('w_solder_lcd', '#ff4f2a', 3), live=1)
    z.tube('solder_lead', [(sx_ - 0.03, DESK_TOP + 0.04, sz_ + 0.06), (sx_ - 0.08, DESK_TOP + 0.01, sz_ + 0.12), (sx_ - 0.16, DESK_TOP + 0.01, sz_ + 0.1), (sx_ - 0.18, DESK_TOP + 0.015, sz_ + 0.03)], 0.004, material=black, bake='desk', segs=6)
    z.cyl('solder_iron', 0.008, 0.18, (sx_ - 0.19, DESK_TOP + 0.015, sz_ - 0.03), rot=(math.pi / 2, 0.3, 0), material=steel, bake='desk', segs=8)

    # JS things, for their shadows: the phone lying by the keyboard, the robot arm's base
    z.box('phone_proxy', (0.075, 0.009, 0.155), (0.5, DESK_TOP + 0.0045, 0.32), rot=(0, -0.25, 0), material=black, proxy=1)
    # (warehouse.js: ARM_BASE (1.02, top, 0.12), the plug's cradle at (0.78, top, 0.17))
    z.cyl('arm_proxy', 0.09, 0.3, (1.02, DESK_TOP + 0.15, 0.12), material=black, proxy=1)

    # bake proxies for the JS monitor (about its size on a wide screen): its shadow and glow
    z.box('mon_proxy', (0.96, 0.6, 0.06), (0, 1.15, -0.15), material=black, proxy=1)
    z.plane('mon_proxy_glow', 0.9, 0.52, (0, 1.15, -0.115), material=emissive('proxy_amber', '#ffb000', 2.0), proxy=1)
    z.box('mon_proxy_neck', (0.05, 0.22, 0.04), (0, DESK_TOP + 0.11, -0.22), material=black, proxy=1)
    z.box('mon_proxy_base', (0.28, 0.02, 0.18), (0, DESK_TOP + 0.01, -0.2), material=black, proxy=1)
    # three more screens round it: angled in at the sides, one more above on the left
    # (none above on the right: from where you stand the car shows past them there)
    for side in (-1, 1):
        yaw = -side * 0.5
        ex, ez = side * 0.5, -0.12                      # the main screen's edge
        hw = 0.33
        cx, cz = ex + side * hw * math.cos(yaw), ez - side * hw * math.sin(yaw)
        side_tags = {'painter': 'timing'} if side > 0 else {}
        flat_screen(z, f'side_{side}', (cx, 1.12, cz), yaw, 0.62, 0.38, black, col=10 + side, row=0, **side_tags)
        if side < 0:
            flat_screen(z, f'top_{side}', (cx, 1.56, cz - 0.02), yaw, 0.62, 0.38, black, pitch=-0.18, col=10 + side, row=1, hotspot='blog', painter='blog')
        px, pz = cx - math.sin(yaw) * 0.12, cz - math.cos(yaw) * 0.12
        pole_h = 1.05 if side < 0 else 0.6
        z.cyl(f'pole_{side}', 0.02, pole_h, (px, DESK_TOP + pole_h / 2, pz), material=steel, bake='desk', segs=12)
        z.cyl(f'pole_clamp_{side}', 0.05, 0.03, (px, DESK_TOP + 0.015, pz), material=black, bake='desk', segs=16)
        for y in ((1.12, 1.56) if side < 0 else (1.12,)):  # arms from the pole to the screens' backs
            z.box(f'pole_arm_{side}_{y}', (0.04, 0.04, 0.05), (cx - math.sin(yaw) * 0.095, y, cz - math.cos(yaw) * 0.095), rot=(0, yaw, 0), material=black, bake='desk')
    # a mess of cables down the back to a power strip on the floor
    for i in range(7):
        x0 = -0.9 + i * 0.3
        z.tube(f'desk_cable_{i}', [(x0, DESK_TOP + 0.02, -0.4), (x0 + 0.05, DESK_TOP, -0.52), (x0 * 0.6, 0.5, -0.56), (0.2 + i * 0.03, 0.03, -0.75), (0.5, 0.03, -0.8 - i * 0.02)],
               0.007 + rnd.random() * 0.005, material=cable, bake='desk', segs=6)
    z.box('power_strip', (0.4, 0.04, 0.06), (0.55, 0.02, -0.85), rot=(0, 0.2, 0), material=black, bake='desk')

    # the pendant lamp over it
    lamp = (0.1, 2.95, 0.3)
    z.model('lamp', 'hanging_industrial_lamp', (lamp[0], lamp[1] - 0.2, lamp[2]), bake='desk', max_tris=2500, tex=512)
    z.tube('lamp_cord', [(lamp[0], lamp[1] + 1.1, lamp[2]), (lamp[0], H, lamp[2])], 0.006, material=black, bake='desk')
    z.cyl('lamp_bulb', 0.045, 0.07, (lamp[0], lamp[1] - 0.05, lamp[2]), material=emissive('bulb', '#ffd9a0', 6), live=1, segs=16)
    z.light('SPOT', (lamp[0], lamp[1] - 0.08, lamp[2]), '#ffcf96', 150, size=0.2, aim=(lamp[0], 0, lamp[2]), spot=math.radians(110), blend=0.8, name='lamp')


def junk(z, rnd, bench_top, frame, cable, car_pos, car_yaw):
    """The mess round the car, between it and the desk: a bench of old
    electronics under a lamp, filament bulbs, stacked boxes and crates,
    tyres, a drum, circuit boards and paper on the floor, oil stains, and
    cables, black and red, snaking off the car everywhere."""
    red = mat('w_cable_red', '#6a1a14', rough=0.6)
    paper = mat('w_scrap', '#9c9482', rough=0.95)  # old, trodden on
    oil = mat('w_oil', '#0c0b0a', rough=0.1)
    grime = mat('w_grime', '#1a1612', rough=0.9)
    # the electronics bench, angled towards you, its lamp on
    b = z.sub((4.7, 0, -2.6), -0.35)
    bench(b, 'bench_junk', (0, 0, 0), 0.0, 1.8, bench_top, frame)
    b.model('junk_tv', 'Television_01', (-0.55, 0.92, -0.1), rot=(0, 0.35, 0), bake='hero', tex=128, max_tris=1000)
    b.model('junk_radio', 'vintage_radio_transceiver', (0.15, 0.92, -0.15), rot=(0, -0.2, 0), bake='hero', tex=128, max_tris=900)
    b.model('junk_meter', 'retro_multimeter', (0.62, 0.92, 0.1), rot=(0, -0.6, 0), bake='hero', tex=128, max_tris=600)
    for k in range(3):
        b.model(f'junk_pcb_{k}', 'circuit_board', (-0.2 + k * 0.3, 0.92, 0.25), rot=(0, rnd.random() * 3, 0), scale=0.5, bake='hero', tex=128, max_tris=400)
    b.model('junk_lamp', 'desk_lamp_arm_01', (0.75, 0.92, -0.25), rot=(0, 2.4, 0), bake='hero', tex=128, max_tris=1200)
    b.light('SPOT', (0.45, 1.55, -0.05), '#ffd9a0', 70, size=0.06, aim=(0.1, 0.9, 0.1), spot=math.radians(85), blend=0.5, name='junk_lamp')
    # filament bulbs on the bench, glowing (as in every workshop worth the name)
    fil = emissive('w_filament', '#ff9a3c', 7)
    for k, (x, zz) in enumerate(((-0.15, 0.32), (0.05, 0.38))):
        b.cyl(f'bulb_glass_{k}', 0.04, 0.13, (x, 0.92 + 0.08, zz), material=mat('w_bulb_glass', '#3a2a18', rough=0.05), bake='hero', segs=16, r2=0.03)
        b.cyl(f'bulb_fil_{k}', 0.012, 0.07, (x, 0.92 + 0.08, zz), material=fil, live=1, segs=8)
        b.cyl(f'bulb_base_{k}', 0.035, 0.04, (x, 0.92 + 0.02, zz), material=frame, bake='hero', segs=16)
        b.light('POINT', (x, 1.02, zz), '#ff9a3c', 9, size=0.03, name=f'filament_{k}')
    # boxes stacked any old how, crates, a plastic crate of parts
    for k, (x, y, zz, sc, yaw) in enumerate(((2.3, 0, -2.4, 0.9, 0.2), (2.35, 0.3, -2.42, 0.8, -0.3), (2.3, 0.57, -2.4, 0.65, 0.5),
                                              (2.9, 0, -1.9, 0.8, 1.2), (1.9, 0, -3.1, 0.7, 0.7))):
        z.model(f'junk_box_{k}', 'cardboard_box_01', (x, y, zz), rot=(0, yaw, 0), scale=sc, bake='env', max_tris=500, tex=128)
    z.model('junk_crate', 'wooden_crate_02', (3.5, 0, -1.6), rot=(0, 0.4, 0), bake='env', max_tris=800, tex=128)
    z.model('junk_crate_2', 'wooden_crate_01', (3.55, 0.46, -1.62), rot=(0, 0.9, 0), scale=0.8, bake='env', max_tris=800, tex=128)
    z.model('junk_parts', 'plastic_crate_01', (1.6, 0, -2.2), rot=(0, 0.3, 0), bake='env', max_tris=800, tex=128)
    for k in range(2):  # a stack of two, not quite square
        tyre_flat(z, f'junk_tyre_{k}', (5.15 + k * 0.04, k * 0.17, -1.1 - k * 0.03), max_tris=600, tex=128)
    z.model('junk_drum', 'Barrel_01', (0.9, 0, -4.5), rot=(0, 0.5, 0), bake='env', max_tris=700, tex=128)
    # on the floor: boards, scraps of paper, oil, grime
    for k in range(4):
        z.model(f'floor_pcb_{k}', 'circuit_board', (1.4 + rnd.random() * 3.5, 0.0, -1.0 - rnd.random() * 2.6), rot=(0, rnd.random() * 3, 0), scale=0.5, bake='env', max_tris=300, tex=128)
    for k in range(26):
        x, zz = -2.5 + rnd.random() * 8.0, -0.8 - rnd.random() * 7.5
        scrap(z, f'scrap_{k}', rnd, (x, 0.004 + k * 0.0002, zz), paper)
    for k in range(12):
        x, zz = -2.0 + rnd.random() * 7.0, -0.8 - rnd.random() * 7.0
        rr = 0.15 + rnd.random() * 0.45
        z.cyl(f'oil_spot_{k}', rr, 0.002, (x, 0.0012, zz), material=oil if k % 3 else grime, bake='env', segs=14)
    # cables off the car, everywhere: to the bench, the desk, the boxes, the walls
    c, s = math.cos(car_yaw), math.sin(car_yaw)
    ox, oz = car_pos[0], car_pos[2]
    ends = [(4.3, 0.9, -2.4), (1.15, 0.6, -0.3), (2.2, 0.0, -2.0), (0.6, 0.0, -1.6), (-1.5, 0.0, -2.5), (-2.4, 0.0, -4.4),
            (5.2, 0.0, -1.0), (3.2, 0.0, -0.6), (6.5, 1.2, -3.8), (-0.5, 0.0, -6.5), (1.0, 0.0, -8.0), (4.0, 0.0, -8.6)]
    for i, end in enumerate(ends):
        lx, lz = (rnd.random() - 0.5) * 3.0, (0.95 if i % 2 else -0.95)
        start = (ox + lx * c + lz * s, 0.3 + rnd.random() * 0.5, oz - lx * s + lz * c)
        pts = [start, (start[0], 0.02, start[2])]
        for k in range(1, 5):
            t = k / 5
            pts.append((start[0] + (end[0] - start[0]) * t + (rnd.random() - 0.5) * 1.2, 0.012, start[2] + (end[2] - start[2]) * t + (rnd.random() - 0.5) * 1.2))
        pts += [(end[0], 0.012, end[2]), end] if end[1] > 0.1 else [end]
        z.tube(f'junk_cable_{i}', pts, 0.009 + rnd.random() * 0.012, material=red if i % 3 == 0 else cable, bake='car', segs=6)
    # the left side, between the desk and the TV wall: another bench of old
    # kit under a lamp, boxes and crates, tyres, a jerrycan, a crate of parts
    lb = z.sub((-3.3, 0, -2.3), 0.35)
    bench(lb, 'bench_left', (0, 0, 0), 0.0, 1.7, bench_top, frame)
    lb.model('left_tv', 'Television_01', (0.45, 0.92, -0.1), rot=(0, -0.3, 0), bake='hero', tex=128, max_tris=1000)
    lb.model('left_panel', 'vintage_spacecraft_instrument', (-0.25, 0.92, -0.12), rot=(0, 0.2, 0), bake='hero', tex=128, max_tris=1000)
    lb.model('left_radio', 'vintage_radio_transceiver', (-0.62, 0.92, 0.12), rot=(0, 0.5, 0), scale=0.8, bake='hero', tex=128, max_tris=800)
    lb.model('left_lamp', 'desk_lamp_arm_01', (-0.75, 0.92, -0.25), rot=(0, 0.9, 0), bake='hero', tex=128, max_tris=1000)
    lb.light('SPOT', (-0.45, 1.55, -0.05), '#ffd9a0', 60, size=0.06, aim=(-0.1, 0.9, 0.1), spot=math.radians(85), blend=0.5, name='left_lamp')
    for k in range(2):
        lb.model(f'left_pcb_{k}', 'circuit_board', (0.05 + k * 0.32, 0.92, 0.28), rot=(0, rnd.random() * 3, 0), scale=0.5, bake='hero', tex=128, max_tris=400)
    for k, x in enumerate((0.05, 0.22)):
        lb.cyl(f'left_bulb_glass_{k}', 0.04, 0.13, (x, 1.0, 0.05), material=mat('w_bulb_glass', '#3a2a18', rough=0.05), bake='hero', segs=16, r2=0.03)
        lb.cyl(f'left_bulb_fil_{k}', 0.012, 0.07, (x, 1.0, 0.05), material=fil, live=1, segs=8)
        lb.cyl(f'left_bulb_base_{k}', 0.035, 0.04, (x, 0.94, 0.05), material=frame, bake='hero', segs=16)
        lb.light('POINT', (x, 1.0, 0.05), '#ff9a3c', 9, size=0.03, name=f'left_filament_{k}')
    for k, (x, y, zz, sc, yaw) in enumerate(((-2.2, 0, -0.5, 0.9, 0.3), (-2.25, 0.3, -0.52, 0.75, -0.4), (-2.6, 0, -1.0, 0.8, 1.0),
                                              (-4.9, 0, -3.4, 0.9, 0.1), (-4.85, 0.3, -3.38, 0.8, 0.6), (-4.4, 0, -4.0, 0.7, 1.3))):
        z.model(f'left_box_{k}', 'cardboard_box_01', (x, y, zz), rot=(0, yaw, 0), scale=sc, bake='env', max_tris=400, tex=128)
    z.model('left_crate', 'wooden_crate_02', (-4.5, 0, -0.5), rot=(0, 1.3, 0), bake='env', max_tris=700, tex=128)
    z.model('left_crate_2', 'wooden_crate_01', (-4.55, 0.46, -0.45), rot=(0, 0.7, 0), scale=0.8, bake='env', max_tris=700, tex=128)
    z.model('left_parts', 'plastic_crate_01', (-3.6, 0, -0.9), rot=(0, 0.5, 0), bake='env', max_tris=700, tex=128)
    z.model('left_can', 'metal_jerrycan', (-2.0, 0, -3.5), rot=(0, 2.2, 0), bake='env', max_tris=700, tex=128)
    for k in range(3):
        tyre_flat(z, f'left_tyre_{k}', (-5.0 + (rnd.random() - 0.5) * 0.06, k * 0.17, -1.7 + (rnd.random() - 0.5) * 0.06), max_tris=500, tex=128)
    for k in range(10):
        x, zz = -5.0 + rnd.random() * 3.0, -0.2 - rnd.random() * 4.5
        scrap(z, f'left_scrap_{k}', rnd, (x, 0.0045 + k * 0.0002, zz), paper)

    # a couple of coils lying on the floor
    for k, (x, zz) in enumerate(((2.8, -0.9), (-1.6, -3.6))):
        pts = [(x + math.cos(a) * (0.22 + 0.015 * a), 0.012 + 0.006 * (a // 6.28), zz + math.sin(a) * (0.22 + 0.015 * a) * 0.8) for a in [j * 0.5 for j in range(40)]]
        z.tube(f'coil_{k}', pts, 0.01, material=red if k else cable, bake='env', segs=6)


def lathe_mesh(name, profile, segs=48, smooth=50):
    """A turned shape: profile (r, y) spun round the y axis, smooth-shaded
    except where the profile turns sharper than `smooth` degrees."""
    bm = bmesh.new()
    vs = [bm.verts.new(B(r, y, 0)) for r, y in profile]
    es = [bm.edges.new((vs[i], vs[i + 1])) for i in range(len(vs) - 1)]
    bmesh.ops.spin(bm, geom=vs + es, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=segs, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = finish(bm, name)
    mesh.shade_smooth()
    mesh.set_sharp_from_angle(angle=math.radians(smooth))
    return mesh


def mug(z, pos):
    """An enamel camping mug, dark-blue rim, black coffee filled up to the
    rim's band (any lower and you look over the lip at white enamel).
    A ring of crema round the edge. Turned, with walls and a lip.
    Lit live (no lightmap): a small round thing up close shows every texel."""
    x, y, zz = pos
    enamel = mat('w_mug', '#e6e1d4', rough=0.25)
    rim = mat('w_mug_rim', '#1d2f55', rough=0.3)
    # outside up from the foot, over the rolled lip, down the inside
    profile = [(0.0, 0.0), (0.039, 0.0), (0.0435, 0.003), (0.045, 0.012), (0.0462, 0.09), (0.0468, 0.096), (0.0466, 0.1005),
               (0.0448, 0.103), (0.0425, 0.1025), (0.0412, 0.099), (0.0408, 0.092), (0.0398, 0.012), (0.036, 0.0065), (0.0, 0.0065)]
    body = z.add('mug', lathe_mesh('mug', profile), (x, y, zz), material=enamel, live=1)
    body.data.materials.append(rim)
    # the lip and a band below it are the rim colour
    body.data.polygons.foreach_set('material_index', [1 if p.center.z > 0.0915 else 0 for p in body.data.polygons])
    # C-shaped handle
    hx = x + 0.046
    handle = [(hx - 0.002, y + 0.083, zz)] + [(hx + 0.012 + 0.018 * math.sin(a), y + 0.052 + 0.03 * math.cos(a), zz) for a in [k * math.pi / 10 for k in range(11)]] + [(hx - 0.002, y + 0.021, zz)]
    z.tube('mug_handle', handle, 0.0055, material=enamel, segs=10, live=1)
    # coffee: crema to the wall, darker in the middle
    z.cyl('coffee', 0.0403, 0.003, (x, y + 0.0925, zz), material=mat('w_crema', '#2e1a0c', rough=0.45), segs=40, live=1)
    z.cyl('coffee_dark', 0.035, 0.001, (x, y + 0.0945, zz), material=mat('w_coffee', '#0e0603', rough=0.2), segs=32, live=1)


def tyre_flat(z, name, pos, **kw):
    """An old tyre lying flat, pos = the middle of its bottom face. (The scan
    stands upright on its tread; tipped over about its foot it lies 0.3 m
    over and half its width under the floor, so that's taken back.)"""
    x, y, zz = pos
    return z.model(name, 'old_tyre', (x, y + 0.085, zz - 0.305), rot=(math.pi / 2, 0, 0), bake='env', **kw)


def scrap(z, name, rnd, pos, paper):
    """A scrap of paper flat on the floor: one face, with lightmap room of its
    own (thin boxes got a texel or two and bled light from their neighbours)."""
    w, d = 0.08 + rnd.random() * 0.14, 0.08 + rnd.random() * 0.18
    z.plane(name, w, d, pos, rot=(-math.pi / 2, rnd.random() * 3, 0), material=paper, bake='env', texel=3.5)


def key_uv(mesh, kx, kz, KW, KD):
    """Map a keycap onto its own patch of the keyboard atlas (from above)."""
    uv = mesh.uv_layers['UVMap'].data
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            co = mesh.vertices[mesh.loops[li].vertex_index].co   # Blender: x, -z, y
            u = (kx + co.x) / KW + 0.5
            v = (kz - co.y) / KD + 0.5                           # 0 at the back row
            uv[li].uv = (min(max(u, 0.0), 1.0), 1 - min(max(v, 0.0), 1.0))


def flat_screen(z, name, pos, yaw, w, h, black, pitch=0.0, **tags):
    """A thin flat monitor (pos is its face centre), its screen a canvas JS paints."""
    m = z.sub(pos, yaw)
    m.box(f'{name}_frame', (w, h, 0.03), (0, 0, -0.015), rot=(pitch, 0, 0), material=black, bake='hero', bevel=0.004)
    m.box(f'{name}_back', (w * 0.5, h * 0.5, 0.05), (0, 0, -0.05), rot=(pitch, 0, 0), material=black, bake='hero', bevel=0.01)
    m.plane(f'{name}_screen', w - 0.025, h - 0.025, (0, 0, 0.001), rot=(pitch, 0, 0), material=emissive('w_side_glow', '#2ad4c9', 1.2, textured=True), role='screen', **tags)


TV_TINTS = ['#2ad4c9', '#ff3fa4', '#5cff6a', '#ffb000', '#4a7dff', '#c06bff', '#ff5a3c', '#e8f0ff']


def tv_wall(z, rnd, wood, frame, beige, dark):
    """Floor-to-ceiling rack of mismatched old TVs on the west wall, every one
    showing a different colour of static; one, at eye level on the bench, is the blog."""
    x_shelf, depth = -6.66, 0.62
    z0, z1 = -6.45, -1.95
    shells = [beige, beige, dark, dark, wood, mat('w_tv_silver', '#8e9096', rough=0.4, metal=0.6)]
    for zz in (z0 - 0.03, (z0 + z1) / 2, z1 + 0.03):
        for x in (x_shelf - depth / 2 + 0.03, x_shelf + depth / 2 - 0.03):
            z.box(f'tv_post_{zz:.2f}_{x:.2f}', (0.05, 3.3, 0.05), (x, 1.65, zz), material=frame, bake='env')
    rows = [(0.92, -4.15, 0.5)] + [(y + 0.02, z1, 0.47) for y in (1.62, 2.3, 2.98)]
    for y, _, _ in rows[1:]:
        z.box(f'tv_shelf_{y:.2f}', (depth, 0.04, z1 - z0 + 0.12), (x_shelf, y - 0.04, (z0 + z1) / 2), material=wood, bake='env')
    n = 0
    for r, (y, end, max_size) in enumerate(rows):
        zz = z0
        while True:
            size = 0.32 + rnd.random() * (max_size - 0.32)
            if zz + size > end:
                break
            front = x_shelf + depth / 2 - 0.02 - rnd.random() * 0.05
            crt(z, f'tv_{n}', (front, y, zz + size / 2), math.pi / 2 + (rnd.random() - 0.5) * 0.16, size,
                rnd.choice(shells), dark, painter='static', tint=TV_TINTS[n % len(TV_TINTS)], col=n, row=r)
            zz += size + 0.02 + rnd.random() * 0.04
            n += 1
    # the blog: the big one on the bench
    crt(z, 'tv_blog', (-6.0, 0.92, -3.45), math.pi / 2 - 0.12, 0.58, beige, dark, hotspot='blog', col=0, row=9)


def bench(z, name, pos, yaw, length, top, frame):
    """A long workbench along a wall (local x along its length, +z to the room)."""
    b = z.sub(pos, yaw)
    b.box(f'{name}_top', (length, 0.06, 0.8), (0, 0.89, 0), material=top, bake='hero', bevel=0.01)
    b.box(f'{name}_shelf', (length - 0.1, 0.03, 0.7), (0, 0.25, 0), material=frame, bake='hero')
    for x in (-length / 2 + 0.06, length / 2 - 0.06):
        for zz in (-0.34, 0.34):
            b.box(f'{name}_leg_{x:.2f}_{zz}', (0.05, 0.86, 0.05), (x, 0.43, zz), material=frame, bake='hero')


def crt(z, name, pos, yaw, size, shell, dark, **tags):
    """A chunky 80s CRT monitor, its screen a canvas JS paints (role 'screen')."""
    m = z.sub(pos, yaw)
    w, h, d = size, size * 0.82, size * 0.95
    m.box(f'{name}_case', (w, h, d), (0, h / 2, -d / 2 + 0.02), material=shell, bake='hero', bevel=0.02)
    m.box(f'{name}_back', (w * 0.7, h * 0.7, d * 0.5), (0, h * 0.45, -d - 0.05), material=shell, bake='hero')  # (unseen: no bevel)
    m.box(f'{name}_bezel', (w * 0.86, h * 0.76, 0.02), (0, h * 0.55, 0.02), material=dark, bake='hero')
    m.box(f'{name}_knobs', (w * 0.5, 0.025, 0.01), (0, h * 0.1, 0.025), material=dark, bake='hero')
    tags = {k: v for k, v in tags.items() if v is not None}
    tint = tags.get('tint', '#ffb000')
    m.plane(f'{name}_screen', w * 0.72, h * 0.6, (0, h * 0.55, 0.032), material=emissive(f'w_crt_glow_{tint[1:]}', tint, 1.4, textured=True), role='screen', **tags)


def evidence_board(z, rnd):
    """The rolling cork board pinned with Daryl's photos, red string, a table
    with the case file. Local: the board faces +z."""
    steel = pbr('w_steel', 'metal_plate', scale=1.0, tint='#8a8f98', tex=256)
    dark = pbr('w_steel_dark', 'metal_plate_02', scale=0.8, tint='#4a4c52', tex=256)
    cork = image_pbr('cork', noise_texture('cork', '#8a6238', [('#3e2612', 0.0, 0.42), ('#c79a62', 0.62, 1.0)], density=0.55, seed=3), scale=0.5, rough=0.95)
    card = mat('index_card', '#cbc3b2', rough=0.95)  # aged card, not printer-white
    paper = mat('b_paper', '#ddd5c4', rough=0.9)
    sticky = mat('sticky', '#e8cf4a', rough=0.8)
    red_ink = mat('red_ink', '#9a1c18')
    shots = sorted(os.listdir(os.path.join(SITE, 'public', 'images', 'blog')))
    photos = [photo(f'evidence_{i}', os.path.join(SITE, 'public', 'images', 'blog', f), tex=256) for i, f in enumerate(shots[:7])]
    photos.append(photo('evidence_map', os.path.join(SITE, 'public', 'images', 'location.jpg'), tex=256))
    BW, BH, BY = 2.0, 1.25, 1.55
    z.box('cork_board', (BW, BH, 0.04), (0, BY, 0), material=cork, bake='hero', hotspot='about')
    for y in (BY + BH / 2 + 0.03, BY - BH / 2 - 0.03):
        z.box(f'board_rail_{y:.2f}', (BW + 0.12, 0.06, 0.07), (0, y, 0.005), material=steel, bake='hero', bevel=0.008)
    for x in (-BW / 2 - 0.08, BW / 2 + 0.08):
        z.box(f'board_post_{x:.2f}', (0.05, 2.25, 0.05), (x, 1.125, -0.03), material=steel, bake='hero', bevel=0.006)
        z.box(f'board_foot_{x:.2f}', (0.06, 0.05, 0.6), (x, 0.06, -0.03), material=steel, bake='hero')
    layout = [
        (-0.72, 1.95, 0.26, 0.19, photos[0]), (-0.28, 2.0, 0.2, 0.26, photos[1]), (0.18, 1.98, 0.28, 0.2, card),
        (0.66, 1.92, 0.24, 0.3, photos[2]), (-0.7, 1.55, 0.3, 0.22, card), (-0.16, 1.5, 0.44, 0.32, photos[7]),
        (0.42, 1.55, 0.2, 0.25, photos[3]), (0.78, 1.45, 0.18, 0.14, sticky), (-0.75, 1.13, 0.22, 0.28, photos[4]),
        (-0.28, 1.1, 0.26, 0.18, card), (0.2, 1.12, 0.22, 0.17, photos[5]), (0.68, 1.12, 0.28, 0.2, photos[6]),
    ]
    pin_mat = emissive('pin_red', '#ff2a2a', 2.0)
    clues = []
    for i, (x, y, w, h, m) in enumerate(layout):
        rz = (rnd.random() - 0.5) * 0.14
        if m.name.startswith('evidence'):
            z.plane(f'clue_{i}', w, h, (x, y, 0.0225 + i * 0.0004), rot=(0, 0, rz), material=m, bake='hero')
            z.box(f'clue_border_{i}', (w + 0.02, h + 0.02, 0.002), (x, y, 0.0205 + i * 0.0004), rot=(0, 0, rz), material=paper, bake='hero')
        else:
            z.box(f'clue_{i}', (w, h, 0.003), (x, y, 0.022 + i * 0.0004), rot=(0, 0, rz), material=m, bake='hero')
        px, py = x - math.sin(rz) * (h / 2 - 0.02), y + math.cos(rz) * (h / 2 - 0.02)
        z.cyl(f'pin_{i}', 0.009, 0.012, (px, py, 0.032), rot=(math.pi / 2, 0, 0), material=pin_mat, live=1, segs=8)
        clues.append((px, py))
    string = emissive('red_string', '#ff3030', 1.3)
    for k, (a, b) in enumerate(((0, 5), (5, 11), (2, 5), (5, 6), (1, 4), (6, 10), (3, 6), (8, 9))):
        (ax, ay), (bx, by) = clues[a], clues[b]
        z.tube(f'string_{k}', [(ax, ay, 0.036), ((ax + bx) / 2, (ay + by) / 2 - 0.01, 0.04), (bx, by, 0.036)], 0.0018, material=string, live=1, segs=4)
    z.text('board_title', 'SUBJECT: D. HENSMAN-ROSSER', 0.045, (-0.3, 2.22, 0.024), material=red_ink, bake='hero')
    z.light('SPOT', (0.3, 3.6, 2.4), '#ffd9a0', 110, size=0.35, aim=(0, 1.3, 0), spot=math.radians(75), blend=0.9, name='board_spot')
