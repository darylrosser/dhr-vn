# Garage: a generic 80s gull-wing wedge (brushed stainless, doors up) under a
# single spotlight, tool chest, tyres, an oil-slick floor, the roller door
# behind. Will hold projects / things I've built; for now it's a place to
# stand and look at the car.
#
# The car is modelled from scratch as a generic wedge: no real make, no badges.
#
# Zone frame: origin (8, 0, 10), yaw -90° - 20°: the roller door is in the
# east wall. The car sits at the origin, nose towards local -x.

import math

import bmesh

from lib import Zone, mat, emissive, finish, join

GROUPS = {
    'hero': {'size': 2048, 'exposure': 1.5},  # the car
    'env': {'size': 2048, 'exposure': 1.5},   # floor, door, tools
}

# side profile of the body, (x along the car, y up), nose at -x
PROFILE = [(-2.12, 0.28), (-2.16, 0.46), (-2.1, 0.6), (-0.75, 0.86), (-0.15, 1.14), (0.62, 1.14), (1.55, 0.98), (2.1, 0.94), (2.14, 0.6), (2.08, 0.3), (1.6, 0.22), (-1.6, 0.22)]


def body_mesh(name, width=1.85, taper=0.12):
    """Extrude the profile across the width; the top tucks in (tumblehome)."""
    bm = bmesh.new()
    left, right = [], []
    for x, y in PROFILE:
        k = max(0.0, (y - 0.6) / 0.54)  # 0 at the beltline, 1 at the roof
        half = width / 2 - taper * k
        # Blender coords: three (x, y, z) → (x, -z, y)
        left.append(bm.verts.new((x, -half, y)))
        right.append(bm.verts.new((x, half, y)))
    n = len(PROFILE)
    bm.faces.new(left[::-1])
    bm.faces.new(right)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.025, segments=2, affect='EDGES', clamp_overlap=True)
    return finish(bm, name)


