# Quick Cycles render of one zone from a camera, for checking a layout without
# baking or loading the site.
#   python blender/preview_zone.py <zone> out.png  cam_x cam_y cam_z  look_x look_y look_z  [lens_mm]
# Coordinates are three.js world space (the same numbers as world.js).
import importlib
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import lib  # noqa: E402

zone, out = sys.argv[1], os.path.abspath(sys.argv[2])
cx, cy, cz, lx, ly, lz = map(float, sys.argv[3:9])
lens = float(sys.argv[9]) if len(sys.argv) > 9 else 28
lib.reset(quick=True)
sc = bpy.context.scene
sc.render.use_compositing = False
sc.cycles.samples = 32
importlib.import_module(f'zones.{zone}').build(True)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.lens = lens
cam.location = lib.B(cx, cy, cz)
cam.rotation_euler = (lib.B(lx, ly, lz) - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 960, 540
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('wrote', out)
