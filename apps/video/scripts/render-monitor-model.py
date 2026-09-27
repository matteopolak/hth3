"""Render the licensed CreativeTrio GLB into a transparent review PNG.

This small offline rasterizer uses the actual glTF mesh and embedded texture. It
keeps the model's geometry outside the browser capture pipeline and requires
only Pillow, which is available in the workspace Python runtime.
"""

from __future__ import annotations

import io
import json
import math
import struct
import sys
from pathlib import Path

from PIL import Image, ImageDraw


def read_glb(path: Path):
    binary = path.read_bytes()
    if binary[:4] != b"glTF":
        raise ValueError("expected binary glTF")
    json_length, _ = struct.unpack_from("<II", binary, 12)
    document = json.loads(binary[20 : 20 + json_length])
    chunk_start = 20 + json_length
    chunk_length, _ = struct.unpack_from("<II", binary, chunk_start)
    chunk = binary[chunk_start + 8 : chunk_start + 8 + chunk_length]

    def accessor(index: int):
        spec = document["accessors"][index]
        view = document["bufferViews"][spec["bufferView"]]
        kind = {5123: "H", 5126: "f"}[spec["componentType"]]
        columns = {"SCALAR": 1, "VEC2": 2, "VEC3": 3}[spec["type"]]
        width = struct.calcsize("<" + kind * columns)
        offset = view.get("byteOffset", 0) + spec.get("byteOffset", 0)
        stride = view.get("byteStride", width)
        return [struct.unpack_from("<" + kind * columns, chunk, offset + i * stride) for i in range(spec["count"])]

    primitive = document["meshes"][0]["primitives"][0]
    positions = accessor(primitive["attributes"]["POSITION"])
    normals = accessor(primitive["attributes"]["NORMAL"])
    uvs = accessor(primitive["attributes"]["TEXCOORD_0"])
    indices = [value[0] for value in accessor(primitive["indices"])]
    image_view = document["bufferViews"][document["images"][0]["bufferView"]]
    start = image_view.get("byteOffset", 0)
    texture = Image.open(io.BytesIO(chunk[start : start + image_view["byteLength"]])).convert("RGB")
    return positions, normals, uvs, indices, texture, document["nodes"][1]["scale"]


def render(path: Path, output: Path, yaw_degrees: float = -8, pitch_degrees: float = 5):
    positions, normals, uvs, indices, texture, node_scale = read_glb(path)
    yaw = math.radians(yaw_degrees)
    pitch = math.radians(pitch_degrees)
    cy, sy, cp, sp = math.cos(yaw), math.sin(yaw), math.cos(pitch), math.sin(pitch)

    def project(position):
        x, y, z = [position[i] * node_scale[i] for i in range(3)]
        x1, z1 = cy * x + sy * z, -sy * x + cy * z
        y1, z2 = cp * y - sp * z1, sp * y + cp * z1
        return (x1, y1, z2)

    projected = [project(position) for position in positions]
    min_x, max_x = min(p[0] for p in projected), max(p[0] for p in projected)
    min_y, max_y = min(p[1] for p in projected), max(p[1] for p in projected)
    canvas_w, canvas_h = 1176, 700
    scale = min(1110 / (max_x - min_x), 660 / (max_y - min_y))
    offset_x = (canvas_w - (max_x - min_x) * scale) / 2 - min_x * scale
    offset_y = (canvas_h + (max_y - min_y) * scale) / 2 + min_y * scale

    def point(index):
        x, y, _ = projected[index]
        return (offset_x + x * scale, offset_y - y * scale)

    triangles = []
    for start in range(0, len(indices), 3):
        ids = indices[start : start + 3]
        if sum(normals[i][2] for i in ids) / 3 < -0.35:
            continue  # rear-facing panel is hidden from this camera
        depth = sum(projected[i][2] for i in ids) / 3
        triangles.append((depth, ids))
    # The model's broad display faces positive Z.
    triangles.sort(key=lambda item: item[0])

    image = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    tex_w, tex_h = texture.size
    for _, ids in triangles:
        uv = [uvs[i] for i in ids]
        u = sum(value[0] for value in uv) / 3 % 1
        v = sum(value[1] for value in uv) / 3 % 1
        tex_r, tex_g, tex_b = texture.getpixel((min(tex_w - 1, int(u * tex_w)), min(tex_h - 1, int((1 - v) * tex_h))))
        nx, ny, nz = [sum(normals[i][axis] for i in ids) / 3 for axis in range(3)]
        light = max(0.48, min(1.25, 0.85 + nx * -0.18 + ny * 0.18 - nz * 0.22))
        # The source poster presents a dark chassis. Recoloring its material
        # keeps the original authored vertices, normals, UVs, and triangles.
        tone = 0.72 + (tex_r + tex_g + tex_b) / (3 * 255) * 0.45
        r, g, b = (int(42 * tone), int(44 * tone), int(49 * tone)) if ids != indices[74 * 3 : 74 * 3 + 3] and ids != indices[75 * 3 : 75 * 3 + 3] else (18, 19, 22)
        fill = (min(255, int(r * light)), min(255, int(g * light)), min(255, int(b * light)), 255)
        draw.polygon([point(i) for i in ids], fill=fill)

    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output)
    front = [(x, y, 0.00345) for x, y in [(-0.22002, 0.27810), (0.22002, 0.27810), (0.22002, 0.08285), (-0.22002, 0.08285)]]
    screen = []
    for x, y, z in front:
        x1, z1 = cy * x + sy * z, -sy * x + cy * z
        y1 = cp * y - sp * z1
        screen.append([round(offset_x + x1 * scale, 2), round(offset_y - y1 * scale, 2)])
    metadata = {"model": str(path), "image": str(output), "triangles": len(triangles), "screen": screen, "bounds": [min_x, min_y, max_x, max_y]}
    output.with_suffix(".json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata))


if __name__ == "__main__":
    render(Path(sys.argv[1]), Path(sys.argv[2]), *(float(arg) for arg in sys.argv[3:5]))
