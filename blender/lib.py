# Shared helpers for the warehouse zone builds: geometry in three.js
# coordinates, materials (scanned PBR sets from Poly Haven, or plain
# procedural colours for small things), Poly Haven props, the lightmap bake
# and the GLB export.
#
# Look: real materials (colour, normal, roughness) shaded live in three.js,
# lit by a baked lightmap per atlas group (Cycles, denoised) on the second
# UV set, plus reflections from an environment map.
#
# Coordinates: everything here is written in three.js space (metres, +y up,
# the home camera looks down -z), so numbers can be copied straight from
# world.js. Blender is z-up: three (x, y, z) == Blender (x, -z, y).
#
# Object tags (custom properties, exported as glTF extras → three userData):
#   bake    lightmap group the object is baked into ('hero', 'env', ...)
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

import assets

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.dirname(HERE)
OUT = os.path.join(HERE, 'out')
LM_RANGE = 4.0  # lightmap headroom: stored value × LM_RANGE = irradiance


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
_models = {}


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


def pbr(name, asset, scale=1.0, tint=None, rough=1.0, metal=0.0, normal=1.0, tex=512):
    """A scanned Poly Haven material. scale = metres per texture repeat on
    box-mapped primitives. tint / rough multiply the maps (applied as glTF
    factors when packing). tex = shipped colour-map size (normals get half,
    roughness a quarter)."""
    if name in _mats:
        return _mats[name]
    maps = assets.fetch_texture(asset)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = _principled(m)
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'UVMap'

    def image(path, colour):
        n = nt.nodes.new('ShaderNodeTexImage')
        n.image = bpy.data.images.load(path, check_existing=True)
        n.image.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
        nt.links.new(uv.outputs['UV'], n.inputs['Vector'])
        return n
    nt.links.new(image(maps['diff'], True).outputs['Color'], p.inputs['Base Color'])
    if 'rough' in maps:
        nt.links.new(image(maps['rough'], False).outputs['Color'], p.inputs['Roughness'])
    if 'metal' in maps:
        nt.links.new(image(maps['metal'], False).outputs['Color'], p.inputs['Metallic'])
    else:
        p.inputs['Metallic'].default_value = metal
    if 'nor' in maps:
        nm = nt.nodes.new('ShaderNodeNormalMap')
        nm.inputs['Strength'].default_value = normal
        nt.links.new(image(maps['nor'], False).outputs['Color'], nm.inputs['Color'])
        nt.links.new(nm.outputs['Normal'], p.inputs['Normal'])
    m['uvscale'] = scale
    m['tex'] = tex
    if tint:
        m['tint'] = list(hex_rgb(tint)[:3])
    if rough != 1.0:
        m['rough'] = rough
    if metal and 'metal' not in maps:
        m['metal'] = metal
    _mats[name] = m
    return m


def photo(name, path, rough=0.4, tex=256):
    """A material showing one image across the face (plane UVs 0..1)."""
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    n = nt.nodes.new('ShaderNodeTexImage')
    n.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(n.outputs['Color'], _principled(m).inputs['Base Color'])
    _principled(m).inputs['Roughness'].default_value = rough
    m['tex'] = tex
    _mats[name] = m
    return m