def build(quick=False):
    z = Zone('garage', origin=(8.0, 0, 10.0), yaw=-math.pi / 2 - 0.35)

    floor = mat('g_floor', '#2c2c30', '#0f0f12', noise=0.5, scale=0.5, detail=12)
    oil = mat('g_oil', '#141018', '#1a2a2a', noise=0.6, scale=3)
    shutter = mat('g_shutter', '#4a4c50', '#26282b', scale=30, pattern='stripes', coords='Object', stretch=(0, 0, 1))
    concrete = mat('g_wall', '#3a3a3c', '#1a1a1c', noise=0.4, scale=1.5)
    steel = mat('g_steel', '#9a9ea4', '#6a6e74', noise=0.0, scale=60, coords='Object', pattern='stripes', stretch=(1, 0, 0))
    black = mat('g_black', '#141416', '#09090a', noise=0.3, scale=20)
    glass = mat('g_glass', '#0c1216', '#1c2a30', noise=0.3, scale=3)
    tyre = mat('g_tyre', '#121212', '#1e1e1e', noise=0.3, scale=40)
    rim = mat('g_rim', '#7a7e84', '#3a3c40', noise=0.3, scale=30)
    red = mat('g_toolchest', '#8a1612', '#4a0a08', noise=0.25, scale=20)
    hazard = mat('g_hazard', '#c08a10', '#151515', scale=6, pattern='stripes', coords='Generated')
    seat = mat('g_seat', '#2a2624', '#141211', noise=0.4, scale=18)

    # ------------------------------------------------------------ room (env)
    z.box('floor', (6.4, 0.1, 6.0), (0, -0.05, 0.6), material=floor, bake='env', texel=0.6)
    z.box('oil_slick', (1.6, 0.004, 1.1), (0.4, 0.002, 0.2), rot=(0, 0.4, 0), material=oil, bake='env')
    z.box('wall', (7.0, 5.5, 0.3), (0, 2.75, -2.75), material=concrete, bake='env', texel=0.5)
    z.box('shutter', (4.4, 3.6, 0.06), (0, 1.8, -2.56), material=shutter, bake='env')
    z.box('shutter_box', (4.7, 0.45, 0.4), (0, 3.8, -2.45), material=black, bake='env', bevel=0.02)
    for sx in (-2.3, 2.3):
        z.box(f'shutter_guide_{sx}', (0.12, 3.6, 0.16), (sx, 1.8, -2.52), material=black, bake='env')
    z.box('hazard_l', (0.25, 1.2, 0.02), (-2.6, 0.6, -2.58), material=hazard, bake='env')
    z.box('hazard_r', (0.25, 1.2, 0.02), (2.6, 0.6, -2.58), material=hazard, bake='env')
    z.text('bay_number', 'BAY 03', 0.4, (0, 4.4, -2.58), material=mat('g_stencil', '#c9c0a8'), bake='env')

    # ------------------------------------------------------------ the car (hero), nose to -x
    car = [z.add('car_body', body_mesh('car_body'), (0, 0, 0), material=steel, bake='hero')]
    # black lower band, bumpers, wheel arches
    car.append(z.box('car_band', (4.3, 0.12, 1.88), (0, 0.32, 0), material=black, bake='hero', bevel=0.02))
    car.append(z.box('bumper_f', (0.12, 0.16, 1.9), (-2.16, 0.34, 0), material=black, bake='hero', bevel=0.03))
    car.append(z.box('bumper_r', (0.12, 0.16, 1.9), (2.15, 0.34, 0), material=black, bake='hero', bevel=0.03))
    for wx in (-1.28, 1.3):
        for s in (-1, 1):
            car.append(z.cyl(f'tyre_{wx}_{s}', 0.33, 0.26, (wx, 0.33, s * 0.83), rot=(math.pi / 2, 0, 0), material=tyre, bake='hero', segs=28, bevel=0.04))
            car.append(z.cyl(f'rim_{wx}_{s}', 0.21, 0.02, (wx, 0.33, s * 0.965), rot=(math.pi / 2, 0, 0), material=rim, bake='hero', segs=20))
    # windscreen + side glass (dark), rear louvres
    car.append(z.box('windscreen', (0.66, 0.012, 1.5), (-0.46, 1.0, 0), rot=(0, 0, -math.atan2(0.28, 0.6)), material=glass, bake='hero'))
    for i in range(7):
        car.append(z.box(f'louvre_{i}', (0.06, 0.02, 1.36), (0.82 + i * 0.1, 1.13 - i * 0.022, 0), rot=(0, 0, -0.2), material=black, bake='hero'))
    # the door openings: dark recesses where the gull-wings came up from
    for s in (-1, 1):
        car.append(z.box(f'door_hole_{s}', (1.2, 0.48, 0.02), (-0.05, 0.86, s * 0.88), rot=(s * 0.12, 0, 0), material=black, bake='hero'))
    # seats inside
    for s in (-1, 1):
        car.append(z.box(f'seat_{s}', (0.5, 0.5, 0.45), (0.15, 0.62, s * 0.38), rot=(0, 0, 0.25), material=seat, bake='hero', bevel=0.05))
    # gull-wing doors raised: hinged on the roof centre line
    for s in (-1, 1):
        door = z.box(f'door_{s}', (1.2, 0.04, 0.62), (-0.05, 1.42, s * 0.42), rot=(s * 0.95, 0, 0), material=steel, bake='hero', bevel=0.015)
        car.append(door)
        car.append(z.box(f'door_glass_{s}', (1.0, 0.045, 0.32), (-0.05, 1.43, s * 0.4), rot=(s * 0.95, 0, 0), material=glass, bake='hero'))
    car_obj = join(car, 'car')
    car_obj['hotspot'] = 'garage'
    # lights (live): headlights, a red bar across the tail
    head = emissive('g_head', '#e8f0ff', 3)
    for s in (-1, 1):
        z.box(f'headlight_{s}', (0.02, 0.09, 0.32), (-2.155, 0.55, s * 0.6), material=head, live=1)
    z.box('taillight', (0.02, 0.09, 1.5), (2.15, 0.78, 0), material=emissive('g_tail', '#ff1a1a', 4), live=1)
    z.box('plate', (0.02, 0.11, 0.42), (2.16, 0.5, 0), material=mat('g_plate', '#d8d2c0'), bake='hero')
    z.text('plate_text', 'DHR 88', 0.07, (2.172, 0.5, 0), rot=(0, math.pi / 2, 0), material=mat('g_plate_ink', '#1a1a1a'), bake='hero')

    # ------------------------------------------------------------ tool chest, tyres, jack (env)
    tx, tz = -2.6, -1.4
    z.box('chest', (1.0, 1.0, 0.5), (tx, 0.56, tz), rot=(0, 0.4, 0), material=red, bake='env', bevel=0.015)
    z.box('chest_top', (1.04, 0.4, 0.48), (tx, 1.3, tz), rot=(0, 0.4, 0), material=red, bake='env', bevel=0.015)
    for i in range(6):
        c, s = math.cos(0.4), math.sin(0.4)
        y = 0.25 + i * 0.15 if i < 5 else 1.32
        z.box(f'chest_handle_{i}', (0.7, 0.015, 0.02), (tx + 0.26 * s, y + 0.05, tz + 0.26 * c), rot=(0, 0.4, 0), material=steel, bake='env')
    for k in range(4):
        z.cyl(f'chest_caster_{k}', 0.04, 0.03, (tx + (-0.4 if k % 2 else 0.4) * math.cos(0.4), 0.04, tz - (-0.4 if k % 2 else 0.4) * math.sin(0.4) + (0.15 if k > 1 else -0.15)), rot=(math.pi / 2, 0.4, 0), material=black, bake='env', segs=10)
    for i in range(3):
        z.cyl(f'spare_tyre_{i}', 0.33, 0.24, (2.6, 0.12 + i * 0.245, -1.6), material=tyre, bake='env', segs=28, bevel=0.04)
    z.box('jack', (0.7, 0.12, 0.25), (1.8, 0.06, 1.6), rot=(0, 0.7, 0), material=red, bake='env', bevel=0.01)
    z.cyl('drum', 0.29, 0.88, (-2.7, 0.44, 0.4), material=mat('g_drum', '#1d3a5a', '#0e1c2c', noise=0.4, scale=6), bake='env', segs=24, bevel=0.02)

    # ------------------------------------------------------------ the one spotlight
    z.cyl('spot_shade', 0.28, 0.3, (0, 4.2, 0), material=black, bake='env', r2=0.1, cap=False, segs=24)
    z.cyl('spot_bulb', 0.06, 0.04, (0, 4.1, 0), material=emissive('g_bulb', '#fff2dc', 14), live=1, segs=16)
    z.tube('spot_cord', [(0, 4.35, 0), (0, 8.5, 0)], 0.008, material=black, bake='env')
    z.light('SPOT', (0, 4.05, 0), '#fff0d8', 650, size=0.15, aim=(0, 0, 0), spot=math.radians(52), blend=0.35, name='spot')
    z.empty('shaft', (0, 4.05, 0), role='shaft', r=1.9, h=4.0, color='#fff0d8')
    z.light('AREA', (0, 4.5, 2.5), '#1c2a3a', 80, size=(6, 4), aim=(0, 0, 0), name='fill')
    z.light('AREA', (0, 0.6, -2.4), '#ff9a4a', 20, size=(4.2, 0.2), aim=(0, 0.3, 0), name='door_gap')  # street light under the door
    return z
