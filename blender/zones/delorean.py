# The time machine: a DMC-12 in brushed stainless with the Back to the Future
# kit (Mr. Fusion, the rear reactor and vents, flux bands along the sills, the
# OUTATIME plate), one gull-wing door up on a cabin you can see into: grey
# leather buckets, the dash and wheel, the time circuits on the console and
# the flux capacitor glowing behind the seats. Modelled from scratch by
# script; no badges or logos.
#
# Car frame (three coords): nose towards -x, centred on the origin, wheels on
# the floor. Overall ≈ 4.2 m × 1.86 m × 1.14 m.

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

from lib import B, brushed_texture, emissive, finish, image_pbr, join, mat, pbr, rot_matrix

HALF_W = 0.93      # body half-width
BELT = 0.80        # beltline / cabin sill height
ROOF = 1.13
WHEELS = ((-1.28, 0.31), (1.30, 0.33))  # (x, radius): 14" front, 15" rear
TRACK = 0.80       # wheel centre offset from the middle

# lower body side profile (x, y), clockwise from the nose bottom; above the
# beltline the cabin (x -0.8 … 0.5) is closed by the doors and windscreen
LOWER = [(-2.06, 0.27), (-2.16, 0.42), (-2.1, 0.6), (-1.6, 0.66), (-0.8, BELT), (0.5, BELT), (0.52, ROOF - 0.02),
         (0.6, ROOF - 0.01), (1.55, 0.93), (2.06, 0.91), (2.12, 0.86), (2.13, 0.42), (2.05, 0.27), (1.6, 0.2), (-1.6, 0.2)]


def half_width(x, y):
    """Plan taper at the nose, tumblehome above the beltline."""
    w = HALF_W
    if x < -1.3:
        w -= 0.12 * min(1.0, (-1.3 - x) / 0.85)
    if y > BELT:
        w -= 0.2 * min(1.0, (y - BELT) / (ROOF - BELT))
    return w


