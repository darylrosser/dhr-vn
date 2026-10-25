# Lounge: an old leather sofa on a big rug, a low table, a record player on a
# credenza (the record spins), an arc lamp, a CRT, a payphone on the wall and
# an F1 sim rig in the corner, its screen showing live timing.
# "Pull up a seat": /contact/ lives here.
#
# Zone frame: origin (-6.5, 0, 8), yaw 90° + 20°. The sofa faces local +z.

import math
import random

from lib import Zone, emissive, mat, pbr

GROUPS = {
    'hero': {'size': 1024},
    'env': {'size': 1024},
}


def build(quick=False):
    rnd = random.Random(24)
    z = Zone('lounge', origin=(-6.5, 0, 8.0), yaw=math.pi / 2 + 0.35)

    concrete = pbr('lo_floor', 'concrete_floor_damaged_01', scale=3.0, rough=0.55, tint='#4a4744', tex=1024)
    brick = pbr('lo_brick', 'factory_brick', scale=2.4, tex=512)
    rug = pbr('lo_rug', 'fabric_pattern_05', scale=1.5, tex=512)
    walnut = pbr('lo_walnut', 'dark_wood', scale=1.0, tex=512)
    black = mat('lo_black', '#151517', rough=0.5)
    alu = pbr('lo_alu', 'metal_plate', scale=0.5, tint='#b0b4ba', tex=256)
    brass = mat('lo_brass', '#9a7a32', rough=0.35, metal=1.0)
    linen = mat('lo_linen', '#e6d2aa', rough=0.9)
    sleeves = [mat(f'lo_sleeve_{i}', c, rough=0.6) for i, c in enumerate(('#c2452d', '#e2c044', '#2d6a8a', '#1b1b1b', '#e8e2d4', '#7a3a8a'))]

    # ------------------------------------------------------------ room (env)
    z.box('floor', (6.0, 0.1, 5.0), (0, -0.05, 0.4), material=concrete, bake='env', texel=0.6)
    z.box('wall', (6.4, 4.5, 0.3), (0, 2.25, -2.0), material=brick, bake='env', texel=0.6)
    z.box('rug', (3.4, 0.012, 2.4), (0, 0.006, 0.55), material=rug, bake='env')

    # ------------------------------------------------------------ the sofa (hero, the hotspot) + Poly Haven props
    z.model('sofa', 'sofa_03', (0, 0, -0.75), bake='hero', max_tris=8000, tex=1024, hotspot='contact')
    z.model('pillows', 'throw_pillows_01', (0.3, 0.42, -0.85), bake='hero', tex=512)
    z.model('ottoman', 'Ottoman_01', (-1.5, 0, 0.9), rot=(0, 0.4, 0), bake='hero', tex=512)
    z.model('payphone', 'korean_public_payphone_01', (2.1, 1.1, -1.82), bake='hero', max_tris=8000, tex=512, hotspot='contact')
    z.model('crt', 'Television_01', (-2.6, 0.97, -0.6), rot=(0, 0.9, 0), bake='hero', tex=512)

    # coffee table with a couple of drinks and a magazine
    z.model('coffee_table', 'coffee_table_round_01', (0, 0, 0.55), bake='hero', tex=512)
    z.box('magazine', (0.22, 0.006, 0.3), (-0.25, 0.49, 0.5), rot=(0, 0.3, 0), material=sleeves[0], bake='hero')
    for i, x in enumerate((0.18, 0.32)):
        z.cyl(f'glass_{i}', 0.035, 0.09, (x, 0.535, 0.45 + i * 0.08), material=mat('lo_glass', '#8a9aa0', rough=0.1), bake='hero', segs=16)
        z.cyl(f'whisky_{i}', 0.032, 0.03, (x, 0.505, 0.45 + i * 0.08), material=mat('lo_whisky', '#a8601a', rough=0.1), bake='hero', segs=16)

    # ------------------------------------------------------------ credenza + record player
    cx, cz, cyaw = -2.1, -0.9, 0.5
    def on_credenza(name, size, dx, y, dz, m, **kw):
        c, s_ = math.cos(cyaw), math.sin(cyaw)
        return z.box(name, size, (cx + dx * c + dz * s_, y, cz - dx * s_ + dz * c), rot=(0, cyaw, 0), material=m, **kw)
    on_credenza('credenza', (1.6, 0.6, 0.45), 0, 0.36, 0, walnut, bake='hero', bevel=0.015)
    for i in range(4):
        on_credenza(f'credenza_door_{i}', (0.38, 0.5, 0.01), -0.6 + i * 0.4, 0.36, 0.226, walnut, bake='hero')
    for sx in (-0.7, 0.7):
        on_credenza(f'credenza_leg_{sx}', (0.04, 0.06, 0.04), sx, 0.03, 0.15, walnut, bake='hero')
    on_credenza('turntable', (0.46, 0.08, 0.36), -0.25, 0.7, 0, black, bake='hero', bevel=0.01)
    c, s_ = math.cos(cyaw), math.sin(cyaw)
    px, pz = cx - 0.3 * c, cz + 0.3 * s_
    z.cyl('platter', 0.15, 0.012, (px, 0.746, pz), material=alu, bake='hero', segs=32)
    z.cyl('record', 0.148, 0.004, (px, 0.754, pz), material=mat('lo_vinyl', '#0b0b0b', rough=0.25), bake='hero', segs=40, role='spin', speed=3.5)
    on_credenza('tonearm', (0.012, 0.012, 0.22), -0.07, 0.76, 0.02, alu, bake='hero')
    for i in range(14):  # records in the cabinet's top rack
        on_credenza(f'lp_{i}', (0.008, 0.31, 0.31), 0.18 + i * 0.022, 0.82, 0, sleeves[i % len(sleeves)], bake='hero')
    for sx in (-1.25, 1.25):
        on_credenza(f'speaker_{sx}', (0.28, 0.85, 0.28), sx, 0.425, 0.02, black, bake='hero', bevel=0.01)
        for k, (y, r) in enumerate(((0.62, 0.08), (0.3, 0.05))):
            dx = sx
            z.cyl(f'cone_{sx}_{k}', r, 0.01, (cx + dx * c + 0.16 * s_, y, cz - dx * s_ + 0.16 * c), rot=(math.pi / 2, cyaw, 0), material=mat('lo_cone', '#2a2a2c', rough=0.8), bake='hero', segs=20)

    # arc floor lamp over the sofa
    z.cyl('arc_base', 0.16, 0.05, (1.6, 0.025, -1.1), material=pbr('lo_marble', 'marble_01', scale=0.5, tex=256), bake='hero', segs=24)
    z.tube('arc_pole', [(1.6, 0.05, -1.1), (1.6, 1.2, -1.1), (1.4, 2.0, -0.9), (0.8, 2.15, -0.5), (0.4, 1.95, -0.3)], 0.012, material=brass, bake='hero')
    z.cyl('arc_shade', 0.2, 0.18, (0.4, 1.85, -0.3), material=brass, bake='hero', r2=0.05, cap=False, segs=24)
    z.cyl('arc_bulb', 0.04, 0.05, (0.4, 1.8, -0.3), material=emissive('lo_bulb', '#ffcf8a', 9), live=1, segs=12)
    z.light('SPOT', (0.4, 1.78, -0.3), '#ffbf78', 260, size=0.1, aim=(0.2, 0, 0), spot=math.radians(110), blend=0.6, name='arc')
    # small table lamp on the credenza
    on_credenza('t_lamp_base', (0.1, 0.25, 0.1), 0.62, 0.79, -0.05, brass, bake='hero')
    lx, lz = cx + 0.62 * c - 0.05 * s_, cz - 0.62 * s_ - 0.05 * c
    z.cyl('t_lamp_shade', 0.13, 0.16, (lx, 1.0, lz), material=linen, bake='hero', r2=0.09, cap=False, segs=20)
    z.cyl('t_lamp_bulb', 0.025, 0.04, (lx, 0.98, lz), material=emissive('lo_bulb2', '#ffcf8a', 8), live=1, segs=10)
    z.light('POINT', (lx, 0.98, lz), '#ffbf78', 35, size=0.06, name='t_lamp')

    # ------------------------------------------------------------ F1 sim rig in the corner
    rx, rz, ryaw = 2.25, -0.4, -0.7
    def rig(name, size, dx, y, dz, m, rot=(0, 0, 0), **kw):
        c2, s2 = math.cos(ryaw), math.sin(ryaw)
        return z.box(name, size, (rx + dx * c2 + dz * s2, y, rz - dx * s2 + dz * c2), rot=(rot[0], ryaw + rot[1], rot[2]), material=m, bake='hero', **kw)
    for sx in (-0.25, 0.25):
        rig(f'rig_rail_{sx}', (0.045, 0.045, 1.5), sx, 0.05, 0, alu)
    for dz in (-0.7, 0.0, 0.7):
        rig(f'rig_cross_{dz}', (0.6, 0.045, 0.045), 0, 0.05, dz, alu)
    rig('rig_seat', (0.5, 0.12, 0.5), 0, 0.3, 0.35, black, bevel=0.04)
    rig('rig_seatback', (0.5, 0.75, 0.12), 0, 0.62, 0.62, black, rot=(0.5, 0, 0), bevel=0.05)
    rig('rig_wheel_post', (0.045, 0.75, 0.045), 0, 0.4, -0.5, alu)
    rig('rig_wheel_arm', (0.045, 0.045, 0.3), 0, 0.77, -0.38, alu)
    c2, s2 = math.cos(ryaw), math.sin(ryaw)
    wx, wz = rx - 0.25 * s2, rz - 0.25 * c2
    pts = [(wx + 0.15 * math.cos(a) * c2, 0.85 + 0.15 * math.sin(a), wz - 0.15 * math.cos(a) * s2) for a in [i * math.pi / 8 for i in range(17)]]
    z.tube('rig_wheel', pts, 0.016, material=black, bake='hero', segs=8)
    rig('rig_pedals', (0.3, 0.12, 0.12), 0, 0.12, -0.65, alu)
    rig('rig_monitor', (0.9, 0.52, 0.04), 0, 1.05, -0.95, black, bevel=0.01)
    sx_, sz_ = rx - 0.93 * s2, rz - 0.93 * c2
    # the screen shows live timing (painted by JS); a lamp over the rig so you can see it
    z.plane('rig_screen', 0.84, 0.46, (sx_ + s2 * 0.025, 1.05, sz_ + c2 * 0.025), rot=(0, ryaw, 0), material=emissive('lo_f1', '#ffb000', 1.4, textured=True), role='display', painter='timing')
    z.light('SPOT', (rx + 0.3, 3.2, rz + 0.4), '#ffd9a0', 220, size=0.2, aim=(rx, 0.4, rz), spot=math.radians(60), blend=0.6, name='rig_lamp')
    z.model('rig_lamp', 'hanging_industrial_lamp', (rx + 0.3, 3.1, rz + 0.4), bake='hero', max_tris=3000, tex=256)
    z.cyl('rig_lamp_bulb', 0.04, 0.06, (rx + 0.3, 3.25, rz + 0.4), material=emissive('lo_rig_bulb', '#ffcf96', 6), live=1, segs=12)
    rig('rig_monitor_stand', (0.06, 0.8, 0.06), 0, 0.4, -1.0, alu)

    # neon: "hello" in Vietnamese, warm pink, over the sofa
    z.text('neon_xin_chao', 'xin chào', 0.42, (0, 2.5, -1.82), material=emissive('lo_neon', '#ff4f8a', 7), tube=0.011, role='flicker')

    z.light('AREA', (0, 4.2, 1.0), '#2a3a50', 90, size=(5, 4), aim=(0, 0, 0), name='fill')
    z.light('AREA', (0, 2.5, -1.6), '#ff4f8a', 25, size=(1.6, 0.4), aim=(0, 1, 1), name='neon_spill')
    return z