def noise_texture(name, base, spots, size=512, density=0.25, seed=1):
    """A speckled colour texture (cork, chalk, felt) generated with numpy;
    returns its PNG path in out/."""
    rng = np.random.default_rng(seed)
    img = np.zeros((size, size, 3), np.float32) + np.array(hex_rgb(base)[:3])
    k = np.zeros((size, size), np.float32)
    for scale in (2, 4, 8):
        n = rng.random((size // scale, size // scale)).astype(np.float32)
        k += np.kron(n, np.ones((scale, scale), np.float32)) / 3
    for colour, lo, hi in spots:
        mask = ((k > lo) & (k < hi)).astype(np.float32)[..., None]
        img = img * (1 - mask * density) + np.array(hex_rgb(colour)[:3]) * mask * density
    img *= (0.85 + 0.3 * rng.random((size, size, 1))).astype(np.float32)
    srgb = np.where(img <= 0.0031308, img * 12.92, 1.055 * np.power(np.clip(img, 0, 1), 1 / 2.4) - 0.055)
    out = bpy.data.images.new(name, size, size, alpha=False)
    px = np.ones((size, size, 4), np.float32)
    px[..., :3] = srgb
    out.pixels.foreach_set(px.ravel())
    os.makedirs(OUT, exist_ok=True)
    out.filepath_raw = os.path.join(OUT, f'{name}.png')
    out.file_format = 'PNG'
    out.save()
    return out.filepath_raw


def brushed_texture(name, base='#b8bcc0', size=512, seed=7, grime=0.0):
    """Brushed metal: fine streaks along u, a few long scratches; PNG in out/.
    grime > 0 adds blotchy dirt and dust (darker patches, up to that much)."""
    rng = np.random.default_rng(seed)
    rows = rng.normal(0, 1, (size, 1)).astype(np.float32)
    streak = np.repeat(rows, size, 1)
    for w in (3, 9, 27):  # streaks of a few lengths, wrapping along u
        n = rng.normal(0, 1, (size, -(-size // w))).astype(np.float32)
        streak += np.repeat(n, w, 1)[:, :size] * 0.5
    k = 1 + 0.035 * streak / streak.std()
    if grime:
        # soft blotches: a few octaves of smoothed noise, tileable (wraps)
        dirt = np.zeros((size, size), np.float32)
        for cells, amp in ((4, 1.0), (8, 0.6), (32, 0.3), (128, 0.25)):
            g = rng.random((cells, cells)).astype(np.float32)
            rep = size // cells
            up = np.repeat(np.repeat(g, rep, 0), rep, 1)
            for _ in range(2):  # blur by averaging with shifted copies (wrapping)
                up = (up + np.roll(up, rep // 2, 0) + np.roll(up, rep // 2, 1) + np.roll(up, -rep // 2, 0)) / 4
            dirt += amp * up
        dirt = (dirt - dirt.min()) / (dirt.max() - dirt.min())
        k = k * (1 - grime * np.clip(dirt * 1.4 - 0.35, 0, 1))
    img = np.array(hex_rgb(base)[:3], np.float32)[None, None, :] * k[..., None]
    srgb = np.where(img <= 0.0031308, img * 12.92, 1.055 * np.power(np.clip(img, 0, 1), 1 / 2.4) - 0.055)
    out = bpy.data.images.new(name, size, size, alpha=False)
    px = np.ones((size, size, 4), np.float32)
    px[..., :3] = srgb
    out.pixels.foreach_set(px.ravel())
    os.makedirs(OUT, exist_ok=True)
    out.filepath_raw = os.path.join(OUT, f'{name}.png')
    out.file_format = 'PNG'
    out.save()
    return out.filepath_raw


def image_pbr(name, path, scale=1.0, rough=0.8, tex=512, metal=0.0):
    """Like pbr() but from one local colour image (tiled, box-mapped)."""
    if name in _mats:
        return _mats[name]
    m = photo(name, path, rough, tex)
    _principled(m).inputs['Metallic'].default_value = metal
    nt = m.node_tree
    uv = nt.nodes.new('ShaderNodeUVMap')
    uv.uv_map = 'UVMap'
    nt.links.new(uv.outputs['UV'], [n for n in nt.nodes if n.type == 'TEX_IMAGE'][0].inputs['Vector'])
    m['uvscale'] = scale
    return m


def box_uv(mesh, scale=1.0, matrix=None):
    """'UVMap': box projection in real-world units (1 repeat per `scale` m),
    in world space when given the object's matrix, so neighbours line up."""
    uv = mesh.uv_layers.get('UVMap') or mesh.uv_layers.new(name='UVMap')
    n = len(mesh.loops)
    if not n:
        return
    co = np.empty(len(mesh.vertices) * 3, np.float32)
    mesh.vertices.foreach_get('co', co)
    co = co.reshape(-1, 3)
    if matrix is not None:
        m = np.array(matrix, np.float32)
        co = co @ m[:3, :3].T + m[:3, 3]
    lv = np.empty(n, np.int32)
    mesh.loops.foreach_get('vertex_index', lv)
    nrm = np.empty(len(mesh.polygons) * 3, np.float32)
    mesh.polygons.foreach_get('normal', nrm)
    nrm = nrm.reshape(-1, 3)
    if matrix is not None:
        nrm = nrm @ np.array(matrix, np.float32)[:3, :3].T
    nrm = np.abs(nrm)
    start = np.empty(len(mesh.polygons), np.int32)
    mesh.polygons.foreach_get('loop_start', start)
    total = np.empty(len(mesh.polygons), np.int32)
    mesh.polygons.foreach_get('loop_total', total)
    axis = np.repeat(np.argmax(nrm, axis=1), total)
    p = co[lv]
    u = np.where(axis == 0, p[:, 1], p[:, 0])
    v = np.where(axis == 2, p[:, 1], p[:, 2])
    out = np.stack([u, v], 1).astype(np.float32) / scale
    uv.data.foreach_set('uv', out.ravel())
    mesh.uv_layers.active = uv
    uv.active_render = True


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

    def sub(self, origin, yaw=0.0):
        """A frame inside this one (same collection): place an assembly with
        its own local coordinates at `origin` (this frame), turned by `yaw`."""
        f = Zone.__new__(Zone)
        f.name, f.col = self.name, self.col
        f.origin = self.W(origin)
        f.yaw = self.yaw + yaw
        return f

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
        if 'UVMap' not in mesh.uv_layers or (material is not None and material.get('uvscale')):
            box_uv(mesh, material.get('uvscale', 1.0) if material is not None else 1.0, obj.matrix_world)
        for k, v in tags.items():
            if v is not None:
                obj[k] = v
        return obj

    def model(self, name, asset, pos, rot=(0, 0, 0), scale=1.0, max_tris=1000, tex=256, **tags):
        """A Poly Haven prop (CC0), imported once, joined into one mesh,
        decimated to max_tris, placed like any other object. tex = shipped
        colour-map size for its textures."""
        src = _models.get(asset)
        if src is None:
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=assets.fetch_model(asset))
            new = [o for o in bpy.data.objects if o not in before]
            meshes = [o for o in new if o.type == 'MESH']
            for o in meshes:
                o.data = o.data.copy()
                mw = o.matrix_world.copy()
                o.parent = None
                o.data.transform(mw)
                o.matrix_world = Matrix.Identity(4)
                # the props' texture UVs are 'UVMap'; lightmap UVs come later
                if o.data.uv_layers:
                    o.data.uv_layers[0].name = 'UVMap'
                for extra in list(o.data.uv_layers)[1:]:
                    o.data.uv_layers.remove(extra)
                if not o.data.uv_layers:
                    box_uv(o.data)
            others = [o.name for o in new if o.type != 'MESH']
            src = join(meshes, f'src_{asset}')
            for name in others:  # empties / armatures the importer made
                if name in bpy.data.objects:
                    bpy.data.objects.remove(bpy.data.objects[name])
            tris = sum(len(p.vertices) - 2 for p in src.data.polygons)
            if tris > max_tris:
                mod = src.modifiers.new('decimate', 'DECIMATE')
                mod.ratio = max_tris / tris
                with bpy.context.temp_override(object=src, active_object=src):
                    bpy.ops.object.modifier_apply(modifier='decimate')
            # origin at the bottom centre, so `pos` is where it stands
            co = np.empty(len(src.data.vertices) * 3, np.float32)
            src.data.vertices.foreach_get('co', co)
            co = co.reshape(-1, 3)
            lo, hi = co.min(0), co.max(0)
            src.data.transform(Matrix.Translation(Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))))
            print(f'    model {asset}: {len(src.data.polygons)} faces, {hi[0] - lo[0]:.2f} × {hi[2] - lo[2]:.2f} × {hi[1] - lo[1]:.2f} m (w × h × d)', flush=True)
            for slot in src.material_slots:
                slot.material['tex'] = tex
                # scanned props' bulbs come very hot; keep them a glow, not a flare
                p = _principled(slot.material)
                if p and p.inputs['Emission Strength'].default_value > 3:
                    p.inputs['Emission Strength'].default_value = 3
            for c in src.users_collection:
                c.objects.unlink(src)
            _models[asset] = src
        mesh = src.data.copy()
        mesh.transform(Matrix.Scale(scale, 4))
        obj = bpy.data.objects.new(name, mesh)
        self.col.objects.link(obj)
        self._place(obj, pos, rot)
        for k, v in tags.items():
            if v is not None:
                obj[k] = v
        return obj

    def book(self, name, size, pos, rot=(0, 0, 0), cover=None, pages=None, **tags):
        """A book lying flat: a cream page block between two thin covers, the
        spine on its -x side. size = (w, thickness, d), pos = its centre."""
        w, t, d = size
        board = min(0.003, t * 0.12)
        c, s = math.cos(rot[1]), math.sin(rot[1])
        def at(dx, dy, dz):  # book frame → zone frame
            return (pos[0] + dx * c + dz * s, pos[1] + dy, pos[2] - dx * s + dz * c)
        pages = pages or mat('book_pages', '#e6dcc4', rough=0.9)
        parts = [
            self.box(f'{name}_pages', (w - 0.006, t - 2 * board, d - 0.006), at(0.002, 0, 0), rot, pages, **tags),
            self.box(f'{name}_top', (w, board, d), at(0, (t - board) / 2, 0), rot, cover, bevel=board * 0.4, **tags),
            self.box(f'{name}_bottom', (w, board, d), at(0, -(t - board) / 2, 0), rot, cover, bevel=board * 0.4, **tags),
            self.box(f'{name}_spine', (board * 1.5, t, d), at(-w / 2 + board * 0.75, 0, 0), rot, cover, **tags),
        ]
        return join(parts, name)

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
        elif kind == 'SUN':
            ld.angle = size  # the sun's apparent size (radians): how soft its shadows are
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
        box_uv(mesh, material.get('uvscale', 1.0) if material is not None else 1.0)
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
            cu.bevel_resolution = 1
            cu.resolution_u = 5  # tubes are thin: a coarse curve still reads as round
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
        if 'UVMap' not in o.data.uv_layers:
            box_uv(o.data)
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


def bake_group(zone, group, objs, size=1024, samples=200, quick=False):
    """Bake one lightmap for a group of objects: the light arriving at each
    surface (direct + bounced, no surface colour), denoised, stored as sRGB
    with headroom LM_RANGE (three: lightMapIntensity = lm). Materials stay as
    they are; each object is tagged with the lightmap it uses."""
    if quick:
        size, samples = max(128, size // 4), 16
    print(f'  bake {zone}/{group}: {len(objs)} objects', flush=True)
    # each material in this group gets its own copy (each points at one image)
    seen = {}
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            key = m.name
            if key not in seen:
                if m.get('__group') not in (None, group):
                    m = m.copy()
                m['__group'] = group
                seen[key] = m
            slot.material = seen[key]
    unwrap(objs, margin=0.004 if size >= 1024 else 0.008)
    # Blender bakes each selected object in its own pass (slow with hundreds of
    # books): bake the plain ones as one mesh, keep the ones JS needs apart.
    keep = [o for o in objs if o.get('hotspot') or o.get('role')]
    plain = join([o for o in objs if o not in keep], f'{zone}_{group}')
    objs = keep + ([plain] if plain else [])
    img = bpy.data.images.new(f'{zone}_{group}_lm', size, size, float_buffer=True)
    light = denoise(_bake(objs, img, 'DIFFUSE', {'DIRECT', 'INDIRECT'}, samples))
    enc = np.clip(light / LM_RANGE, 0, 1)
    enc = np.where(enc <= 0.0031308, enc * 12.92, 1.055 * np.power(enc, 1 / 2.4) - 0.055)
    out = bpy.data.images.new(f'{zone}_{group}_lm_out', size, size, alpha=False)
    px = np.ones((size, size, 4), np.float32)
    px[..., :3] = enc
    out.pixels.foreach_set(px.ravel())
    os.makedirs(OUT, exist_ok=True)
    out.filepath_raw = os.path.join(OUT, f'{zone}_{group}_lm.png')
    out.file_format = 'PNG'
    out.save()
    for o in objs:
        o['lightmap'] = f'{zone}_{group}'
        o['lm'] = LM_RANGE
        o.data.uv_layers['UVMap'].active_render = True
    for m in seen.values():
        nt = m.node_tree
        if '__bake' in nt.nodes:
            nt.nodes.remove(nt.nodes['__bake'])
        del m['__group']
    return out


def bake_zone(zone, groups, quick=False):
    """groups: {name: {'size': px, 'samples': n}}. Bakes a lightmap for every
    object tagged with that group."""
    t0 = time.time()
    for group, opts in groups.items():
        objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.get('bake') == group]
        if objs:
            bake_group(zone, group, objs, opts.get('size', 1024), opts.get('samples', 200), quick)
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
    for m in bpy.data.materials:
        for k in ('uvscale', 'textured'):
            if k in m:
                del m[k]
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
