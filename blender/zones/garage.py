# Garage: the time machine (zones/delorean.py) under a single spotlight, doors
# up; tool chest, welder, tyres, an oil slick, the roller door behind. Will hold
# projects / things I've built; for now it's a place to stand and look at the car.
#
# Zone frame: origin (8, 0, 10), yaw -90° - 20°: the roller door is in the
# east wall. The car sits at the origin, nose towards local -x.

import math

from lib import Zone, mat, pbr
from zones import delorean

GROUPS = {
    'car': {'size': 1024},   # the DeLorean
    'env': {'size': 1024},   # floor, door, tools
}


def build(quick=False):
    z = Zone('garage', origin=(8.0, 0, 10.0), yaw=-math.pi / 2 - 0.35)

    floor = pbr('g_floor', 'concrete_floor_damaged_01', scale=3.0, rough=0.5, tint='#4a4744', tex=1024)
    concrete = pbr('g_wall', 'concrete_wall_004', scale=2.5, tex=512)
    oil = mat('g_oil', '#0a0a0e', rough=0.05)
    stencil = mat('g_stencil', '#c9c0a8', rough=0.9)
    black = mat('g_black', '#141416', rough=0.6)

    # ------------------------------------------------------------ room (env)
    z.box('floor', (6.4, 0.1, 6.0), (0, -0.05, 0.6), material=floor, bake='env', texel=0.6)
    z.box('oil_slick', (1.4, 0.003, 0.9), (0.5, 0.0015, 0.25), rot=(0, 0.4, 0), material=oil, bake='env')
    z.box('wall', (7.0, 5.5, 0.3), (0, 2.75, -2.75), material=concrete, bake='env', texel=0.5)
    z.model('shutter', 'rollershutter_door', (0, 0, -2.5), scale=1.45, bake='env', max_tris=3000, tex=512)
    z.text('bay_number', 'BAY 03', 0.4, (0, 4.4, -2.58), material=stencil, bake='env')

    # ------------------------------------------------------------ the time machine
    delorean.build(z, origin=(0, 0, 0.1))

    # ------------------------------------------------------------ the workshop (Poly Haven, CC0)
    z.model('tool_chest', 'metal_tool_chest', (-2.6, 0, -1.6), rot=(0, 0.4, 0), bake='env', tex=512)
    z.model('tool_cart', 'tool_cart', (-2.4, 0, 1.2), rot=(0, 1.2, 0), bake='env', max_tris=6000, tex=512)
    z.model('welder', 'portable_welding_cart', (2.7, 0, -1.7), rot=(0, -0.5, 0), bake='env', max_tris=5000)
    for i in range(3):
        z.model(f'tyre_{i}', 'old_tyre', (2.7, 0.3 + i * 0.165, -0.5), rot=(math.pi / 2, i * 0.4, 0), bake='env')
    z.model('hand_truck', 'hand_truck', (-2.9, 0, -0.2), rot=(0, 1.0, 0), bake='env')
    z.model('jerrycan', 'metal_jerrycan', (2.2, 0, 1.6), rot=(0, 0.7, 0), bake='env')
    z.model('gas', 'propane_tank', (-1.9, 0, -2.2), bake='env')

    # ------------------------------------------------------------ the one spotlight
    z.model('spot_lamp', 'hanging_industrial_lamp', (0, 3.9, 0), bake='env', max_tris=5000, tex=512)
    z.tube('spot_cord', [(0, 5.2, 0), (0, 8.5, 0)], 0.008, material=black, bake='env')
    z.light('SPOT', (0, 3.95, 0), '#fff0d8', 650, size=0.15, aim=(0, 0, 0), spot=math.radians(52), blend=0.35, name='spot')
    z.empty('shaft', (0, 3.95, 0), role='shaft', r=1.9, h=3.9, color='#fff0d8')
    # live light for the stainless highlights (the bake does the diffuse)
    z.empty('spot_live', (0, 3.95, 0), role='light', color='#fff0d8', intensity=40, angle=0.62, distance=9)
    z.light('AREA', (0, 4.5, 2.5), '#1c2a3a', 80, size=(6, 4), aim=(0, 0, 0), name='fill')
    z.light('AREA', (0, 0.6, -2.4), '#ff9a4a', 20, size=(4.2, 0.2), aim=(0, 0.3, 0), name='door_gap')  # street light under the door
    return z