def body_mesh(name):
    bm = bmesh.new()
    left, right = [], []
    for x, y in LOWER:
        w = half_width(x, y)
        left.append(bm.verts.new(B(x, y, -w)))
        right.append(bm.verts.new(B(x, y, w)))
    n = len(LOWER)
    bm.faces.new(left)
    bm.faces.new(right[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], right[i], right[j], left[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.02, segments=2, affect='EDGES', clamp_overlap=True)
    return finish(bm, name)


DOOR_X = (-0.72, 0.42)   # door front and rear edge
SILL = 0.42
CABIN = (-0.78, 0.48)    # the cabin tub, front to back (the body is solid to the beltline)
FLOOR = 0.36


def cut_body(body, open_side=None):
    """Boolean the wheel arches, the cabin tub and (on open_side) the door
    aperture out of the body."""
    cutters = []
    for x, r in WHEELS:
        bpy.ops.mesh.primitive_cylinder_add(radius=r + 0.06, depth=2.6, location=B(x, r, 0), rotation=(0, 0, 0))
        c = bpy.context.object
        c.rotation_euler = (math.pi / 2, 0, 0)  # axis across the car
        cutters.append(c)

    def cutter(x0, x1, y0, y1, z0, z1):
        bpy.ops.mesh.primitive_cube_add(size=1, location=B((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
        c = bpy.context.object
        c.scale = (x1 - x0, z1 - z0, y1 - y0)  # Blender axes: x, -z, y
        cutters.append(c)
    if open_side is not None:
        w = HALF_W - 0.08
        cutter(CABIN[0], CABIN[1], FLOOR, ROOF + 0.3, -w, w)
        z0, z1 = sorted((open_side * 0.4, open_side * (HALF_W + 0.3)))
        cutter(DOOR_X[0], DOOR_X[1], SILL + 0.02, ROOF + 0.3, z0, z1)
    for c in cutters:
        mod = body.modifiers.new('arch', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = c
        with bpy.context.temp_override(object=body, active_object=body):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for c in cutters:
        bpy.data.objects.remove(c)


def door_mesh(name, side, open_ang=0.0):
    """Gull-wing door: roof half (from the centre spine), side glass sloping
    out to the beltline, then the door skin down to the sill. Hinge line
    along x at (z = side * 0.12, y = ROOF); open_ang swings it up about that."""
    bm = bmesh.new()
    zc, zr, zb = 0.12, HALF_W - 0.2, HALF_W + 0.005
    sect = [(ROOF + 0.005, zc), (ROOF, zr), (BELT, zb), (SILL, zb)]
    ca, sa = math.cos(open_ang), math.sin(open_ang)

    def swing(y, w):  # (y, outward) about the hinge (ROOF, zc): outward points swing upward
        return ROOF + (w - zc) * sa + (y - ROOF) * ca, zc + (w - zc) * ca - (y - ROOF) * sa
    rows = []
    for x in DOOR_X:
        row = []
        for y, w in sect:
            # the front edge leans back with the windscreen above the beltline
            # (worked out on the closed door, then the whole door swings up)
            xx = x + (0.3 * (y - BELT) / (ROOF - BELT) if (x < 0 and y > BELT) else 0)
            yy, ww = swing(y, w)
            row.append(bm.verts.new(B(xx, yy, side * ww)))
        rows.append(row)
    for k in range(len(sect) - 1):
        f = bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
        f.material_index = 1 if k == 1 else 0  # the side window is glass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.04)
    return finish(bm, name)


def build(z, origin=(0, 0, 0), yaw=0.0, open_door=None):
    """Add the car to zone z at origin (zone coords). open_door: the side
    (+1 / -1, local z) whose gull-wing is up. Returns the clickable body."""
    ox, oy, oz = origin
    c_, s_ = math.cos(yaw), math.sin(yaw)

    def P(x, y, zz):  # car frame → zone frame
        return (ox + x * c_ + zz * s_, oy + y, oz - x * s_ + zz * c_)

    # stainless that's sat in a workshop for years: dulled, dusty, grimy low down
    stainless = image_pbr('dmc_stainless', brushed_texture('dmc_brushed', base='#8f9295', grime=0.55), scale=0.8, rough=0.5, metal=0.6, tex=512)
    black = mat('dmc_black', '#121214', rough=0.6)
    rubber = mat('dmc_rubber', '#0c0c0d', rough=0.85)
    glass = mat('dmc_glass', '#0d1418', rough=0.05)
    chrome = mat('dmc_chrome', '#d8dadc', rough=0.15, metal=1.0)
    grey = mat('dmc_grey', '#55585e', rough=0.5, metal=0.6)
    copper = mat('dmc_copper', '#b8733a', rough=0.35, metal=1.0)
    white = mat('dmc_white', '#e8e6e0', rough=0.35)

    parts = []

    def box(name, size, pos, rot=(0, 0, 0), m=black, **kw):
        o = z.box(name, size, P(*pos), rot=(rot[0], rot[1] + yaw, rot[2]), material=m, bake='car', **kw)
        parts.append(o)
        return o

    def cyl(name, r, h, pos, rot=(0, 0, 0), m=chrome, **kw):
        o = z.cyl(name, r, h, P(*pos), rot=(rot[0], rot[1] + yaw, rot[2]), material=m, bake='car', **kw)
        parts.append(o)
        return o

    def place(obj):
        obj.matrix_world = Matrix.Translation(B(*z.W(P(0, 0, 0)))) @ rot_matrix(0, yaw + z.yaw, 0)
        z.col.objects.link(obj) if obj.name not in z.col.objects else None
        parts.append(obj)
        return obj

    # body shell with the wheel arches (and, with a door up, the cabin) cut out
    body = bpy.data.objects.new('dmc_body', body_mesh('dmc_body'))
    bpy.context.scene.collection.objects.link(body)
    cut_body(body, open_door)
    bpy.context.scene.collection.objects.unlink(body)
    body.data.materials.clear()  # the cut faces came with the cutters' empty slots
    body.data.materials.append(stainless)
    body.data.polygons.foreach_set('material_index', [0] * len(body.data.polygons))
    place(body)
    body['bake'] = 'car'
    from lib import box_uv
    box_uv(body.data, 2.0, body.matrix_world)

    # bumpers, the side rub strip, the black sills
    box('bumper_f', (0.14, 0.17, 1.72), (-2.13, 0.36, 0), m=black, bevel=0.03)
    box('bumper_r', (0.12, 0.17, 1.84), (2.12, 0.33, 0), m=black, bevel=0.03)
    for sd in (-1, 1):
        box(f'rub_{sd}', (2.9, 0.035, 0.03), (0.05, 0.5, sd * (HALF_W + 0.005)), m=black)
        box(f'sill_{sd}', (1.9, 0.12, 0.05), (0.0, 0.24, sd * (HALF_W - 0.02)), m=black)
    # front: grille band with four rectangular headlamps + indicators
    box('grille_f', (0.03, 0.12, 1.5), (-2.15, 0.53, 0), m=black)
    head = emissive('dmc_head', '#eef4ff', 4)
    for sd in (-1, 1):
        for k in range(2):
            o = z.box(f'headlamp_{sd}_{k}', (0.02, 0.08, 0.17), P(-2.162, 0.53, sd * (0.42 + k * 0.2)), rot=(0, yaw, 0), material=head, live=1)
        z.box(f'indicator_{sd}', (0.02, 0.05, 0.12), P(-2.165, 0.4, sd * 0.68), rot=(0, yaw, 0), material=emissive('dmc_amber', '#ff9a1a', 2), live=1)
    # rear: the louvred tail with big lamps
    box('grille_r', (0.03, 0.2, 1.7), (2.135, 0.66, 0), m=black)
    for k in range(9):
        box(f'tail_louvre_{k}', (0.035, 0.012, 1.68), (2.15, 0.575 + k * 0.022, 0), m=grey)
    for sd in (-1, 1):
        z.box(f'taillamp_{sd}', (0.02, 0.16, 0.36), P(2.155, 0.66, sd * 0.62), rot=(0, yaw, 0), material=emissive('dmc_tail', '#ff1a1a', 3.5), live=1)
    box('plate', (0.012, 0.11, 0.31), (2.16, 0.43, 0), m=white)
    plate = z.text('plate_text', 'OUTATIME', 0.055, P(2.168, 0.43, 0), rot=(0, yaw + math.pi / 2, 0), material=mat('dmc_plate_ink', '#1a2a6a', rough=0.5), bake='car')
    parts.append(plate)

    # greenhouse: windscreen, the centre roof spine, louvres over the rear glass
    ws_len = math.hypot(0.75, ROOF - BELT)
    ws_ang = math.atan2(ROOF - BELT, 0.75)
    box('windscreen', (ws_len, 0.012, 1.25), (-0.43, (BELT + ROOF) / 2 + 0.01, 0), rot=(0, 0, ws_ang), m=glass)
    box('spine', (1.05, 0.03, 0.24), (0.0, ROOF + 0.005, 0), m=black)
    rl_len = math.hypot(0.95, 0.2)
    rl_ang = math.atan2(0.2, 0.95)
    box('rear_glass', (rl_len, 0.01, 1.28), (1.07, 1.03, 0), rot=(0, 0, -rl_ang), m=glass)
    for k in range(7):
        x = 0.68 + k * 0.13
        box(f'louvre_{k}', (0.07, 0.015, 1.36), (x, 1.12 - (x - 0.6) * 0.21 + 0.03, 0), rot=(0, 0, -0.21), m=black)

    # gull-wing doors: shut, or one swung up
    for sd in (-1, 1):
        d = bpy.data.objects.new(f'door_{sd}', door_mesh(f'door_{sd}', sd, math.radians(78) if sd == open_door else 0.0))
        d.data.materials.append(stainless)
        d.data.materials.append(glass)
        place(d)
        d['bake'] = 'car'
        box_uv(d.data, 2.0, d.matrix_world)
    if open_door is not None:
        interior(z.sub(origin, yaw), open_door, black, chrome, grey)
    # wheels: black tyres, five-slot "turbine" alloys
    for x, r in WHEELS:
        for sd in (-1, 1):
            cyl(f'tyre_{x}_{sd}', r, 0.22, (x, r, sd * TRACK), rot=(math.pi / 2, 0, 0), m=rubber, segs=32, bevel=0.05)
            cyl(f'rim_{x}_{sd}', r * 0.66, 0.02, (x, r, sd * (TRACK + 0.105)), rot=(math.pi / 2, 0, 0), m=chrome, segs=24)
            for k in range(5):
                a = k * 2 * math.pi / 5
                box(f'slot_{x}_{sd}_{k}', (0.05, 0.11, 0.006), (x + math.cos(a) * r * 0.42, r + math.sin(a) * r * 0.42, sd * (TRACK + 0.117)), rot=(0, 0, a + math.pi / 2), m=black)
            cyl(f'cap_{x}_{sd}', 0.04, 0.03, (x, r, sd * (TRACK + 0.12)), rot=(math.pi / 2, 0, 0), m=chrome, segs=16)

    # the time-machine kit
    # flux bands: ribbed chrome bars along the sills
    for sd in (-1, 1):
        for k in range(14):
            cyl(f'flux_band_{sd}_{k}', 0.018, 0.12, (-0.75 + k * 0.105, 0.36, sd * (HALF_W + 0.025)), m=chrome, segs=10)
        z.tube(f'flux_rail_{sd}', [P(-0.82, 0.42, sd * (HALF_W + 0.03)), P(0.68, 0.42, sd * (HALF_W + 0.03))], 0.012, material=chrome, bake='car')
        z.tube(f'flux_rail_lo_{sd}', [P(-0.82, 0.3, sd * (HALF_W + 0.03)), P(0.68, 0.3, sd * (HALF_W + 0.03))], 0.012, material=chrome, bake='car')
        # coils hugging the rear wheel arch
        x, r = WHEELS[1]
        z.tube(f'arch_coil_{sd}', [P(x + (r + 0.1) * math.cos(a), r + (r + 0.1) * math.sin(a), sd * (HALF_W + 0.03)) for a in [math.radians(d) for d in range(10, 171, 20)]], 0.022, material=copper, bake='car')
    # reactor across the rear deck, Mr. Fusion on top, vents at the back
    cyl('reactor', 0.15, 0.95, (1.78, 1.02, 0), rot=(math.pi / 2, 0, 0), m=grey, segs=24, bevel=0.02)
    for sd in (-1, 1):
        cyl(f'reactor_cap_{sd}', 0.16, 0.06, (1.78, 1.02, sd * 0.5), rot=(math.pi / 2, 0, 0), m=chrome, segs=24)
        for k in range(3):
            z.tube(f'coil_{sd}_{k}', [P(1.6, 0.93, sd * (0.2 + k * 0.1)), P(1.7, 1.2, sd * (0.2 + k * 0.1)), P(1.9, 1.17, sd * (0.2 + k * 0.1)), P(2.0, 0.95, sd * (0.2 + k * 0.1))], 0.012, material=copper, bake='car')
    cyl('mr_fusion', 0.1, 0.17, (1.9, 1.24, -0.42), m=white, segs=24)
    cyl('mr_fusion_top', 0.1, 0.08, (1.9, 1.365, -0.42), m=white, r2=0.04, segs=24)
    for sd in (-1, 1):
        for k in range(3):
            cyl(f'vent_{sd}_{k}', 0.065, 0.12, (2.17, 0.95, sd * (0.18 + k * 0.17)), rot=(0, 0, math.pi / 2), m=chrome, segs=20, cap=False)
            cyl(f'vent_in_{sd}_{k}', 0.06, 0.01, (2.12, 0.95, sd * (0.18 + k * 0.17)), rot=(0, 0, math.pi / 2), m=black, segs=20)
    box('vent_box', (0.12, 0.2, 1.1), (2.11, 0.95, 0), m=grey, bevel=0.01)

    car = join(parts, 'delorean')
    car['bake'] = 'car'
    car['hotspot'] = 'garage'
    return car


def interior(c, side, black, chrome, grey):
    """The cabin, in the car's frame c: carpeted tub, two grey leather buckets,
    the dash and wheel (left-hand drive: the driver sits at +z), the console
    with the time circuits, the flux capacitor on the bulkhead behind the
    seats. Joined into one object with its own lightmap room."""
    leather = mat('dmc_leather', '#625f58', rough=0.7)
    carpet = mat('dmc_carpet', '#221f1c', rough=1.0)
    trim = mat('dmc_trim', '#232325', rough=0.75)
    parts = []

    def box(name, size, pos, rot=(0, 0, 0), m=trim, **kw):
        parts.append(c.box(name, size, pos, rot, material=m, **kw))
        return parts[-1]

    def cyl(name, r, h, pos, rot=(0, 0, 0), m=black, **kw):
        parts.append(c.cyl(name, r, h, pos, rot, material=m, **kw))
        return parts[-1]

    x0, x1 = CABIN
    w = HALF_W - 0.08
    # the tub: carpet over the floor, trim lining the sides and the bulkhead
    box('cab_floor', (x1 - x0, 0.03, 2 * w), ((x0 + x1) / 2, FLOOR + 0.015, 0), m=carpet)
    box('cab_bulkhead', (0.03, BELT - FLOOR + 0.25, 2 * w), (x1 - 0.015, (FLOOR + BELT + 0.25) / 2, 0))
    for sd in (-1, 1):
        y1 = BELT if sd != side else SILL + 0.02  # only the sill stays below the open door
        box(f'cab_side_{sd}', (x1 - x0, y1 - FLOOR, 0.03), ((x0 + x1) / 2, (y1 + FLOOR) / 2, sd * (w - 0.015)))
        box(f'cab_sill_{sd}', (DOOR_X[1] - DOOR_X[0], 0.03, 0.12), ((DOOR_X[0] + DOOR_X[1]) / 2, y1, sd * (w - 0.05)), m=grey)
    # the dash: a wedge under the windscreen, the binnacle in front of the driver
    box('dash', (0.34, 0.2, 2 * w), (x0 + 0.17, 0.7, 0), rot=(0, 0, 0.15), bevel=0.02)
    box('dash_top', (0.3, 0.03, 2 * w - 0.04), (x0 + 0.2, 0.81, 0), rot=(0, 0, 0.3), m=black)
    box('binnacle', (0.14, 0.11, 0.38), (x0 + 0.3, 0.84, 0.38), rot=(0, 0, 0.35), bevel=0.015)
    box('gauges', (0.005, 0.07, 0.32), (x0 + 0.375, 0.84, 0.38), rot=(0, 0, 0.35), m=mat('dmc_gauges', '#0b0b0c', rough=0.3))
    for k, zz in enumerate((-0.12, 0.0, 0.12)):  # air vents across the passenger side
        box(f'dash_vent_{k}', (0.01, 0.04, 0.09), (x0 + 0.33, 0.72, -0.35 + zz), m=black)
    box('glovebox', (0.01, 0.1, 0.4), (x0 + 0.34, 0.62, -0.38), rot=(0, 0, 0.15))
    # steering wheel on its column, tilted back at the driver
    n = Vector((0.9, 0.44, 0)).normalized()          # the wheel's axis (towards the driver)
    u, v = Vector((0, 0, 1)), Vector((-0.44, 0.9, 0)).normalized()
    hub = Vector((x0 + 0.48, 0.74, 0.38))
    ring = [tuple(hub + 0.18 * (math.cos(a) * u + math.sin(a) * v)) for a in (k * 2 * math.pi / 24 for k in range(24))]
    parts.append(c.tube('wheel_rim', ring, 0.015, material=black, segs=8, closed=True))
    col0 = hub - n * 0.32
    parts.append(c.tube('wheel_column', [tuple(col0), tuple(hub - n * 0.02)], 0.03, material=black, segs=10))
    parts.append(c.tube('wheel_spokes', [tuple(hub - 0.18 * u), tuple(hub), tuple(hub + 0.18 * u)], 0.012, material=grey, segs=6))
    parts.append(c.tube('wheel_spoke_lo', [tuple(hub), tuple(hub - 0.18 * v)], 0.012, material=grey, segs=6))
    parts.append(c.tube('wheel_hub', [tuple(hub - n * 0.02), tuple(hub + n * 0.03)], 0.045, material=black, segs=12))
    # the console down the middle: gear lever, handbrake, the time circuits
    box('console', (0.95, 0.2, 0.24), (x0 + 0.52, FLOOR + 0.13, 0), bevel=0.02)
    box('console_fascia', (0.06, 0.32, 0.26), (x0 + 0.26, FLOOR + 0.2, 0), rot=(0, 0, -0.35), bevel=0.01)
    cyl('gear_lever', 0.008, 0.16, (x0 + 0.62, FLOOR + 0.31, 0.0), rot=(0, 0, -0.2), m=chrome, segs=8)
    parts.append(c.add('gear_knob', sphere_mesh('gear_knob', 0.025), (x0 + 0.637, FLOOR + 0.39, 0.0), material=black))
    box('gear_gaiter', (0.08, 0.02, 0.08), (x0 + 0.6, FLOOR + 0.235, 0), m=black)
    box('handbrake', (0.2, 0.025, 0.03), (x0 + 0.85, FLOOR + 0.25, 0.0), rot=(0, 0, 0.2), m=black)
    # time circuits: a box of three readouts on the console, tilted up at the
    # cabin; the plane in front is painted live (destination, present, last departed)
    tc = c.sub((x0 + 0.47, FLOOR + 0.3, side * 0.06), math.pi - 0.45 if side < 0 else 0.45)
    parts.append(tc.box('time_circuits', (0.3, 0.2, 0.06), (0, 0, 0), rot=(-0.7, 0, 0), material=grey, bevel=0.008))
    tc.plane('time_circuits_face', 0.27, 0.17, (0, 0.021, 0.0245), rot=(-0.7, 0, 0),
             material=emissive('dmc_time_face', '#ff3a1a', 2.0, textured=True), role='display', painter='timecircuits')
    # two grey leather buckets: cushion, back leaning back, headrest, bolsters
    for sd in (-1, 1):
        zz = sd * 0.38
        box(f'seat_base_{sd}', (0.36, 0.06, 0.36), (0.05, FLOOR + 0.03, zz), m=black)
        box(f'seat_cushion_{sd}', (0.5, 0.1, 0.46), (0.02, FLOOR + 0.1, zz), rot=(0, 0, 0.06), m=leather, bevel=0.035)
        box(f'seat_back_{sd}', (0.13, 0.5, 0.46), (0.3, FLOOR + 0.38, zz), rot=(0, 0, -0.22), m=leather, bevel=0.04)
        box(f'seat_head_{sd}', (0.1, 0.13, 0.26), (0.37, FLOOR + 0.69, zz), rot=(0, 0, -0.22), m=leather, bevel=0.035)
        for b in (-1, 1):
            box(f'seat_bolster_{sd}_{b}', (0.12, 0.36, 0.07), (0.28, FLOOR + 0.36, zz + b * 0.215), rot=(0, 0, -0.22), m=leather, bevel=0.03)
        # the belt hanging off the B-pillar
        parts.append(c.tube(f'seatbelt_{sd}', [(0.45, BELT + 0.15, sd * (w - 0.04)), (0.36, 0.7, sd * (zz / sd + 0.24)), (0.2, FLOOR + 0.25, sd * 0.2)], 0.012, material=black, segs=4))
    # the flux capacitor: a box on the bulkhead between the headrests, a
    # window in its door and the glowing Y inside (live, so it can pulse)
    fc = c.sub((x1 - 0.08, BELT + 0.12, 0), 0.5 * side)  # turned a little towards the open door
    parts.append(fc.box('flux_box', (0.08, 0.32, 0.26), (0, 0, 0), material=grey, bevel=0.01))
    parts.append(fc.box('flux_frame', (0.012, 0.22, 0.18), (-0.045, 0, 0), material=chrome))
    fc.box('flux_window', (0.004, 0.2, 0.16), (-0.052, 0, 0), material=mat('dmc_flux_glass', '#1a1612', rough=0.1), live=1)
    glow = emissive('dmc_flux', '#fff2b0', 5)
    for name, end in (('l', (0.07, -0.06)), ('r', (0.07, 0.06)), ('d', (-0.08, 0.0))):
        fc.tube(f'flux_y_{name}', [(-0.056, 0.0, 0.0), (-0.056, end[0], end[1])], 0.006, material=glow, segs=6, live=1)
    for sd in (-1, 1):  # the cables off the top of it
        parts.append(fc.tube(f'flux_cable_{sd}', [(0, 0.16, sd * 0.06), (0.02, 0.28, sd * 0.1), (0.1, 0.3, sd * 0.3)], 0.012, material=black, segs=6))
    # a lived-in cabin: a clipboard on the near seat, a cable to the dash
    box('clipboard', (0.24, 0.012, 0.32), (0.0, FLOOR + 0.165, side * 0.38), rot=(0, 0.3, 0.06), m=mat('dmc_clipboard', '#8a6a42', rough=0.8))
    box('clipboard_sheet', (0.2, 0.003, 0.27), (0.0, FLOOR + 0.173, side * 0.385), rot=(0, 0.3, 0.06), m=mat('dmc_sheet', '#b5ad9a', rough=0.95))
    parts.append(c.tube('cab_cable', [(x1 - 0.1, BELT + 0.05, 0.12), (0.1, FLOOR + 0.05, 0.1), (x0 + 0.4, FLOOR + 0.04, 0.12), (x0 + 0.3, 0.6, 0.1)], 0.01, material=mat('dmc_cable_red', '#7a1a14', rough=0.6), segs=6))
    # bake light: the cabin's own dim dome lamp and the flux glow
    c.light('POINT', (-0.1, ROOF - 0.08, 0), '#ffe2b0', 5, size=0.1, name='dome_light')
    c.light('POINT', (x1 - 0.15, BELT + 0.12, 0), '#fff0c0', 2.5, size=0.05, name='flux_light')
    cab = join(parts, 'delorean_cabin')
    cab['bake'] = 'car'
    cab['texel'] = 1.6
    return cab


def sphere_mesh(name, r, segs=12):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=segs // 2 + 1, radius=r)
    return finish(bm, name)
