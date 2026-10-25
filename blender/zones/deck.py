# Command deck: the desk and its terminal, the curved wall of screens, the big
# industrial window with the rain, neon. Home (/) and the blog live here.
#
# Built around the world origin, matching world.js: the desk top is at
# DESK_TOP, the monitor (built in JS, sized to the viewport) sits at
# (0, ~1.12, -0.12), the screen wall is a 7 × 3 arc of radius 3 behind it.

import math
import random

from lib import Zone, mat, emissive, hex_rgb

DESK_TOP = 0.775
WALL_R, WALL_CZ = 3.0, 0.25
ANGLES = [math.radians(d) for d in (-48, -32, -16, 0, 16, 32, 48)]
ROWS_Y = (1.22, 1.84, 2.46)
SCR_W, SCR_H = 0.76, 0.5

GROUPS = {
    'hero': {'size': 2048, 'exposure': 1.6},  # desk, everything on it, the chair
    'rig': {'size': 2048, 'exposure': 1.6},   # screen wall, racks, lamp
    'env': {'size': 2048, 'exposure': 1.6},   # floor, walls, window frame, columns
}


def build(quick=False):
    rnd = random.Random(1993)
    z = Zone('deck')

    concrete = mat('concrete', '#47484a', '#1c1d20', noise=0.35, scale=1.4, detail=8)
    wet = mat('floor', '#3c3d40', '#121315', noise=0.45, scale=0.45, detail=10)
    brick = mat('brick', '#2c2523', '#141110', noise=0.0, scale=2.2, pattern='tiles', coords='Object')
    steel = mat('steel', '#3a3d44', '#1d1f24', noise=0.3, scale=8)
    dark_steel = mat('steel_dark', '#24262b', '#121316', noise=0.3, scale=10)
    rust = mat('rust', '#4a3a30', '#22201f', noise=0.5, scale=5)
    wood = mat('walnut', '#4b3424', '#2a1c13', scale=3.5, detail=3, pattern='wood', stretch=(1, 1, 8))
    black = mat('plastic_black', '#1a1a1d', '#0e0e10', noise=0.2, scale=30)
    keycap = mat('keycap', '#2b2a28')
    leather = mat('chair_leather', '#2a2624', '#141211', noise=0.4, scale=20)
    paper = mat('paper', '#d8d0bf')
    mug_mat = mat('mug', '#d9d2c3', '#bfb5a3', noise=0.3, scale=40)
    crate = mat('crate', '#5a4630', '#2e2318', scale=6, pattern='wood', stretch=(1, 1, 10))
    enamel = mat('enamel', '#33463f', '#1b2521', noise=0.3, scale=12)
    stencil = mat('stencil', '#b9b1a0')
    hazard = mat('hazard', '#c08a10', '#151515', scale=6, pattern='stripes', coords='Generated')

    # ------------------------------------------------------------ floor, walls, structure (env)

    z.box('floor', (18, 0.1, 14), (0, -0.05, 0), material=wet, bake='env', texel=0.4)
    # back wall with the big window opening (x -5..5, y 1.5..6.5)
    wz = -7.1
    z.box('wall_l', (4, 9, 0.25), (-7, 4.5, wz), material=brick, bake='env', texel=0.5)
    z.box('wall_r', (4, 9, 0.25), (7, 4.5, wz), material=brick, bake='env', texel=0.5)
    z.box('wall_b', (10, 1.5, 0.25), (0, 0.75, wz), material=brick, bake='env', texel=0.5)
    z.box('wall_t', (10, 2.5, 0.25), (0, 7.75, wz), material=brick, bake='env', texel=0.5)
    z.box('sill', (10.3, 0.12, 0.45), (0, 1.5, wz + 0.1), material=concrete, bake='env')
    # window grid: chunky outer frame, thin mullions (8 × 4 panes)
    gz = wz + 0.02
    z.box('win_frame_t', (10.2, 0.16, 0.18), (0, 6.5, gz), material=dark_steel, bake='env', bevel=0.01)
    z.box('win_frame_b', (10.2, 0.16, 0.18), (0, 1.58, gz), material=dark_steel, bake='env', bevel=0.01)
    for i in range(9):
        x = -5 + i * 10 / 8
        z.box(f'win_mull_{i}', (0.07 if 0 < i < 8 else 0.16, 5, 0.12), (x, 4.0, gz), material=dark_steel, bake='env')
    for j in range(1, 4):
        z.box(f'win_tran_{j}', (10, 0.06, 0.1), (0, 1.5 + j * 5 / 4, gz), material=dark_steel, bake='env')
    # a few panes are boarded / painted over
    for (c, r) in ((0, 3), (7, 0), (6, 3)):
        z.box(f'win_board_{c}{r}', (1.18, 1.18, 0.03), (-5 + (c + 0.5) * 1.25, 1.5 + (r + 0.5) * 1.25, gz - 0.02), material=rust, bake='env')
    z.empty('window', (0, 4.0, wz + 0.04), role='window', w=10.0, h=5.0)

    # stencilled warning on the wall: "no smoking"
    z.text('stencil_no_smoking', 'CẤM HÚT THUỐC', 0.32, (-6.6, 2.4, wz + 0.13), material=stencil, bake='env')
    z.box('hazard_band', (4.0, 0.25, 0.02), (-7, 0.9, wz + 0.135), material=hazard, bake='env')

    # columns and roof trusses (silhouettes against the window)
    for x in (-4.6, 4.6):
        for cz in (-5.6, -1.5, 2.6):
            z.box(f'col_{x}_{cz}', (0.36, 9, 0.36), (x, 4.5, cz), material=steel, bake='env', texel=0.4)
            z.box(f'col_foot_{x}_{cz}', (0.6, 0.12, 0.6), (x, 0.06, cz), material=concrete, bake='env')
    for cz in (-5.6, -1.5, 2.6):
        z.box(f'truss_{cz}', (16, 0.45, 0.3), (0, 7.4, cz), material=steel, bake='env', texel=0.3)
        z.box(f'truss_low_{cz}', (16, 0.12, 0.2), (0, 6.6, cz), material=steel, bake='env', texel=0.3)
        for i in range(12):
            x = -7.5 + i * 15 / 11
            z.box(f'truss_v_{cz}_{i}', (0.06, 0.8, 0.06), (x, 7.0, cz), rot=(0, 0, 0.5 if i % 2 else -0.5), material=steel, bake='env', texel=0.3)
    # a cable tray along the roof line
    z.box('tray', (0.4, 0.06, 13), (-2.8, 6.2, 0), material=dark_steel, bake='env', texel=0.3)

    # clutter in the dark: crates, pallets, drums
    for i, (x, cz, h, yaw) in enumerate(((-6.2, -5.3, 0.8, 0.1), (-6.3, -4.3, 0.6, -0.2), (-5.5, -5.6, 0.7, 0.4), (-6.2, -5.2, 0.5, 0.3))):
        y = h / 2 if i < 3 else 0.8 + h / 2
        z.box(f'crate_{i}', (0.9, h, 0.9), (x, y, cz), rot=(0, yaw, 0), material=crate, bake='env', bevel=0.02)
    for i, (x, cz) in enumerate(((6.0, -5.4), (6.55, -5.0), (6.2, -4.5))):
        z.cyl(f'drum_{i}', 0.29, 0.88, (x, 0.44, cz), material=rust, bake='env', bevel=0.02)
    z.box('pallet', (1.2, 0.14, 1.0), (5.9, 0.07, -3.6), rot=(0, 0.3, 0), material=crate, bake='env')

    # ------------------------------------------------------------ desk (hero)

    z.box('desk_top', (1.8, 0.06, 0.85), (0, DESK_TOP - 0.03, 0), material=wood, bake='hero', bevel=0.012, hotspot=None)
    for sx in (-0.8, 0.8):
        for sz in (-0.36, 0.36):
            z.box(f'desk_leg_{sx}_{sz}', (0.05, DESK_TOP - 0.06, 0.05), (sx, (DESK_TOP - 0.06) / 2, sz), material=steel, bake='hero', bevel=0.004)
        z.box(f'desk_foot_{sx}', (0.07, 0.04, 0.85), (sx, 0.02, 0), material=steel, bake='hero', bevel=0.005)
        z.box(f'desk_rail_{sx}', (0.04, 0.04, 0.72), (sx, DESK_TOP - 0.08, 0), material=steel, bake='hero')
    z.box('desk_brace', (1.6, 0.04, 0.04), (0, 0.25, -0.36), material=steel, bake='hero')
    z.box('desk_tray', (1.2, 0.08, 0.2), (0, DESK_TOP - 0.13, -0.28), material=dark_steel, bake='hero')
    z.box('drawers', (0.42, 0.56, 0.62), (-0.55, 0.32, -0.05), material=dark_steel, bake='hero', bevel=0.008)
    for i in range(3):
        z.box(f'drawer_pull_{i}', (0.14, 0.015, 0.02), (-0.55, 0.5 - i * 0.17, 0.27), material=steel, bake='hero')

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

    # coffee, the to-read pile, a notepad, a little radio
    z.cyl('mug', 0.045, 0.1, (0.52, DESK_TOP + 0.05, 0.12), material=mug_mat, bake='hero', r2=0.047)
    z.tube('mug_handle', [(0.565, DESK_TOP + 0.08, 0.12), (0.6, DESK_TOP + 0.075, 0.12), (0.6, DESK_TOP + 0.03, 0.12), (0.565, DESK_TOP + 0.025, 0.12)], 0.007, material=mug_mat, bake='hero')
    z.cyl('coffee', 0.041, 0.002, (0.52, DESK_TOP + 0.088, 0.12), material=mat('coffee', '#140a05'), bake='hero')
    palette = ['#5a1f1b', '#1f3a4a', '#2f4a2a', '#6b4a1f', '#3a2a4a', '#7a6a55', '#8a3a1a', '#24504f', '#b08a4a']
    y = DESK_TOP
    for i in range(6):
        h = 0.03 + rnd.random() * 0.025
        w, d = 0.22 + rnd.random() * 0.05, 0.15 + rnd.random() * 0.03
        z.box(f'book_{i}', (w, h, d), (-0.62 + (rnd.random() - 0.5) * 0.03, y + h / 2, 0.05), rot=(0, (rnd.random() - 0.5) * 0.35, 0),
              material=mat(f'cover_{i}', palette[i % len(palette)], '#e0d6c0', noise=0.0, scale=1, pattern='stripes', coords='Generated', stretch=(0, 0, 40)) if i % 2 else mat(f'cover_{i}', palette[(i * 3) % len(palette)]),
              bake='hero', bevel=0.003)
        y += h
    z.box('notepad', (0.15, 0.008, 0.21), (-0.36, DESK_TOP + 0.004, 0.27), rot=(0, 0.25, 0), material=paper, bake='hero')
    z.cyl('pen', 0.004, 0.14, (-0.33, DESK_TOP + 0.012, 0.28), rot=(math.pi / 2, 0.9, 0), material=black, bake='hero', segs=8)
    z.box('radio', (0.26, 0.15, 0.1), (0.66, DESK_TOP + 0.075, -0.24), rot=(0, -0.2, 0), material=mat('radio', '#5b4b37', '#2c241a', noise=0.2, scale=20), bake='hero', bevel=0.01)
    z.cyl('radio_dial', 0.025, 0.012, (0.6, DESK_TOP + 0.08, -0.185), rot=(math.pi / 2, -0.2, 0), material=steel, bake='hero')
    z.box('radio_grille', (0.11, 0.09, 0.005), (0.7, DESK_TOP + 0.08, -0.188), rot=(0, -0.2, 0), material=black, bake='hero')

    # bake proxies for the JS monitor (typical 16:10 size): its shadow and glow
    z.box('mon_proxy', (0.62, 0.42, 0.06), (0, 1.12, -0.15), material=black, bake=None, proxy=1)
    z.plane('mon_proxy_glow', 0.58, 0.37, (0, 1.12, -0.115), material=emissive('proxy_amber', '#ffb000', 2.0), proxy=1)
    z.box('mon_proxy_neck', (0.05, 0.22, 0.04), (0, DESK_TOP + 0.11, -0.22), material=black, proxy=1)
    z.box('mon_proxy_base', (0.28, 0.02, 0.18), (0, DESK_TOP + 0.01, -0.2), material=black, proxy=1)

    # the chair, pushed back and swung out
    cx, cz, yaw = 1.2, 0.55, -1.25
    for i in range(5):
        a = i * 2 * math.pi / 5
        z.box(f'chair_leg_{i}', (0.04, 0.035, 0.32), (cx + math.sin(a) * 0.15, 0.06, cz + math.cos(a) * 0.15), rot=(0, a, 0), material=dark_steel, bake='hero')
        z.cyl(f'chair_wheel_{i}', 0.025, 0.02, (cx + math.sin(a) * 0.3, 0.025, cz + math.cos(a) * 0.3), rot=(0, a, math.pi / 2), material=black, bake='hero', segs=10)
    z.cyl('chair_gas', 0.025, 0.36, (cx, 0.24, cz), material=steel, bake='hero', segs=12)
    z.box('chair_seat', (0.5, 0.09, 0.48), (cx, 0.47, cz), rot=(0, yaw, 0), material=leather, bake='hero', bevel=0.03)
    # sitting faces local -z (towards the desk); the back is behind, at +z
    z.box('chair_back', (0.46, 0.62, 0.07), _off((cx, 0.86, cz), yaw, 0, 0.24), rot=(0.12, yaw, 0), material=leather, bake='hero', bevel=0.03)
    for s in (-1, 1):
        ax, az = cx + math.cos(yaw) * 0.26 * s, cz - math.sin(yaw) * 0.26 * s
        z.box(f'chair_arm_{s}', (0.05, 0.03, 0.28), (ax, 0.68, az), rot=(0, yaw, 0), material=black, bake='hero')
        z.box(f'chair_arm_post_{s}', (0.03, 0.2, 0.03), (ax, 0.57, az), rot=(0, yaw, 0), material=dark_steel, bake='hero')

    # ------------------------------------------------------------ pendant lamp (rig)

    lamp = (0.1, 3.25, 0.3)
    z.cyl('lamp_shade', 0.26, 0.24, lamp, material=enamel, bake='rig', r2=0.06, cap=False, segs=32)
    z.cyl('lamp_cap', 0.065, 0.06, (lamp[0], lamp[1] + 0.14, lamp[2]), material=enamel, bake='rig', segs=16)
    z.tube('lamp_cord', [(lamp[0], lamp[1] + 0.16, lamp[2]), (lamp[0], 7.0, lamp[2]), (lamp[0] + 0.2, 7.35, lamp[2] - 0.3)], 0.006, material=black, bake='rig')
    z.cyl('lamp_bulb', 0.045, 0.07, (lamp[0], lamp[1] - 0.05, lamp[2]), material=emissive('bulb', '#ffd9a0', 12), live=1, segs=16)
    z.light('SPOT', (lamp[0], lamp[1] - 0.08, lamp[2]), '#ffcf96', 420, size=0.08, aim=(lamp[0], 0, lamp[2]), spot=math.radians(100), blend=0.6, name='lamp')
    z.light('POINT', (lamp[0], lamp[1] + 0.02, lamp[2]), '#ffcf96', 15, size=0.05, name='lamp_up')

    # ------------------------------------------------------------ the wall of screens (rig)

    bezel = mat('bezel', '#17181c', '#0b0b0d', noise=0.2, scale=25)
    screen_glow = {0: ('#ffb000', 1.6), 1: ('#2ad4c9', 1.2)}
    for col, a in enumerate(ANGLES):
        for row, y in enumerate(ROWS_Y):
            x, sz = WALL_R * math.sin(a), WALL_CZ - WALL_R * math.cos(a)
            tilt = 0.12 if row == 2 else (-0.05 if row == 0 else 0.0)
            yaw = -a
            bpos = (x, y, sz)
            z.box(f'scr_bezel_{col}_{row}', (SCR_W + 0.06, SCR_H + 0.06, 0.05), _off(bpos, yaw, tilt, -0.03), rot=(tilt, yaw, 0), material=bezel, bake='rig', bevel=0.008)
            z.box(f'scr_back_{col}_{row}', (SCR_W * 0.6, SCR_H * 0.6, 0.08), _off(bpos, yaw, tilt, -0.09), rot=(tilt, yaw, 0), material=bezel, bake='rig', bevel=0.01)
            color, k = screen_glow[(col + row) % 2]
            z.plane(f'screen_{col}_{row}', SCR_W, SCR_H, _off(bpos, yaw, tilt, 0.0), rot=(tilt, yaw, 0),
                    material=emissive(f'screen_{(col + row) % 2}', color, k, textured=True), role='screen', col=col, row=row,
                    hotspot='blog' if (col, row) == (3, 1) else None)
        # a post behind each column of screens
        px, pz = (WALL_R + 0.16) * math.sin(a), WALL_CZ - (WALL_R + 0.16) * math.cos(a)
        z.box(f'scr_post_{col}', (0.07, 2.95, 0.07), (px, 1.475, pz), rot=(0, -a, 0), material=dark_steel, bake='rig')
        z.box(f'scr_post_foot_{col}', (0.3, 0.03, 0.3), (px, 0.015, pz), rot=(0, -a, 0), material=dark_steel, bake='rig')
        # cables drooping from the screens to the floor
        for k in range(2):
            r0 = WALL_R + 0.12 + k * 0.05
            a0 = a + (k - 0.5) * 0.04
            top = (r0 * math.sin(a0), 2.3 - k * 0.5, WALL_CZ - r0 * math.cos(a0))
            r1 = WALL_R + 0.5 + k * 0.3
            low = ((r0 + 0.1) * math.sin(a0), 0.4, WALL_CZ - (r0 + 0.1) * math.cos(a0))
            end = (r1 * math.sin(a0 + 0.05), 0.012, WALL_CZ - r1 * math.cos(a0 + 0.05))
            z.tube(f'scr_cable_{col}_{k}', [top, low, end], 0.012, material=black, bake='rig')
    # curved rails across the back of the array
    for i, y in enumerate((0.88, 1.53, 2.15, 2.82)):
        pts = []
        for s in range(25):
            a = math.radians(-56 + s * 112 / 24)
            r = WALL_R + 0.12
            pts.append((r * math.sin(a), y, WALL_CZ - r * math.cos(a)))
        z.tube(f'scr_rail_{i}', pts, 0.025, material=dark_steel, bake='rig', segs=8)

    # server racks flanking the array, LEDs live
    led_a = emissive('led_teal', '#2ad4c9', 6)
    led_b = emissive('led_amber', '#ffb000', 6)
    for s in (-1, 1):
        a = math.radians(64) * s
        rx, rz = (WALL_R + 0.25) * math.sin(a), WALL_CZ - (WALL_R + 0.25) * math.cos(a)
        z.box(f'rack_{s}', (0.62, 2.1, 0.8), (rx, 1.05, rz), rot=(0, -a, 0), material=mat('rack', '#15161a', '#0a0a0c', noise=0.3, scale=30), bake='rig', bevel=0.01)
        for u in range(9):
            uy = 0.35 + u * 0.19
            fx, fz = rx + math.sin(-a) * 0.41, rz + math.cos(-a) * 0.41
            z.box(f'rack_unit_{s}_{u}', (0.56, 0.12, 0.02), (fx, uy, fz), rot=(0, -a, 0), material=dark_steel, bake='rig')
            for l in range(3):
                if rnd.random() < 0.7:
                    off = -0.22 + l * 0.035
                    lx, lz = fx + math.cos(-a) * off + math.sin(-a) * 0.012, fz - math.sin(-a) * off + math.cos(-a) * 0.012
                    z.box(f'rack_led_{s}_{u}_{l}', (0.012, 0.012, 0.004), (lx, uy, lz), rot=(0, -a, 0), material=led_a if rnd.random() < 0.6 else led_b, live=1)

    # ------------------------------------------------------------ neon (live) + window light

    teal = emissive('neon_teal', '#2ad4c9', 7)
    orange = emissive('neon_orange', '#ff7a1a', 7)
    z.text('neon_sach', 'SÁCH', 0.95, (-2.4, 4.75, -6.8), material=teal, tube=0.016, role='flicker')
    for x in (-3.2, -1.6):
        z.cyl(f'neon_sach_rod_{x}', 0.006, 1.2, (x, 5.75, -6.82), material=dark_steel, bake='rig', segs=6)
    z.text('neon_dhr', 'DHR.VN', 0.5, (4.2, 2.8, -2.6), rot=(0, -0.85, 0), material=orange, tube=0.012)
    z.box('neon_dhr_back', (1.7, 0.42, 0.03), _off((4.2, 2.8, -2.6), -0.85, 0, -0.04), rot=(0, -0.85, 0), material=dark_steel, bake='rig')
    for x, m in ((-4.3, teal), (4.3, orange)):
        z.cyl(f'neon_tube_{x}', 0.02, 3.0, (x, 2.2, -3.2), material=m, segs=12)
        z.box(f'neon_tube_bracket_{x}', (0.06, 3.1, 0.05), (x + (0.05 if x < 0 else -0.05), 2.2, -3.25), material=dark_steel, bake='rig')

    # moonlight + city glow through the window, a low teal fill
    z.light('AREA', (0, 4.0, -7.6), '#5fa8d3', 2500, size=(10, 5), aim=(0, 3.2, 0), name='window')
    z.light('AREA', (0, 1.0, -8.5), '#ff9a4a', 700, size=(12, 1.0), aim=(0, 4, 0), name='city_glow')
    z.light('AREA', (0, 8.5, 0), '#2a3a50', 400, size=(14, 12), aim=(0, 0, 0), name='skylight')
    return z


def _off(pos, yaw, tilt, d):
    """Move `d` along the local +z of something yawed/tilted at pos."""
    x, y, zz = pos
    return (x + math.sin(yaw) * math.cos(tilt) * d, y - math.sin(tilt) * d, zz + math.cos(yaw) * math.cos(tilt) * d)
