# Studio render of the time machine on its own, for iterating on the model.
#   python blender/preview_car.py out.png [yaw_degrees] [elevation_degrees] [open_door: 1 | -1]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import lib  # noqa: E402
from zones import delorean  # noqa: E402

out = os.path.abspath(sys.argv[1])
yaw = math.radians(float(sys.argv[2]) if len(sys.argv) > 2 else 35)
elev = math.radians(float(sys.argv[3]) if len(sys.argv) > 3 else 18)
open_door = int(sys.argv[4]) if len(sys.argv) > 4 else None
lib.reset(quick=True)
sc = bpy.context.scene
sc.render.use_compositing = False
sc.cycles.samples = 24
sc.world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.6
z = lib.Zone('preview')
z.box('floor', (30, 0.1, 30), (0, -0.05, 0), material=lib.mat('pv_floor', '#1a1a1c', rough=0.6))
delorean.build(z, open_door=open_door)
z.light('AREA', (-2, 5, 3), '#ffffff', 1500, size=(4, 4), aim=(0, 0, 0))
z.light('AREA', (4, 2, -4), '#9fc8ff', 600, size=(3, 3), aim=(0, 0.6, 0))
d = 7.5
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
sc.collection.objects.link(cam)
cam.data.lens = 50
cam.location = lib.B(-d * math.cos(elev) * math.cos(yaw), 0.6 + d * math.sin(elev), d * math.cos(elev) * math.sin(yaw))
target = lib.B(0, 0.55, 0)
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = 960, 540
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('wrote', out)
