# Shared helpers for the warehouse zone builds: geometry in three.js
# coordinates, procedural materials, the lightmap bake and the GLB export.
#
# Coordinates: everything here is written in three.js space (metres, +y up,
# the home camera looks down -z), so numbers can be copied straight from
# world.js. Blender is z-up: three (x, y, z) == Blender (x, -z, y).
#
# Object tags (custom properties, exported as glTF extras → three userData):
#   bake    atlas group the object is baked into ('hero', 'env', ...)
#   live    kept with its own material (neon, screens): not baked
#   proxy   only there while baking (shadows / light of something JS builds)
#   hotspot place id the object links to (world.js turns it into the contract)
#   role    something JS hooks up: 'screen', 'window', 'light', 'anchor', ...

import bpy  # noqa: I001 (bpy first: it makes bmesh importable)
import bmesh
import ctypes
import math
import os
import time
from mathutils import Matrix, Vector

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')


def B(x, y, z):
    """three.js position → Blender position."""
    return Vector((x, -z, y))


def rot_matrix(rx=0.0, ry=0.0, rz=0.0):
    """three.js Euler (order YXZ: yaw, pitch, roll) → Blender rotation matrix."""
    return Matrix.Rotation(ry, 4, 'Z') @ Matrix.Rotation(rx, 4, 'X') @ Matrix.Rotation(-rz, 4, 'Y')


def hex_rgb(h, scale=1.0):
    """'#rrggbb' (sRGB) → linear RGBA."""
    h = h.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255
        out.append((c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) * scale)
    return (*out, 1.0)


# ---------------------------------------------------------------- scene

def reset(quick=False):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 24 if quick else 160
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = 3
    sc.cycles.glossy_bounces = 1
    sc.cycles.transmission_bounces = 2
    sc.cycles.sample_clamp_indirect = 4.0
    sc.render.threads_mode = 'AUTO'
    world = bpy.data.worlds.new('night')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = hex_rgb('#0a1420')
    bg.inputs['Strength'].default_value = 0.08
    sc.world = world
    return sc


# ---------------------------------------------------------------- materials

_mats = {}


def _principled(m):
    nt = m.node_tree
    return nt.nodes.get('Principled BSDF')


