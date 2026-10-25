# The workshop: one dusty room, late light pouring through a big factory
# window, the time machine in the middle with cables running off it across
# the floor to the benches. The desk (home), a bench of CRTs (the blog), the
# evidence board (about), a payphone (contact), a bookshelf (reading) and an
# F1 sim rig in the corner. Warm haze; the tech stays cyberpunk (amber and
# teal screens, neon on the kit).
#
# World frame. The room: x -7 … 7, z -10 (the window wall) … 5.5, 6.5 m to the
# roof. The desk sits at the origin as world.js expects (DESK_TOP, the
# monitor at (0, ~1.12, -0.12)); you look past it to the car and the window.

import math
import os
import random

from lib import SITE, Zone, emissive, image_pbr, join, mat, noise_texture, pbr, photo
from zones import books, delorean

GROUPS = {
    'hero': {'size': 1024},   # the desk, the benches, the board, the rig
    'car': {'size': 1024},    # the time machine and its cables
    'env': {'size': 1024},    # floor, walls, roof, shelves
}

DESK_TOP = 0.775
X0, X1, Z0, Z1, H = -7.0, 7.0, -10.0, 5.5, 6.5
WIN_W, WIN_Y0, WIN_Y1 = 8.0, 1.5, 5.7
CAR = ((0.3, 0, -5.4), 0.45)   # where the car stands (zone coords) and its yaw


