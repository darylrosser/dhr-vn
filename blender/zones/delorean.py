# The time machine: a DMC-12 in brushed stainless with the Back to the Future
# kit (Mr. Fusion, the rear reactor and vents, flux bands along the sills, the
# flux capacitor glowing behind the seats, time circuits on the console, the
# OUTATIME plate), gull-wing doors up. Modelled from scratch by script; no
# badges or logos.
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

# lower body side profile (x, y), clockwise from the nose bottom; the cabin
# (x -0.8 … 0.5) is open above the beltline, under the doors
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


def cut_arches(body):
    """Boolean the wheel arches out of the body sides."""
    cutters = []
    for x, r in WHEELS:
        bpy.ops.mesh.primitive_cylinder_add(radius=r + 0.06, depth=2.6, location=B(x, r, 0), rotation=(0, 0, 0))
        c = bpy.context.object
        c.rotation_euler = (math.pi / 2, 0, 0)  # axis across the car
        cutters.append(c)
    for c in cutters:
        mod = body.modifiers.new('arch', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = c
        with bpy.context.temp_override(object=body, active_object=body):
            bpy.ops.object.modifier_apply(modifier=mod.name)
    for c in cutters:
        bpy.data.objects.remove(c)


DOOR_X = (-0.72, 0.42)   # door opening, front and rear edge
SILL = 0.42


def door_mesh(name, side):
    """Gull-wing door, closed pose: roof half (from the centre spine), side
    glass sloping out to the beltline, then the door skin down to the sill.
    Hinge line along x at (z = 0.12, y = ROOF)."""
    bm = bmesh.new()
    zc, zr, zb = 0.12, HALF_W - 0.2, HALF_W + 0.005
    sect = [(ROOF + 0.005, zc), (ROOF, zr), (BELT, zb), (SILL, zb)]
    rows = []
    for x in DOOR_X:
        # the front edge leans back with the windscreen above the beltline
        rows.append([bm.verts.new(B(x + (0.3 * (y - BELT) / (ROOF - BELT) if (x < 0 and y > BELT) else 0), y, side * w)) for y, w in sect])
    for k in range(len(sect) - 1):
        f = bm.faces.new((rows[0][k], rows[0][k + 1], rows[1][k + 1], rows[1][k]))
        f.material_index = 1 if k == 1 else 0  # the side window is glass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.04)
    return finish(bm, name)


def cut_doors(body):
    """Open the body sides where the doors were (the floor tub stays)."""
    for sd in (-1, 1):
        x0, x1 = DOOR_X
        bpy.ops.mesh.primitive_cube_add(size=1, location=B((x0 + x1) / 2, (SILL + ROOF) / 2 + 0.05, sd * HALF_W))
        c = bpy.context.object
        c.scale = ((x1 - x0), 0.36, (ROOF - SILL) + 0.1)  # Blender axes: x, y (across), z (up)
        mod = body.modifiers.new('door', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.solver = 'EXACT'
        mod.object = c
        with bpy.context.temp_override(object=body, active_object=body):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(c)


def build(z, origin=(0, 0, 0), yaw=0.0):
    """Add the car to zone z at origin (zone coords). Returns the clickable body."""
    ox, oy, oz = origin
    c_, s_ = math.cos(yaw), math.sin(yaw)

    def P(x, y, zz):  # car frame → zone frame
        return (ox + x * c_ + zz * s_, oy + y, oz - x * s_ + zz * c_)

    stainless = image_pbr('dmc_stainless', brushed_texture('dmc_brushed'), scale=0.8, rough=0.3, metal=0.7, tex=512)
    black = mat('dmc_black', '#121214', rough=0.6)
    rubber = mat('dmc_rubber', '#0c0c0d', rough=0.85)
    glass = mat('dmc_glass', '#0d1418', rough=0.05)
    chrome = mat('dmc_chrome', '#d8dadc', rough=0.15, metal=1.0)
    grey = mat('dmc_grey', '#55585e', rough=0.5, metal=0.6)
    copper = mat('dmc_copper', '#b8733a', rough=0.35, metal=1.0)
    white = mat('dmc_white', '#e8e6e0', rough=0.35)
    seat = mat('dmc_seat', '#2a2a2c', rough=0.55)

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

    # body shell with the wheel arches cut out
    body = bpy.data.objects.new('dmc_body', body_mesh('dmc_body'))
    bpy.context.scene.collection.objects.link(body)
    cut_arches(body)
    cut_doors(body)
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

    # gull-wing doors, up
    for sd in (-1, 1):
        d = bpy.data.objects.new(f'door_{sd}', door_mesh(f'door_{sd}', sd))
        d.data.materials.append(stainless)
        d.data.materials.append(glass)
        hinge = B(0, ROOF, sd * 0.12)
        # rotate about the hinge line (along x), then place with the car
        d.data.transform(Matrix.Translation(hinge) @ Matrix.Rotation(sd * math.radians(-72), 4, 'X') @ Matrix.Translation(-hinge))
        place(d)
        d['bake'] = 'car'
        box_uv(d.data, 2.0, d.matrix_world)
        # the door glass (dark) on the raised door
        # door inner panel: dark trim
    # the cockpit: dash, seats, wheel, console with the time circuits
    box('dash', (0.45, 0.22, 1.6), (-0.62, 0.72, 0), m=black, bevel=0.02)
    box('tub_floor', (1.4, 0.04, 1.7), (-0.1, 0.42, 0), m=black)
    for sd in (-1, 1):
        box(f'seat_base_{sd}', (0.5, 0.14, 0.5), (0.05, 0.5, sd * 0.38), m=seat, bevel=0.04)
        box(f'seat_back_{sd}', (0.14, 0.62, 0.48), (0.32, 0.83, sd * 0.38), rot=(0, 0, 0.25), m=seat, bevel=0.05)
    cyl('steer_col', 0.025, 0.3, (-0.42, 0.78, -0.38), rot=(0, 0, 1.1), m=black)
    wheel = z.tube('steering_wheel', [P(-0.32 + 0.01 * math.cos(a), 0.88 + 0.17 * math.sin(a), -0.38 + 0.17 * math.cos(a)) for a in [i * math.pi / 8 for i in range(17)]], 0.016, material=black, bake='car')
    parts.append(wheel)
    box('console', (0.7, 0.3, 0.22), (-0.2, 0.58, 0), m=black)
    # time circuits: destination (red), present (green), last departed (amber)
    for k, col in enumerate(('#ff2a1a', '#2aff6a', '#ffb000')):
        z.box(f'time_circuit_{k}', (0.24, 0.025, 0.004), P(-0.35, 0.75 - k * 0.04, 0.0), rot=(0, yaw + math.pi / 2, 0), material=emissive(f'dmc_tc_{k}', col, 3), live=1)
    # the flux capacitor behind the seats: a glowing Y in a box
    box('flux_box', (0.06, 0.34, 0.3), (0.47, 0.92, 0), m=grey)
    flux = emissive('dmc_flux', '#d8f2ff', 9)
    for a in (0, 2 * math.pi / 3, 4 * math.pi / 3):
        y0, z0 = 0.93, 0.0
        z.tube(f'flux_{a:.1f}', [P(0.44, y0, z0), P(0.44, y0 + 0.11 * math.cos(a), z0 + 0.11 * math.sin(a))], 0.008, material=flux, live=1)

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