def mat(name, color, color2=None, noise=0.0, scale=6.0, detail=6.0, rough=0.6, metal=0.0,
        coords='Object', stretch=None, emit=None, strength=1.0, pattern=None):
    """A procedural material. color2 + noise blend a second tone in (grime,
    grain, wear). pattern: 'wood' | 'brushed' | 'tiles' | 'stripes' | None."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = _principled(m)
    p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal
    p.inputs['Base Color'].default_value = hex_rgb(color)
    if emit:
        p.inputs['Emission Color'].default_value = hex_rgb(emit)
        p.inputs['Emission Strength'].default_value = strength
        p.inputs['Base Color'].default_value = (0, 0, 0, 1)
    if color2:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        mp = nt.nodes.new('ShaderNodeMapping')
        nt.links.new(tc.outputs[coords], mp.inputs['Vector'])
        if stretch:
            mp.inputs['Scale'].default_value = stretch
        ramp = nt.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = hex_rgb(color)
        ramp.color_ramp.elements[1].color = hex_rgb(color2)
        if pattern == 'wood':
            tex = nt.nodes.new('ShaderNodeTexWave')
            tex.wave_type = 'RINGS'
            tex.inputs['Scale'].default_value = scale
            tex.inputs['Distortion'].default_value = 6.0
            tex.inputs['Detail'].default_value = detail
            tex.inputs['Detail Scale'].default_value = 1.5
        elif pattern == 'tiles':
            tex = nt.nodes.new('ShaderNodeTexBrick')
            tex.inputs['Scale'].default_value = scale
            tex.inputs['Mortar Size'].default_value = 0.01
            tex.inputs['Color1'].default_value = (0.55, 0.55, 0.55, 1)
            tex.inputs['Color2'].default_value = (0.4, 0.4, 0.4, 1)
            tex.inputs['Mortar'].default_value = (1, 1, 1, 1)
        elif pattern == 'stripes':
            tex = nt.nodes.new('ShaderNodeTexWave')
            tex.wave_type = 'BANDS'
            tex.wave_profile = 'SAW'
            tex.inputs['Scale'].default_value = scale
            tex.inputs['Distortion'].default_value = 0.0
        else:
            tex = nt.nodes.new('ShaderNodeTexNoise')
            tex.inputs['Scale'].default_value = scale
            tex.inputs['Detail'].default_value = detail
            tex.inputs['Roughness'].default_value = 0.6
        nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
        fac = tex.outputs['Fac'] if 'Fac' in tex.outputs else tex.outputs[0]
        if pattern is None:
            # noise sits around 0.5: widen it so `noise` controls coverage
            ramp.color_ramp.elements[0].position = 0.5 - noise * 0.5
            ramp.color_ramp.elements[1].position = 0.5 + noise * 0.5 + 0.001
        nt.links.new(fac, ramp.inputs['Fac'])
        nt.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
    _mats[name] = m
    return m


def emissive(name, color, strength=4.0, textured=False):
    """Neon / screens: kept live (not baked) and exported as emissive.
    textured: drive the colour from a tiny image so the exporter keeps the
    UVs (it drops UV maps no texture uses), for surfaces JS paints on."""
    m = mat(name, '#000000', emit=color, strength=strength)
    if textured and not m.get('textured'):
        img = bpy.data.images.new(f'{name}_px', 4, 4)
        img.pixels.foreach_set(np.tile(np.array(hex_rgb(color), np.float32), 16))
        img.pack()
        nt = m.node_tree
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = img
        nt.links.new(tex.outputs['Color'], _principled(m).inputs['Emission Color'])
        m['textured'] = 1
    return m


# ---------------------------------------------------------------- objects

class Zone:
    """Builds one zone. Positions are three.js coords in the zone's own frame
    (origin + yaw), converted to world space here."""

    def __init__(self, name, origin=(0, 0, 0), yaw=0.0):
        self.name = name
        self.origin = Vector(origin)
        self.yaw = yaw
        self.col = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(self.col)

    # zone frame → world (three coords)
    def W(self, p):
        x, y, z = p
        c, s = math.cos(self.yaw), math.sin(self.yaw)
        return Vector((self.origin.x + x * c + z * s, self.origin.y + y, self.origin.z - x * s + z * c))

    def _place(self, obj, pos, rot):
        rx, ry, rz = rot
        obj.matrix_world = Matrix.Translation(B(*self.W(pos))) @ rot_matrix(rx, ry + self.yaw, rz)

    def add(self, name, mesh, pos=(0, 0, 0), rot=(0, 0, 0), material=None, **tags):
        obj = bpy.data.objects.new(name, mesh)
        self.col.objects.link(obj)
        if material is not None:
            mesh.materials.append(material)
        self._place(obj, pos, rot)
        for k, v in tags.items():
            if v is not None:
                obj[k] = v
        return obj

    def empty(self, name, pos, rot=(0, 0, 0), **tags):
        obj = bpy.data.objects.new(name, None)
        self.col.objects.link(obj)
        self._place(obj, pos, rot)
        for k, v in tags.items():
            obj[k] = v
        return obj

    def light(self, kind, pos, color, energy, size=0.5, aim=None, spot=None, blend=0.3, name='light'):
        """Bake-only light (lights are not exported)."""
        ld = bpy.data.lights.new(name, kind)
        ld.color = hex_rgb(color)[:3]
        ld.energy = energy
        if kind == 'AREA':
            ld.size = size if not isinstance(size, tuple) else size[0]
            if isinstance(size, tuple):
                ld.shape = 'RECTANGLE'
                ld.size_y = size[1]
        elif kind in ('POINT', 'SPOT'):
            ld.shadow_soft_size = size
        if kind == 'SPOT':
            ld.spot_size = spot or math.radians(60)
            ld.spot_blend = blend
        obj = bpy.data.objects.new(name, ld)
        self.col.objects.link(obj)
        obj.location = B(*self.W(pos))
        if aim is not None:
            d = B(*self.W(aim)) - obj.location
            obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return obj

    # -- primitives (dimensions are baked into the mesh; object scale stays 1)

    def box(self, name, size, pos, rot=(0, 0, 0), material=None, bevel=0.0, **tags):
        return self.add(name, box_mesh(name, size, bevel), pos, rot, material, **tags)

    def cyl(self, name, r, h, pos, rot=(0, 0, 0), material=None, r2=None, segs=24, bevel=0.0, cap=True, **tags):
        return self.add(name, cyl_mesh(name, r, h, r2, segs, bevel, cap), pos, rot, material, **tags)

    def tube(self, name, points, radius, material=None, segs=8, closed=False, **tags):
        """A tube through zone-local points (three coords); object at the origin."""
        mesh = tube_mesh(name, [B(*self.W(p)) for p in points], radius, segs, closed)
        obj = bpy.data.objects.new(name, mesh)
        self.col.objects.link(obj)
        if material is not None:
            mesh.materials.append(material)
        for k, v in tags.items():
            obj[k] = v
        return obj

    def plane(self, name, width, height, pos, rot=(0, 0, 0), material=None, **tags):
        """A width × height plane facing +z (towards the viewer) before rotation."""
        w, h = width, height
        bm = bmesh.new()
        vs = [bm.verts.new(v) for v in ((-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2))]
        face = bm.faces.new(vs)
        # 0..1 UVs, for things JS paints (screens, boards)
        uv = bm.loops.layers.uv.new('UVMap')
        for loop, co in zip(face.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
            loop[uv].uv = co
        return self.add(name, finish(bm, name), pos, rot, material, **tags)

    def text(self, name, body, size, pos, rot=(0, 0, 0), material=None, depth=0.0, tube=0.0, align='CENTER', **tags):
        """Text as mesh. tube > 0 gives neon tubing along the letter outlines."""
        cu = bpy.data.curves.new(name, 'FONT')
        cu.body = body
        cu.size = size
        cu.align_x = align
        cu.align_y = 'CENTER'
        if tube > 0:
            cu.fill_mode = 'NONE'
            cu.bevel_depth = tube
            cu.bevel_resolution = 2
        else:
            cu.extrude = depth
        tmp = bpy.data.objects.new('tmp', cu)
        bpy.context.scene.collection.objects.link(tmp)
        dg = bpy.context.evaluated_depsgraph_get()
        mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
        bpy.data.objects.remove(tmp)
        # Blender text lies in its XY plane: stand it up to face +z (three)
        mesh.transform(Matrix.Rotation(math.pi / 2, 4, 'X'))
        mesh.name = name
        return self.add(name, mesh, pos, rot, material, **tags)


def finish(bm, name):
    mesh = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def box_mesh(name, size, bevel=0.0):
    w, h, d = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * d, v.co.z * h))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) * 0.45), segments=2,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    return finish(bm, name)


def cyl_mesh(name, r, h, r2=None, segs=24, bevel=0.0, cap=True):
    """Cylinder / cone along +y (three), centred."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=segs, radius1=r,
                          radius2=r if r2 is None else r2, depth=h)
    if bevel > 0:
        rim = [e for e in bm.edges if len(e.link_faces) == 2 and abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.5]
        bmesh.ops.bevel(bm, geom=rim, offset=bevel, segments=2, affect='EDGES', clamp_overlap=True)
    return finish(bm, name)


