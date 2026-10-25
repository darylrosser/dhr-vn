# Gym: squat rack with a loaded bar, plate tree, bench, kettlebells, a heavy
# bag, rubber floor, chalk dust in a shaft of light from a skylight and a
# whiteboard of PRs (painted by JS). A future "now" / training page.
#
# Zone frame: origin (0, 0, 14.5), yaw 180°: against the north (front) wall,
# looking back towards the desk. The rack stands at the origin.

import math

from lib import Zone, emissive, join, mat, pbr

GROUPS = {
    'hero': {'size': 1024},
    'env': {'size': 1024},
}


def build(quick=False):
    z = Zone('gym', origin=(0.0, 0, 14.5), yaw=math.pi)

    rubber = pbr('gy_rubber', 'rubber_tiles', scale=1.0, tint='#6a6a6a', tex=1024)
    concrete = pbr('gy_wall', 'concrete_wall_004', scale=2.5, tint='#8a8a8a', tex=512)
    rack = pbr('gy_rack', 'metal_plate_02', scale=0.6, tint='#3a3c40', tex=256)
    bar = mat('gy_bar', '#b8bcc2', rough=0.3, metal=1.0)
    plate_black = mat('gy_plate', '#161618', rough=0.7)
    plate_red = mat('gy_plate_red', '#9a1c18', rough=0.6)
    plate_blue = mat('gy_plate_blue', '#1a3a8a', rough=0.6)
    vinyl = pbr('gy_vinyl', 'fabric_leather_01', scale=0.5, tint='#3a3a3a', tex=256)
    chalk = mat('gy_chalk', '#e6e4de', rough=0.95)
    frame = mat('gy_frame', '#8a8e94')

    # ------------------------------------------------------------ room (env)
    z.box('floor', (6.0, 0.1, 5.0), (0, -0.05, 0.6), material=rubber, bake='env', texel=0.6)
    z.box('wall', (6.6, 6.0, 0.3), (0, 3.0, -2.7), material=concrete, bake='env', texel=0.5)
    z.text('sector', '04', 1.6, (-1.9, 2.6, -2.54), material=mat('gy_paint', '#8a6a1a'), bake='env')
    z.text('motto', 'KHÔNG ĐAU KHÔNG TIẾN', 0.18, (1.3, 3.3, -2.54), material=mat('gy_paint2', '#a8a090'), bake='env')

    # ------------------------------------------------------------ squat rack + loaded bar (hero)
    parts = []
    for x in (-0.6, 0.6):
        for zz in (-0.55, 0.55):
            parts.append(z.box(f'rack_up_{x}_{zz}', (0.075, 2.3, 0.075), (x, 1.15, zz), material=rack, bake='hero', bevel=0.006))
        parts.append(z.box(f'rack_base_{x}', (0.075, 0.075, 1.4), (x, 0.04, 0), material=rack, bake='hero'))
        parts.append(z.box(f'rack_safety_{x}', (0.05, 0.05, 1.3), (x, 0.7, 0), material=bar, bake='hero'))
        parts.append(z.box(f'rack_hook_{x}', (0.09, 0.08, 0.09), (x, 1.32, 0.55), material=bar, bake='hero'))
    for zz in (-0.55, 0.55):
        parts.append(z.box(f'rack_top_{zz}', (1.28, 0.075, 0.075), (0, 2.27, zz), material=rack, bake='hero'))
    parts.append(z.box('rack_pullup', (1.28, 0.04, 0.04), (0, 2.2, 0.62), material=bar, bake='hero'))
    for x in (-0.6, 0.6):  # J-hook holes
        for k in range(16):
            parts.append(z.box(f'rack_hole_{x}_{k}', (0.02, 0.02, 0.002), (x, 0.4 + k * 0.1, 0.589), material=mat('gy_hole', '#050505'), bake='hero'))
    join(parts, 'rack')

    z.cyl('barbell', 0.014, 2.2, (0, 1.39, 0.55), rot=(0, 0, math.pi / 2), material=bar, bake='hero', segs=12)
    for s in (-1, 1):
        z.cyl(f'sleeve_{s}', 0.025, 0.42, (s * 0.88, 1.39, 0.55), rot=(0, 0, math.pi / 2), material=bar, bake='hero', segs=16)
        for k, (r, w, m) in enumerate(((0.225, 0.055, plate_red), (0.225, 0.05, plate_blue), (0.16, 0.03, plate_black))):
            z.cyl(f'plate_{s}_{k}', r, w, (s * (0.73 + k * 0.058), 1.39, 0.55), rot=(0, 0, math.pi / 2), material=m, bake='hero', segs=40, bevel=0.006)
        z.cyl(f'collar_{s}', 0.04, 0.03, (s * 0.92, 1.39, 0.55), rot=(0, 0, math.pi / 2), material=bar, bake='hero', segs=16)

    # bench, plate tree, kettlebells, chalk
    z.box('bench_pad', (0.3, 0.09, 1.15), (1.55, 0.44, 0.6), rot=(0, 0.2, 0), material=vinyl, bake='hero', bevel=0.03)
    for dz in (-0.4, 0.4):
        z.box(f'bench_leg_{dz}', (0.32, 0.4, 0.06), (1.55 + dz * math.sin(0.2), 0.2, 0.6 + dz * math.cos(0.2)), rot=(0, 0.2, 0), material=rack, bake='hero')
    z.box('tree_post', (0.06, 1.1, 0.06), (-1.6, 0.55, -0.6), material=rack, bake='hero')
    z.box('tree_base', (0.6, 0.05, 0.6), (-1.6, 0.025, -0.6), material=rack, bake='hero')
    for k, (y, side, m) in enumerate(((0.35, 1, plate_red), (0.35, -1, plate_blue), (0.75, 1, plate_black), (0.75, -1, plate_red))):
        z.cyl(f'tree_plate_{k}', 0.225 if m is not plate_black else 0.16, 0.05, (-1.6 + side * 0.09, y + 0.02, -0.6), rot=(0, 0, math.pi / 2), material=m, bake='hero', segs=40, bevel=0.006)
    for k, (x, zz, r) in enumerate(((-1.0, 1.2, 0.11), (-0.75, 1.3, 0.1), (-0.52, 1.22, 0.09))):
        z.cyl(f'kb_body_{k}', r, r * 1.6, (x, r * 0.8, zz), material=plate_black, bake='hero', segs=20, bevel=r * 0.4)
        z.tube(f'kb_handle_{k}', [(x - r * 0.6, r * 1.5, zz), (x - r * 0.5, r * 2.3, zz), (x + r * 0.5, r * 2.3, zz), (x + r * 0.6, r * 1.5, zz)], 0.016, material=plate_black, bake='hero')
    z.cyl('chalk_bucket', 0.17, 0.3, (0.95, 0.15, -0.6), material=mat('gy_bucket', '#2a2c30'), bake='hero', r2=0.19, segs=24)
    z.cyl('chalk', 0.165, 0.02, (0.95, 0.27, -0.6), material=chalk, bake='hero', segs=24)
    z.box('chalk_dust', (0.9, 0.003, 0.7), (0.55, 0.0015, 0.1), rot=(0, 0.6, 0), material=mat('gy_dust', '#4a4a48', rough=0.95), bake='env')

    # heavy bag on a chain
    z.cyl('bag', 0.18, 1.1, (2.2, 1.35, -0.9), material=pbr('gy_bag', 'leather_red_02', scale=0.6, tex=256), bake='hero', segs=24, bevel=0.05)
    z.tube('bag_chain', [(2.2, 1.9, -0.9), (2.2, 6.2, -0.9)], 0.01, material=bar, bake='hero')

    # whiteboard on a stand (JS writes the PRs)
    z.box('wb_frame', (1.3, 0.9, 0.03), (-1.8, 1.5, 0.6), rot=(0, 0.55, 0), material=frame, bake='hero', bevel=0.008)
    for dx in (-0.6, 0.6):
        z.box(f'wb_leg_{dx}', (0.03, 1.5, 0.03), (-1.8 + dx * math.cos(0.55), 0.75, 0.6 - dx * math.sin(0.55)), rot=(0, 0.55, 0), material=frame, bake='hero')
    wx, wz = -1.8 + math.sin(0.55) * 0.017, 0.6 + math.cos(0.55) * 0.017
    z.plane('whiteboard', 1.22, 0.82, (wx, 1.5, wz), rot=(0, 0.55, 0), material=emissive('gy_board', '#d9dcd6', 0.3, textured=True), role='board', w=1.22, h=0.82, hotspot='gym')

    # ------------------------------------------------------------ skylight shaft
    z.light('SPOT', (0.2, 8.5, 0.3), '#cfe4ff', 1400, size=0.6, aim=(0, 0, 0.3), spot=math.radians(28), blend=0.5, name='skylight')
    z.empty('shaft', (0.2, 6.5, 0.3), role='shaft', r=1.5, h=6.5, color='#cfe4ff')
    z.light('AREA', (0, 3.5, 2.5), '#ffb46a', 90, size=(4, 2), aim=(0, 0.5, 0), name='warm_fill')
    z.light('POINT', (2.6, 3.0, 1.6), '#ff7a1a', 25, size=0.1, name='exit_sign_glow')
    z.box('exit_sign', (0.4, 0.15, 0.04), (2.6, 3.0, -2.53), material=emissive('gy_exit', '#ff7a1a', 4), live=1)
    return z