def build(quick=False):
    rnd = random.Random(88)
    z = Zone('workshop')

    # ------------------------------------------------------------ materials (Poly Haven scans, CC0)
    floor = pbr('w_floor', 'concrete_floor_damaged_01', scale=3.0, rough=0.6, tint='#5e5a54', tex=1024)
    brick = pbr('w_brick', 'factory_brick', scale=2.4, tint='#a89c90', tex=1024)
    plaster = pbr('w_plaster', 'concrete_wall_004', scale=2.5, tint='#8a8278', tex=512)
    steel = pbr('w_steel', 'metal_plate', scale=1.0, tint='#8a8f98', tex=256)
    dark_steel = pbr('w_steel_dark', 'metal_plate_02', scale=0.8, tint='#4a4c52', tex=256)
    rust = pbr('w_rust', 'rusty_metal_02', scale=1.5, tex=512)
    wood = pbr('w_wood', 'dark_wood', scale=1.2, tex=512)
    bench_top = pbr('w_bench', 'wood_table_worn', scale=1.5, tex=512)
    leather = pbr('w_leather', 'brown_leather', scale=0.6, tint='#5a4c44', tex=256)
    black = mat('w_black', '#1a1a1d', rough=0.5)
    keycap = mat('w_keycap', '#2b2a28', rough=0.55)
    paper = mat('w_paper', '#d8d0bf', rough=0.9)
    mug_mat = mat('w_mug', '#d9d2c3', rough=0.25)
    crt_shell = mat('w_crt', '#b8ad96', rough=0.55)       # yellowed beige plastic
    crt_dark = mat('w_crt_dark', '#2a2a2c', rough=0.5)
    cable = mat('w_cable', '#121214', rough=0.65)
    hose = mat('w_hose', '#3a3d42', rough=0.5, metal=0.6)

    # ------------------------------------------------------------ the room (env)
    W, D = X1 - X0, Z1 - Z0
    cx, cz = (X0 + X1) / 2, (Z0 + Z1) / 2
    z.box('floor', (W, 0.1, D), (cx, -0.05, cz), material=floor, bake='env', texel=0.5)
    for i, (x, zz, w, d, yaw) in enumerate(((-2.2, -3.0, 1.6, 1.1, 0.4), (2.6, -6.6, 1.2, 0.8, -0.3), (-0.8, 2.6, 0.9, 0.6, 1.0))):
        z.box(f'oil_{i}', (w, 0.003, d), (x, 0.0015, zz), rot=(0, yaw, 0), material=mat('w_oil', '#0c0b0a', rough=0.1), bake='env')
    z.box('wall_w', (0.3, H, D), (X0 - 0.15, H / 2, cz), material=brick, bake='env', texel=0.5)
    z.box('wall_e', (0.3, H, D), (X1 + 0.15, H / 2, cz), material=brick, bake='env', texel=0.5)
    z.box('wall_s', (W + 0.6, H, 0.3), (cx, H / 2, Z1 + 0.15), material=brick, bake='env', texel=0.5)
    # the window wall: brick around a big factory window
    side = (W - WIN_W) / 2
    z.box('wall_n_l', (side, H, 0.3), (X0 + side / 2, H / 2, Z0 - 0.15), material=brick, bake='env', texel=0.5)
    z.box('wall_n_r', (side, H, 0.3), (X1 - side / 2, H / 2, Z0 - 0.15), material=brick, bake='env', texel=0.5)
    z.box('wall_n_b', (WIN_W, WIN_Y0, 0.3), (0, WIN_Y0 / 2, Z0 - 0.15), material=brick, bake='env', texel=0.5)
    z.box('wall_n_t', (WIN_W, H - WIN_Y1, 0.3), (0, (H + WIN_Y1) / 2, Z0 - 0.15), material=brick, bake='env', texel=0.5)
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
    # the light pouring in: a shaft from the window down across the floor
    z.empty('window_beam', (0, (WIN_Y0 + WIN_Y1) / 2, Z0 + 0.05), rot=(math.radians(-62), 0, 0), role='shaft',
            r=4.6, top=0.62, h=10.0, sides=4, color='#ffd9a0', opacity=0.05)
    # roof and trusses
    z.box('roof', (W + 0.6, 0.2, D + 0.6), (cx, H + 0.1, cz), material=dark_steel, bake='env', texel=0.2)
    for i in range(5):
        zz = Z0 + 1.5 + i * 3.2
        z.box(f'truss_{i}', (W, 0.4, 0.25), (cx, H - 0.5, zz), material=steel, bake='env', texel=0.3)
    z.model('pipes', 'modular_industrial_pipes_01', (X1 - 0.2, 3.2, -6.0), rot=(0, -math.pi / 2, 0), bake='env', tex=256)
    z.model('clock', 'wall_clock', (-5.5, 4.6, Z0 + 0.02), bake='env', tex=256)
    z.model('fusebox', 'power_box_01', (5.6, 1.4, Z0 + 0.02), bake='env', tex=256)

    # ------------------------------------------------------------ the desk (home)
    desk(z, rnd, wood, steel, dark_steel, black, keycap, paper, mug_mat, leather)

    # ------------------------------------------------------------ the time machine + its cables
    (car_pos, car_yaw) = CAR
    delorean.build(z, origin=car_pos, yaw=car_yaw)
    car = z.sub(car_pos, car_yaw)
    # kit bolted on: a box of electronics on the bonnet, a display on the roof, glowing valves at the back
    car.box('kit_hood', (0.55, 0.14, 0.5), (-1.45, 0.78, 0.05), rot=(0, 0, 0.12), material=dark_steel, bake='car', bevel=0.01)
    car.box('kit_hood_panel', (0.22, 0.08, 0.004), (-1.35, 0.84, 0.31), rot=(0, 0, 0.12), material=emissive('w_kit_teal', '#2ad4c9', 2.5), live=1)
    car.box('kit_roof', (0.5, 0.2, 0.06), (0.0, 1.27, 0.0), rot=(0, math.pi / 2, 0), material=dark_steel, bake='car', bevel=0.008)
    car.plane('kit_roof_screen', 0.42, 0.13, (0.0, 1.28, 0.032), rot=(0, 0, 0), material=emissive('w_roof_screen', '#ffb000', 2.0, textured=True), role='display', painter='syslog')
    valve = emissive('w_valve', '#ff9a3c', 6)
    for k in range(5):
        car.cyl(f'valve_{k}', 0.025, 0.11, (1.5 + (k % 2) * 0.08, 1.02, -0.35 + k * 0.17), material=valve, live=1, segs=10, r2=0.018)
    # ribbed hoses from the reactor round the flanks
    for sd in (-1, 1):
        car.tube(f'hose_{sd}', [(1.7, 1.0, sd * 0.45), (1.4, 0.95, sd * 0.9), (0.6, 0.62, sd * 1.0), (-0.2, 0.55, sd * 0.98)], 0.05, material=hose, bake='car', segs=10)
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
        z.model(f'shelf_{i}', 'steel_frame_shelves_02', pos, rot=(0, yaw, 0), bake='env', tex=256)
        sx = pos[0] + (0.05 if pos[0] < 0 else -0.05)
        for level, y in enumerate((0.42, 0.98, 1.54)):
            for k in range(2):
                zz = pos[2] - 0.18 + k * 0.32
                pick = rnd.random()
                if pick < 0.35:
                    z.model(f'box_{i}_{level}_{k}', 'cardboard_box_01', (sx, y, zz), rot=(0, rnd.random() * 0.4, 0), scale=0.7, bake='env', max_tris=600, tex=256)
                elif pick < 0.7:
                    z.model(f'tin_{i}_{level}_{k}', 'oil_tin', (sx, y, zz), rot=(0, rnd.random() * 3, 0), bake='env', max_tris=400, tex=256)
                else:
                    z.model(f'can_{i}_{level}_{k}', 'can_rusted', (sx, y, zz), rot=(0, rnd.random() * 3, 0), bake='env', max_tris=400, tex=256)
    z.model('tool_chest', 'metal_tool_chest', (6.2, 0, -4.2), rot=(0, -math.pi / 2, 0), bake='env', tex=256)
    bench(z, 'bench_e', (6.2, 0, -6.6), -math.pi / 2, 2.2, bench_top, dark_steel)
    z.model('gas', 'propane_tank', (5.9, 0, -3.3), bake='env', tex=256)
    for i, (x, zz) in enumerate(((4.6, -9.2), (5.2, -9.4))):
        z.model(f'tyre_{i}', 'old_tyre', (x, 0, zz), rot=(math.pi / 2, 0, 0), bake='env', tex=256)

    # floor clutter round the car and in the corners
    z.model('tool_cart', 'tool_cart', (3.9, 0, -4.4), rot=(0, -1.2, 0), bake='env', tex=256)
    z.model('welder', 'portable_welding_cart', (-2.6, 0, -7.4), rot=(0, 0.7, 0), bake='env', tex=256)
    z.model('hand_truck', 'hand_truck', (-6.3, 0, -0.6), rot=(0, 1.3, 0), bake='env', tex=256)
    for i, (x, zz, yaw) in enumerate(((-5.9, -9.2, 0.2), (-5.2, -9.4, 1.1), (-6.3, -8.4, 2.0))):
        z.model(f'drum_{i}', 'Barrel_01', (x, 0, zz), rot=(0, yaw, 0), bake='env', tex=256)
    for i, (x, y, zz, yaw, s_) in enumerate(((3.4, 0, -9.3, 0.1, 1.0), (3.5, 0.0, -8.4, -0.3, 0.9), (3.45, 0.35, -9.2, 0.4, 0.8))):
        z.model(f'crate_{i}', 'wooden_crate_01' if i != 1 else 'wooden_crate_02', (x, y, zz), rot=(0, yaw, 0), scale=s_, bake='env', tex=256)
    for i, (x, zz) in enumerate(((1.6, -8.9), (1.9, -9.1))):
        z.model(f'jerrycan_{i}', 'metal_jerrycan', (x, 0, zz), rot=(0, 0.3 + i, 0), bake='env', tex=256)
    z.model('tv', 'Television_01', (6.25, 0.92, -7.3), rot=(0, -math.pi / 2 + 0.3, 0), bake='hero', tex=256)

    # ------------------------------------------------------------ the bookshelf (reading) and an armchair to read in
    books.bookcase(z.sub((-6.78, 0, 2.1), math.pi / 2), rnd, wood, hotspot='reading')
    z.light('POINT', (-6.2, 1.05, 3.9), '#ffbf78', 40, size=0.05, name='oil_lamp')
    z.tube('bulb_cord_books', [(-5.7, 2.86, 2.1), (-5.7, H, 2.1)], 0.004, material=cable, bake='env')
    z.cyl('bulb_books', 0.035, 0.11, (-5.7, 2.8, 2.1), material=emissive('w_edison', '#ffb15a', 9), live=1, segs=12, r2=0.022)
    z.light('POINT', (-5.7, 2.77, 2.1), '#ffb15a', 60, size=0.05, name='edison_books')
    z.model('armchair', 'ArmChair_01', (-5.2, 0, 3.6), rot=(0, 2.3, 0), bake='hero', tex=512, max_tris=2500)
    z.model('reading_table', 'side_table_tall_01', (-6.2, 0, 3.9), bake='hero', tex=256)
    z.model('oil_lamp', 'vintage_oil_lamp', (-6.2, 0.76, 3.9), bake='hero', tex=256)

    # ------------------------------------------------------------ the evidence board (about), east wall
    evidence_board(z.sub((6.55, 0, -1.6), -math.pi / 2), rnd)

    # ------------------------------------------------------------ the payphone (contact), east wall
    z.model('payphone', 'korean_public_payphone_01', (6.82, 1.05, 1.1), rot=(0, -math.pi / 2, 0), bake='hero', max_tris=3000, tex=512, hotspot='contact')
    z.text('payphone_sign', 'GỌI ĐIỆN', 0.14, (6.83, 2.1, 1.1), rot=(0, -math.pi / 2, 0), material=emissive('w_sign', '#ff4f8a', 4), tube=0.006)

    # ------------------------------------------------------------ the F1 rig, front right corner
    sim_rig(z.sub((4.7, 0, 3.6), -2.3), black)

    # ------------------------------------------------------------ light
    # late sun through the window, low and warm; the sky's glow; bulbs and screens inside
    # (sunlight ~32° up: the window's grid lands on the floor from z ≈ -7.6 to -1, over the car)
    z.light('SUN', (1.2, 10.0, Z0 - 10.0), '#ffc98a', 10.0, size=math.radians(1.5), aim=(0, 0, -4.0), name='sun')
    z.light('AREA', (0, (WIN_Y0 + WIN_Y1) / 2, Z0 - 0.6), '#ffe3b8', 900, size=(WIN_W, WIN_Y1 - WIN_Y0), aim=(0, 1.5, 0), name='window_sky')
    bulb = emissive('w_edison', '#ffb15a', 9)
    for i, (x, y, zz) in enumerate(((-4.6, 3.2, -4.6), (-3.9, 2.9, 1.5), (4.4, 3.1, -5.8), (3.8, 3.0, -0.6), (-1.6, 3.3, -7.8))):
        z.tube(f'bulb_cord_{i}', [(x, y + 0.06, zz), (x, H, zz)], 0.004, material=cable, bake='env')
        z.cyl(f'bulb_{i}', 0.035, 0.11, (x, y, zz), material=bulb, live=1, segs=12, r2=0.022)
        z.light('POINT', (x, y - 0.03, zz), '#ffb15a', 45, size=0.05, name=f'edison_{i}')
    z.light('AREA', (0, H - 0.3, cz), '#3a4a60', 200, size=(W - 1, D - 1), aim=(0, 0, cz), name='cool_fill')
    return z