def tube_mesh(name, pts, radius, segs=8, closed=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = max(1, segs // 4)
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY' if len(pts) < 3 else 'NURBS')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p.x, p.y, p.z, 1)
    if sp.type == 'NURBS':
        sp.use_endpoint_u = True
        sp.order_u = 3
        sp.resolution_u = 6
    sp.use_cyclic_u = closed
    tmp = bpy.data.objects.new('tmp', cu)
    bpy.context.scene.collection.objects.link(tmp)
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(dg))
    bpy.data.objects.remove(tmp)
    mesh.name = name
    return mesh


def join(objs, name):
    """Join objects (same tags) into one; returns it."""
    objs = [o for o in objs if o.type == 'MESH']
    if len(objs) < 2:
        return objs[0] if objs else None
    ctx = {'active_object': objs[0], 'selected_editable_objects': objs, 'selected_objects': objs}
    with bpy.context.temp_override(**ctx):
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


# ---------------------------------------------------------------- bake

_oidn = None


def denoise(rgb):
    """OpenImageDenoise (bundled with bpy) on an HxWx3 float32 image."""
    global _oidn
    if _oidn is None:
        d = os.path.dirname(bpy.__file__)
        while not os.path.exists(os.path.join(d, 'lib', 'libOpenImageDenoise.so.2')):
            d = os.path.dirname(d)
        lib = ctypes.CDLL(os.path.join(d, 'lib', 'libOpenImageDenoise.so.2'))
        vp, cp = ctypes.c_void_p, ctypes.c_char_p
        lib.oidnNewDevice.restype = vp
        lib.oidnCommitDevice.argtypes = [vp]
        lib.oidnNewFilter.restype = vp
        lib.oidnNewFilter.argtypes = [vp, cp]
        lib.oidnSetSharedFilterImage.argtypes = [vp, cp, vp, ctypes.c_int] + [ctypes.c_size_t] * 5
        lib.oidnSetFilterBool.argtypes = [vp, cp, ctypes.c_bool]
        lib.oidnCommitFilter.argtypes = [vp]
        lib.oidnExecuteFilter.argtypes = [vp]
        lib.oidnReleaseFilter.argtypes = [vp]
        dev = lib.oidnNewDevice(1)  # CPU
        lib.oidnCommitDevice(dev)
        _oidn = (lib, dev)
    lib, dev = _oidn
    h, w, _ = rgb.shape
    src = np.ascontiguousarray(rgb, dtype=np.float32)
    out = np.zeros_like(src)
    f = lib.oidnNewFilter(dev, b'RT')
    lib.oidnSetSharedFilterImage(f, b'color', src.ctypes.data, 3, w, h, 0, 0, 0)
    lib.oidnSetSharedFilterImage(f, b'output', out.ctypes.data, 3, w, h, 0, 0, 0)
    lib.oidnSetFilterBool(f, b'hdr', True)
    lib.oidnCommitFilter(f)
    lib.oidnExecuteFilter(f)
    lib.oidnReleaseFilter(f)
    return out


def unwrap(objs, margin):
    """One shared UV atlas ('bake') for a group of objects, with even texel
    density, scaled per object by its 'texel' tag, then packed together."""
    for o in objs:
        uv = o.data.uv_layers.get('bake') or o.data.uv_layers.new(name='bake')
        o.data.uv_layers.active = uv
    ctx = {'active_object': objs[0], 'selected_objects': objs, 'selected_editable_objects': objs, 'objects_in_edit_mode': objs}
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, scale_to_bounds=False)
    bpy.ops.uv.average_islands_scale()
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in objs:
        k = o.get('texel', 1.0)
        if k != 1.0:
            data = o.data.uv_layers['bake'].data
            co = np.empty(len(data) * 2, np.float32)
            data.foreach_get('uv', co)
            data.foreach_set('uv', co * k)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=margin, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')
    del ctx


