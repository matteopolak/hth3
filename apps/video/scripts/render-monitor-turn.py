"""Render successive actual CreativeTrio GLB camera angles for the local film.

The matching projected screen corners are stored with each frame so a browser
capture fills the mesh display without stretching or letterboxing.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path


video = Path(__file__).resolve().parents[1]
renderer_path = video / "scripts" / "render-monitor-model.py"
module_spec = importlib.util.spec_from_file_location("render_monitor_model", renderer_path)
assert module_spec and module_spec.loader
renderer = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(renderer)

source = video / "public" / "models" / "creative-trio-monitor.glb"
directory = video / "public" / "models" / "turn"
directory.mkdir(parents=True, exist_ok=True)
frames = []
for yaw in range(-32, -7):
    image = directory / f"yaw-{abs(yaw):02d}.png"
    renderer.render(source, image, yaw, 7)
    projection_file = image.with_suffix(".json")
    projection = json.loads(projection_file.read_text())
    projection_file.unlink()
    frames.append(
        {
            "yaw": yaw,
            "image": f"models/turn/{image.name}",
            "screen": projection["screen"],
        }
    )

(directory / "manifest.json").write_text(json.dumps(frames, indent=2) + "\n")
