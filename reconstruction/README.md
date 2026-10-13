# Editable Blender model

Open `AINA_reference.blend` to inspect the original reconstruction. The current browser model source is `../aina-web/public/models/AINA_voice.blend`; the matching GLB is beside it. Browser face, glass, wave and rocket effects also depend on React code in `aina-web/src/Avatar.jsx`.

For exporting the current scene, run Blender with `aina-web/tools/export_aina.py`. Back up your GLB/Blend first: exporter scripts overwrite output assets. Blender is optional for running the app.

`build_aina.py` recreates the original scene, not every later browser-specific adjustment. It saves into this directory and overwrites reconstruction outputs. If you want the viewport reference, set AINA_REFERENCE_IMAGE to an authorized image path; absent a reference it still builds the geometry. Existing Blend files already include packed scene resources.

No Blender add-on or MCP connection is necessary to open/edit the included models. Root build_model.py and pastel_assistant.glb are earlier prototypes, retained separately from the current AINA assets.