def _bake(objs, img, kind, pass_filter, samples):
    sc = bpy.context.scene
    sc.cycles.samples = samples
    for o in objs:
        for slot in o.material_slots:
            nt = slot.material.node_tree
            node = nt.nodes.get('__bake') or nt.nodes.new('ShaderNodeTexImage')
            node.name = '__bake'
            node.image = img
            nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    t = time.time()
    bpy.ops.object.bake(type=kind, pass_filter=pass_filter, margin=16, margin_type='EXTEND', use_clear=True, uv_layer='bake')
    print(f'    {kind} {sorted(pass_filter)} {img.size[0]}px {samples}spp: {time.time() - t:.0f}s', flush=True)
    px = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(px)
    return px.reshape(img.size[1], img.size[0], 4)[..., :3]


def _upsample(a, n):
    """Bilinear upsample HxWx3 by an integer factor."""
    if n == 1:
        return a
    h, w, _ = a.shape
    ys = (np.arange(h * n) + 0.5) / n - 0.5
    xs = (np.arange(w * n) + 0.5) / n - 0.5
    y0 = np.clip(np.floor(ys).astype(int), 0, h - 1)
    x0 = np.clip(np.floor(xs).astype(int), 0, w - 1)
    y1 = np.clip(y0 + 1, 0, h - 1)
    x1 = np.clip(x0 + 1, 0, w - 1)
    fy = np.clip(ys - y0, 0, 1)[:, None, None]
    fx = np.clip(xs - x0, 0, 1)[None, :, None]
    top = a[y0][:, x0] * (1 - fx) + a[y0][:, x1] * fx
    bot = a[y1][:, x0] * (1 - fx) + a[y1][:, x1] * fx
    return top * (1 - fy) + bot * fy