# ---------------------------------------------------------------- pieces

def desk(z, rnd, wood, steel, dark_steel, black, keycap, paper, mug_mat, leather):
    """The desk at the origin: a battered workbench, the terminal in the middle
    (world.js builds that monitor and its plug) with four more screens round it."""
    top = pbr('w_desk_top', 'wood_table_worn', scale=1.1, tint='#7a6a58', rough=0.8, tex=1024)
    frame = pbr('w_desk_frame', 'rusty_metal_02', scale=1.2, tint='#6a625a', tex=512)
    z.box('desk_top', (2.4, 0.07, 1.0), (0, DESK_TOP - 0.035, 0), material=top, bake='hero', bevel=0.006)
    for sz in (-0.5, 0.5):  # steel angle along the long edges
        z.box(f'desk_edge_{sz}', (2.42, 0.075, 0.02), (0, DESK_TOP - 0.037, sz), material=frame, bake='hero')
    for sx in (-1.1, 1.1):
        for sz in (-0.43, 0.43):
            z.box(f'desk_leg_{sx}_{sz}', (0.06, DESK_TOP - 0.07, 0.06), (sx, (DESK_TOP - 0.07) / 2, sz), material=frame, bake='hero')
        z.box(f'desk_rail_{sx}', (0.05, 0.05, 0.86), (sx, DESK_TOP - 0.1, 0), material=frame, bake='hero')
        z.box(f'desk_low_rail_{sx}', (0.05, 0.05, 0.86), (sx, 0.18, 0), material=frame, bake='hero')
    z.box('desk_brace', (2.2, 0.05, 0.05), (0, 0.18, -0.43), material=frame, bake='hero')
    z.box('desk_shelf', (2.15, 0.03, 0.8), (0, 0.21, 0), material=top, bake='hero')
    z.box('drawers', (0.45, 0.5, 0.7), (-0.82, 0.48, -0.05), material=dark_steel, bake='hero', bevel=0.008)
    for i in range(3):
        z.box(f'drawer_pull_{i}', (0.14, 0.015, 0.02), (-0.82, 0.64 - i * 0.15, 0.31), material=steel, bake='hero')
    # junk on the lower shelf: a PC tower, a crate of cables
    z.box('pc_tower', (0.22, 0.48, 0.5), (0.75, 0.47, -0.05), material=black, bake='hero', bevel=0.01)
    z.box('pc_led', (0.004, 0.2, 0.004), (0.639, 0.5, 0.2), material=emissive('w_pc_led', '#2ad4c9', 4), live=1)
    z.model('cable_crate', 'wooden_crate_01', (0.1, 0.225, 0.05), rot=(0, 0.1, 0), scale=0.8, bake='hero', tex=256)

    # keyboard: a heavy mechanical board, amber backlight bleeding between keys
    kb_y = DESK_TOP + 0.012
    z.box('kb_case', (0.46, 0.024, 0.16), (0, kb_y, 0.22), rot=(0.05, 0, 0), material=black, bake='hero', bevel=0.004)
    z.plane('kb_glow', 0.43, 0.13, (0, kb_y + 0.0125, 0.22), rot=(-math.pi / 2 + 0.05, 0, 0), material=emissive('kb_backlight', '#ffb000', 1.2), live=1)
    for r in range(4):
        n = 14 if r < 3 else 9
        for c in range(n):
            w = 0.0255 if r < 3 else (0.12 if c == 4 else 0.0255)
            x = -0.2 + c * 0.0305 + (0.006 * r)
            if r == 3:
                x = -0.2 + c * 0.0305 + (0.0 if c < 4 else 0.12 - 0.0305) + 0.02
            z.box(f'key_{r}_{c}', (w, 0.014, 0.0255), (x + w / 2 - 0.0128, kb_y + 0.018 + r * 0.0016, 0.27 - r * 0.031), rot=(0.05, 0, 0), material=keycap, bake='hero')
    # coffee (and the rings of the coffees before it), the to-read pile, papers, the tape deck
    z.cyl('mug', 0.045, 0.1, (0.62, DESK_TOP + 0.05, 0.3), material=mug_mat, bake='hero', r2=0.047)
    z.tube('mug_handle', [(0.665, DESK_TOP + 0.08, 0.3), (0.7, DESK_TOP + 0.075, 0.3), (0.7, DESK_TOP + 0.03, 0.3), (0.665, DESK_TOP + 0.025, 0.3)], 0.007, material=mug_mat, bake='hero')
    z.cyl('coffee', 0.041, 0.002, (0.62, DESK_TOP + 0.088, 0.3), material=mat('coffee', '#140a05'), bake='hero')
    ring = mat('w_ring', '#2a1a10', rough=0.4)
    for i, (x, zz) in enumerate(((0.45, 0.38), (-0.35, 0.4), (0.9, 0.05))):
        z.cyl(f'coffee_ring_{i}', 0.05, 0.0006, (x, DESK_TOP + 0.0003, zz), material=ring, bake='hero', cap=True, segs=24)
    palette = ['#5a1f1b', '#1f3a4a', '#2f4a2a', '#6b4a1f', '#3a2a4a', '#7a6a55', '#8a3a1a', '#24504f', '#b08a4a']
    y = DESK_TOP
    for i in range(6):
        h = 0.03 + rnd.random() * 0.025
        w, d = 0.22 + rnd.random() * 0.05, 0.15 + rnd.random() * 0.03
        z.book(f'book_{i}', (w, h, d), (-1.0 + (rnd.random() - 0.5) * 0.03, y + h / 2, 0.28), rot=(0, (rnd.random() - 0.5) * 0.35, 0),
               cover=mat(f'cover_{i}', palette[(i * 3) % len(palette)], rough=0.6), bake='hero')
        y += h
    for i in range(5):  # loose printouts
        z.box(f'sheet_{i}', (0.21, 0.001, 0.297), (-0.55 + rnd.random() * 0.15, DESK_TOP + 0.001 + i * 0.0012, 0.3 + rnd.random() * 0.06), rot=(0, (rnd.random() - 0.5) * 1.2, 0), material=paper, bake='hero')
    z.cyl('pen', 0.004, 0.14, (-0.47, DESK_TOP + 0.012, 0.32), rot=(math.pi / 2, 0.9, 0), material=black, bake='hero', segs=8)
    z.model('tape_deck', 'cassette_player', (1.05, DESK_TOP, 0.25), rot=(0, -0.6, 0), bake='hero')
    z.model('pcb', 'circuit_board', (0.95, DESK_TOP, -0.25), rot=(0, 0.4, 0), scale=0.7, bake='hero', max_tris=2000, tex=256)
    z.model('meter', 'retro_multimeter', (-1.0, DESK_TOP, -0.25), rot=(0, 0.5, 0), bake='hero', max_tris=2000, tex=256)
    # soldering station
    z.box('solder_stn', (0.14, 0.09, 0.12), (0.88, DESK_TOP + 0.045, 0.02), rot=(0, -0.3, 0), material=dark_steel, bake='hero', bevel=0.006)
    z.box('solder_lcd', (0.07, 0.03, 0.002), (0.9, DESK_TOP + 0.06, 0.081), rot=(0, -0.3, 0), material=emissive('w_solder_lcd', '#ff4f2a', 3), live=1)
    z.tube('solder_lead', [(0.85, DESK_TOP + 0.04, 0.08), (0.8, DESK_TOP + 0.01, 0.16), (0.72, DESK_TOP + 0.01, 0.12), (0.7, DESK_TOP + 0.015, 0.05)], 0.004, material=black, bake='hero', segs=6)
    z.cyl('solder_iron', 0.008, 0.18, (0.7, DESK_TOP + 0.015, -0.03), rot=(math.pi / 2, 0.3, 0), material=steel, bake='hero', segs=8)

    # bake proxies for the JS monitor (about its size on a wide screen): its shadow and glow
    z.box('mon_proxy', (0.96, 0.6, 0.06), (0, 1.15, -0.15), material=black, proxy=1)
    z.plane('mon_proxy_glow', 0.9, 0.52, (0, 1.15, -0.115), material=emissive('proxy_amber', '#ffb000', 2.0), proxy=1)
    z.box('mon_proxy_neck', (0.05, 0.22, 0.04), (0, DESK_TOP + 0.11, -0.22), material=black, proxy=1)
    z.box('mon_proxy_base', (0.28, 0.02, 0.18), (0, DESK_TOP + 0.01, -0.2), material=black, proxy=1)
    # four more screens round it: angled in at the sides, two more above those on poles
    for side in (-1, 1):
        yaw = -side * 0.5
        ex, ez = side * 0.5, -0.12                      # the main screen's edge
        hw = 0.33
        cx, cz = ex + side * hw * math.cos(yaw), ez - side * hw * math.sin(yaw)
        flat_screen(z, f'side_{side}', (cx, 1.12, cz), yaw, 0.62, 0.38, black, col=10 + side, row=0)
        flat_screen(z, f'top_{side}', (cx, 1.56, cz - 0.02), yaw, 0.62, 0.38, black, pitch=-0.18, col=10 + side, row=1)
        px, pz = cx - math.sin(yaw) * 0.12, cz - math.cos(yaw) * 0.12
        z.cyl(f'pole_{side}', 0.02, 1.05, (px, DESK_TOP + 0.525, pz), material=steel, bake='hero', segs=12)
        z.cyl(f'pole_clamp_{side}', 0.05, 0.03, (px, DESK_TOP + 0.015, pz), material=black, bake='hero', segs=16)
        for y in (1.12, 1.56):  # arms from the pole to the screens' backs
            z.box(f'pole_arm_{side}_{y}', (0.04, 0.04, 0.05), (cx - math.sin(yaw) * 0.095, y, cz - math.cos(yaw) * 0.095), rot=(0, yaw, 0), material=black, bake='hero')
    # a mess of cables down the back to a power strip on the floor
    for i in range(7):
        x0 = -0.9 + i * 0.3
        z.tube(f'desk_cable_{i}', [(x0, DESK_TOP + 0.02, -0.4), (x0 + 0.05, DESK_TOP, -0.52), (x0 * 0.6, 0.5, -0.56), (0.2 + i * 0.03, 0.03, -0.75), (0.5, 0.03, -0.8 - i * 0.02)],
               0.007 + rnd.random() * 0.005, material=mat('w_cable', '#121214', rough=0.65), bake='hero', segs=6)
    z.box('power_strip', (0.4, 0.04, 0.06), (0.55, 0.02, -0.85), rot=(0, 0.2, 0), material=black, bake='hero')

    # the chair, at the desk (left of the camera's pull-back from the monitor)
    cx, cz, yaw = -0.3, 0.88, 0.2
    for i in range(5):
        a = i * 2 * math.pi / 5
        z.box(f'chair_leg_{i}', (0.04, 0.035, 0.32), (cx + math.sin(a) * 0.15, 0.06, cz + math.cos(a) * 0.15), rot=(0, a, 0), material=dark_steel, bake='hero')
        z.cyl(f'chair_wheel_{i}', 0.025, 0.02, (cx + math.sin(a) * 0.3, 0.025, cz + math.cos(a) * 0.3), rot=(0, a, math.pi / 2), material=black, bake='hero', segs=10)
    z.cyl('chair_gas', 0.025, 0.36, (cx, 0.24, cz), material=steel, bake='hero', segs=12)
    z.box('chair_seat', (0.5, 0.09, 0.48), (cx, 0.47, cz), rot=(0, yaw, 0), material=leather, bake='hero', bevel=0.03)
    bx, bz = cx + math.sin(yaw) * 0.24, cz + math.cos(yaw) * 0.24
    z.box('chair_back', (0.46, 0.62, 0.07), (bx, 0.86, bz), rot=(0.12, yaw, 0), material=leather, bake='hero', bevel=0.03)
    for s in (-1, 1):
        ax, az = cx + math.cos(yaw) * 0.26 * s, cz - math.sin(yaw) * 0.26 * s
        z.box(f'chair_arm_{s}', (0.05, 0.03, 0.28), (ax, 0.68, az), rot=(0, yaw, 0), material=black, bake='hero')
        z.box(f'chair_arm_post_{s}', (0.03, 0.2, 0.03), (ax, 0.57, az), rot=(0, yaw, 0), material=dark_steel, bake='hero')
    # the pendant lamp over it
    lamp = (0.1, 3.05, 0.3)
    z.model('lamp', 'hanging_industrial_lamp', (lamp[0], lamp[1] - 0.2, lamp[2]), bake='hero', max_tris=2500, tex=512)
    z.tube('lamp_cord', [(lamp[0], lamp[1] + 1.1, lamp[2]), (lamp[0], H, lamp[2])], 0.006, material=black, bake='hero')
    z.cyl('lamp_bulb', 0.045, 0.07, (lamp[0], lamp[1] - 0.05, lamp[2]), material=emissive('bulb', '#ffd9a0', 10), live=1, segs=16)
    z.light('SPOT', (lamp[0], lamp[1] - 0.08, lamp[2]), '#ffcf96', 380, size=0.08, aim=(lamp[0], 0, lamp[2]), spot=math.radians(100), blend=0.6, name='lamp')


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
    m.box(f'{name}_back', (w * 0.7, h * 0.7, d * 0.5), (0, h * 0.45, -d - 0.05), material=shell, bake='hero', bevel=0.03)
    m.box(f'{name}_bezel', (w * 0.86, h * 0.76, 0.02), (0, h * 0.55, 0.02), material=dark, bake='hero', bevel=0.01)
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
    card = mat('index_card', '#e8e2d4', rough=0.9)
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
    z.light('SPOT', (0.3, 3.4, 2.0), '#ffd9a0', 260, size=0.15, aim=(0, 1.5, 0), spot=math.radians(48), blend=0.5, name='board_spot')


