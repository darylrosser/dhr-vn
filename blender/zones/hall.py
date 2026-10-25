# The hall: the warehouse itself, everything between the zones. Floor, outer
# walls, roof trusses and a few dim lamps over the walkways, so walking from
# one zone to the next crosses a real (dark, dirty) warehouse floor. Always
# loaded with the first zone. The zones' own floors sit on top of this one.
#
# World frame. The hall spans x -11 … 11, z -7.1 (the window wall, built by
# the deck) … 18.5, 9 m to the roof.

import math

from lib import Zone, emissive, mat, pbr

GROUPS = {
    'env': {'size': 1024},
}

X0, X1, Z0, Z1, H = -11.0, 11.0, -7.1, 18.5, 9.0


def build(quick=False):
    z = Zone('hall')
    floor = pbr('h_floor', 'concrete_floor_damaged_01', scale=3.0, rough=0.5, tint='#4a4744', tex=1024)
    brick = pbr('h_brick', 'factory_brick', scale=2.4, tint='#9a9a9a', tex=512)
    steel = pbr('h_steel', 'metal_plate_02', scale=1.0, tint='#4a4d54', tex=256)
    black = mat('h_black', '#111112', rough=0.6)

    w, d = X1 - X0, Z1 - Z0
    cx, cz = (X0 + X1) / 2, (Z0 + Z1) / 2
    # a hair under the zones' floors, which sit on top
    z.box('floor', (w, 0.1, d), (cx, -0.054, cz), material=floor, bake='env', texel=0.5)
    z.box('wall_w', (0.3, H, d), (X0 - 0.15, H / 2, cz), material=brick, bake='env', texel=0.3)
    z.box('wall_e', (0.3, H, d), (X1 + 0.15, H / 2, cz), material=brick, bake='env', texel=0.3)
    z.box('wall_n', (w + 0.6, H, 0.3), (cx, H / 2, Z1 + 0.15), material=brick, bake='env', texel=0.3)
    # pilasters along the long walls, trusses across the roof
    zs = [Z0 + 1.5 + i * 4.1 for i in range(7)]
    for zz in zs:
        for x in (X0 + 0.2, X1 - 0.2):
            z.box(f'pilaster_{x}_{zz:.1f}', (0.4, H, 0.4), (x, H / 2, zz), material=steel, bake='env', texel=0.3)
        z.box(f'truss_{zz:.1f}', (w, 0.45, 0.3), (cx, 7.4, zz), material=steel, bake='env', texel=0.2)
        z.box(f'truss_low_{zz:.1f}', (w, 0.12, 0.2), (cx, 6.6, zz), material=steel, bake='env', texel=0.2)
        for i in range(15):
            x = X0 + 0.7 + i * (w - 1.4) / 14
            z.box(f'truss_v_{zz:.1f}_{i}', (0.06, 0.8, 0.06), (x, 7.0, zz), rot=(0, 0, 0.5 if i % 2 else -0.5), material=steel, bake='env', texel=0.2)
    # a strip of hazard paint marking the walkway, worn
    for zz in (4.0, 6.5, 9.0, 11.5):
        z.box(f'walkway_{zz}', (0.1, 0.002, 1.6), (-1.6, 0.001, zz), material=mat('h_paint', '#6a5a20', rough=0.8), bake='env')
        z.box(f'walkway_r_{zz}', (0.1, 0.002, 1.6), (1.6, 0.001, zz), material=mat('h_paint', '#6a5a20', rough=0.8), bake='env')

    # dim lamps over the walkway between the zones (their own pools of light)
    bulb = emissive('h_bulb', '#ffcf96', 6)
    for i, (x, zz) in enumerate(((0, 6.0), (0, 10.5), (-3.5, 3.5), (3.5, 4.0))):
        z.model(f'lamp_{i}', 'hanging_industrial_lamp', (x, 4.4, zz), bake='env', max_tris=3000, tex=256)
        z.tube(f'lamp_cord_{i}', [(x, 5.7, zz), (x, 7.2, zz)], 0.006, material=black, bake='env')
        z.cyl(f'lamp_bulb_{i}', 0.04, 0.06, (x, 4.55, zz), material=bulb, live=1, segs=12)
        z.light('SPOT', (x, 4.5, zz), '#ffcf96', 260, size=0.1, aim=(x, 0, zz), spot=math.radians(80), blend=0.7, name=f'lamp_{i}')
    # the exit, front wall
    z.box('exit_sign', (0.5, 0.18, 0.05), (4.0, 3.0, Z1 - 0.03), material=emissive('h_exit', '#2aff6a', 4), live=1)
    z.light('POINT', (4.0, 3.0, Z1 - 0.4), '#2aff6a', 15, size=0.1, name='exit')
    # a cold skylight wash so the dark is never quite black
    z.light('AREA', (cx, H - 0.5, cz), '#2a3a50', 250, size=(w, d), aim=(cx, 0, cz), name='sky')
    return z