def bake_group(zone, group, objs, size, light_div=2, samples=160, exposure=1.0, quick=False):
    """Bake a group's look into one sRGB texture: albedo × denoised lighting +
    emission, soft-clipped at 1. Returns the image."""
    if quick:
        size, samples = max(256, size // 4), 16
    print(f'  bake {zone}/{group}: {len(objs)} objects', flush=True)
    # every material in this group gets its own copy (each points at one image)
    seen = {}
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            key = m.name
            if m.get('__group') not in (None, group):
                m = m.copy()
            m['__group'] = group
            slot.material = seen.setdefault(key, m)
    unwrap(objs, margin=0.003 if size >= 2048 else 0.005)
    # Blender bakes each selected object in its own pass (slow with hundreds of
    # books): bake the plain ones as one mesh, keep the ones JS needs apart.
    keep = [o for o in objs if o.get('hotspot') or o.get('role')]
    plain = join([o for o in objs if o not in keep], f'{zone}_{group}')
    objs = keep + ([plain] if plain else [])
    lsize = size // light_div
    limg = bpy.data.images.new(f'{zone}_{group}_light', lsize, lsize, float_buffer=True)
    cimg = bpy.data.images.new(f'{zone}_{group}_color', size, size, float_buffer=True)
    light = _bake(objs, limg, 'DIFFUSE', {'DIRECT', 'INDIRECT'}, samples)
    light = _upsample(denoise(light), light_div)
    albedo = _bake(objs, cimg, 'DIFFUSE', {'COLOR'}, 4)
    emit = _bake(objs, cimg, 'EMIT', {'EMIT'}, 1)
    rgb = albedo * light * exposure + emit
    # soft knee above 0.8 so hot spots roll off instead of clipping
    knee = 0.8
    rgb = np.where(rgb < knee, rgb, knee + (1 - knee) * (1 - np.exp(-(rgb - knee) / (1 - knee))))
    srgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(np.maximum(rgb, 0), 1 / 2.4) - 0.055)
    out = bpy.data.images.new(f'{zone}_{group}', size, size, alpha=False)
    px = np.ones((size, size, 4), np.float32)
    px[..., :3] = np.clip(srgb, 0, 1)
    out.pixels.foreach_set(px.ravel())
    os.makedirs(OUT, exist_ok=True)
    out.filepath_raw = os.path.join(OUT, f'{zone}_{group}.png')
    out.file_format = 'PNG'
    out.save()
    # the exported look: the baked texture only (unlit in three)
    baked = bpy.data.materials.new(f'baked_{zone}_{group}')
    baked.use_nodes = True
    nt = baked.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = out
    uvn = nt.nodes.new('ShaderNodeUVMap')
    uvn.uv_map = 'bake'
    nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], _principled(baked).inputs['Base Color'])
    for o in objs:
        o.data.materials.clear()
        o.data.materials.append(baked)
        for uv in [u for u in o.data.uv_layers if u.name != 'bake']:
            o.data.uv_layers.remove(uv)
    return out


def bake_zone(zone, groups, quick=False):
    """groups: {name: {'size': px, 'exposure': k}}. Bakes every object tagged
    with that group into that group's atlas."""
    t0 = time.time()
    for group, opts in groups.items():
        objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('bake') == group]
        if not objs:
            continue
        bake_group(zone, group, objs, opts.get('size', 2048), opts.get('light_div', 2),
                   opts.get('samples', 160), opts.get('exposure', 1.0), quick)
    print(f'  baked {zone} in {time.time() - t0:.0f}s', flush=True)


def export(zone):
    # bake-only helpers go; lights are not exported
    for o in list(bpy.data.objects):
        if o.get('proxy'):
            bpy.data.objects.remove(o)
    for o in bpy.data.objects:
        for k in ('bake', 'texel'):
            if k in o:
                del o[k]
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f'{zone}.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_extras=True, export_yup=True,
                              export_apply=True, export_lights=False, export_cameras=False,
                              export_materials='EXPORT', export_image_format='AUTO')
    print(f'  wrote {path} ({os.path.getsize(path) / 1e6:.1f} MB raw)', flush=True)
    return path


def join_live(zone):
    """Live objects that JS doesn't touch: one mesh per material."""
    by_mat = {}
    for o in bpy.data.objects:
        if o.type == 'MESH' and o.get('live') and not o.get('hotspot') and not o.get('role') and len(o.data.materials) == 1:
            by_mat.setdefault(o.data.materials[0].name, []).append(o)
    for name, objs in by_mat.items():
        j = join(objs, f'{zone}_{name}')
        if j:
            j['live'] = 1
