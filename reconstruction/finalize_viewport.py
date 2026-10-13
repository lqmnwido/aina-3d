"""Set a clean colored working viewport, without changing rendered output."""
import bpy
s=bpy.context.scene
s.objects['05 • transparent bubble shell'].hide_set(True)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.shading.color_type='MATERIAL'
            area.spaces.active.overlay.show_overlays=False
            area.spaces.active.region_3d.view_perspective='CAMERA'
s.frame_set(1)
s.render.filepath='//frames/aina_'
bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