def sim_rig(z, black):
    """The F1 sim rig: alloy frame, red racing seat, wheel, pedals, a screen of
    live timing, teal LEDs along the rails. Local: you sit facing -z."""
    alu = mat('lo_alu', '#b9bdc4', rough=0.35, metal=1.0)
    racing = pbr('lo_racing', 'leather_red_02', scale=0.5, tex=256)

    def rig(name, size, x, y, zz, m, rot=(0, 0, 0), **kw):
        return z.box(name, size, (x, y, zz), rot=rot, material=m, bake='hero', **kw)
    for sx in (-0.25, 0.25):
        rig(f'rig_rail_{sx}', (0.045, 0.045, 1.5), sx, 0.05, 0, alu)
    for dz in (-0.7, 0.0, 0.7):
        rig(f'rig_cross_{dz}', (0.6, 0.045, 0.045), 0, 0.05, dz, alu)
    rig('rig_seat', (0.5, 0.12, 0.5), 0, 0.3, 0.35, racing, bevel=0.04)
    rig('rig_seatback', (0.5, 0.75, 0.12), 0, 0.62, 0.62, racing, rot=(0.5, 0, 0), bevel=0.05)
    rig('rig_wheel_post', (0.045, 0.75, 0.045), 0, 0.4, -0.5, alu)
    rig('rig_wheel_arm', (0.045, 0.045, 0.3), 0, 0.77, -0.38, alu)
    z.tube('rig_wheel', [(0.15 * math.cos(a), 0.85 + 0.15 * math.sin(a), -0.25) for a in [i * math.pi / 8 for i in range(17)]], 0.016, material=black, bake='hero', segs=8)
    rig('rig_pedals', (0.3, 0.12, 0.12), 0, 0.12, -0.65, alu)
    rig('rig_monitor', (0.9, 0.52, 0.04), 0, 1.05, -0.95, black, bevel=0.01)
    rig('rig_monitor_stand', (0.06, 0.8, 0.06), 0, 0.4, -1.0, alu)
    z.plane('rig_screen', 0.84, 0.46, (0, 1.05, -0.925), material=emissive('lo_f1', '#ffb000', 1.4, textured=True), role='display', painter='timing')
    led = emissive('lo_led', '#2ad4c9', 5)
    for sx in (-0.27, 0.27):
        z.box(f'rig_led_{sx}', (0.012, 0.012, 1.4), (sx, 0.09, 0), material=led, live=1)
    z.light('AREA', (0, 0.25, 0), '#2ad4c9', 30, size=(0.8, 1.6), aim=(0, 0, 0), name='rig_led_glow')
    z.light('SPOT', (0.3, 3.0, 0.4), '#ffd9a0', 700, size=0.2, aim=(0, 0.4, 0), spot=math.radians(70), blend=0.6, name='rig_lamp')
    z.model('rig_lamp', 'hanging_industrial_lamp', (0.3, 2.9, 0.4), bake='hero', max_tris=1500, tex=256)
    z.cyl('rig_lamp_bulb', 0.04, 0.06, (0.3, 3.05, 0.4), material=emissive('lo_rig_bulb', '#ffcf96', 6), live=1, segs=12)
