"""Renderizador de previsualización (ortográfico) de geometrías Bedrock con textura.

Uso: python3 preview_geo.py modelo.geo.json textura.png salida.png [yaw] [pitch]
Sirve para revisar sin el juego que el box-UV y la geometría coinciden.
"""
import json
import math
import sys
from PIL import Image, ImageDraw


def rot_matrix(rx, ry, rz):
    rx, ry, rz = (math.radians(v) for v in (rx, ry, rz))
    cx, sx, cy, sy, cz, sz = math.cos(rx), math.sin(rx), math.cos(ry), math.sin(ry), math.cos(rz), math.sin(rz)
    X = [[1, 0, 0], [0, cx, -sx], [0, sx, cx]]
    Y = [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]
    Z = [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]
    return mm(Z, mm(Y, X))


def mm(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def mv(m, v):
    return [sum(m[i][k] * v[k] for k in range(3)) for i in range(3)]


def main():
    geo_path, tex_path, out = sys.argv[1:4]
    yaw = float(sys.argv[4]) if len(sys.argv) > 4 else 35
    pitch = float(sys.argv[5]) if len(sys.argv) > 5 else 20
    geo = json.load(open(geo_path))["minecraft:geometry"][0]
    tex = Image.open(tex_path).convert("RGBA")
    tw, th = geo["description"]["texture_width"], geo["description"]["texture_height"]
    sx_, sy_ = tex.width / tw, tex.height / th
    bones = {b["name"]: b for b in geo["bones"]}

    def bone_tf(name):
        """Lista de transformaciones (pivot, matriz) desde el hueso hasta la raíz."""
        out = []
        while name:
            b = bones[name]
            if "rotation" in b:
                r = b["rotation"]
                out.append((b["pivot"], rot_matrix(-r[0], -r[1], r[2])))
            name = b.get("parent")
        return out

    def apply(tfs, p):
        for piv, m in tfs:
            q = [p[i] - piv[i] for i in range(3)]
            q = mv(m, q)
            p = [q[i] + piv[i] for i in range(3)]
        return p

    quads = []
    for b in geo["bones"]:
        tfs = bone_tf(b["name"])
        for c in b.get("cubes", []):
            ox, oy, oz = c["origin"]
            w, hh, d = c["size"]
            uv = c["uv"]
            if isinstance(uv, dict):
                faces = {k: (v["uv"][0], v["uv"][1], v["uv_size"][0], v["uv_size"][1]) for k, v in uv.items()}
            else:
                u, v = uv
                W, H, D = (math.ceil(t) for t in (w, hh, d))
                faces = {"up": (u + D, v, W, D), "down": (u + D + W, v, W, D), "east": (u, v + D, D, H),
                         "north": (u + D, v + D, W, H), "west": (u + D + W, v + D, D, H),
                         "south": (u + 2 * D + W, v + D, W, H)}
            x0, x1, y0, y1, z0, z1 = ox, ox + w, oy, oy + hh, oz, oz + d
            for face, (fu, fv, fw, fh) in faces.items():
                nx, ny = max(1, int(round(abs(fw)))), max(1, int(round(abs(fh))))
                for j in range(ny):
                    for i in range(nx):
                        a0, a1, b0, b1 = i / nx, (i + 1) / nx, j / ny, (j + 1) / ny
                        if face == "north":
                            pts = [(x1 - (x1 - x0) * a, y1 - (y1 - y0) * bb, z0) for a, bb in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]
                        elif face == "south":
                            pts = [(x0 + (x1 - x0) * a, y1 - (y1 - y0) * bb, z1) for a, bb in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]
                        elif face == "east":
                            pts = [(x1, y1 - (y1 - y0) * bb, z1 - (z1 - z0) * a) for a, bb in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]
                        elif face == "west":
                            pts = [(x0, y1 - (y1 - y0) * bb, z0 + (z1 - z0) * a) for a, bb in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]
                        elif face == "up":
                            pts = [(x1 - (x1 - x0) * a, y1, z0 + (z1 - z0) * bb) for a, bb in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]
                        else:
                            pts = [(x1 - (x1 - x0) * a, y0, z1 - (z1 - z0) * bb) for a, bb in ((a0, b0), (a1, b0), (a1, b1), (a0, b1))]
                        tx = int((fu + (i + 0.5) * fw / nx) * sx_)
                        ty = int((fv + (j + 0.5) * fh / ny) * sy_)
                        if not (0 <= tx < tex.width and 0 <= ty < tex.height):
                            continue
                        col = tex.getpixel((tx, ty))
                        if col[3] == 0:
                            continue
                        quads.append(([apply(tfs, list(p)) for p in pts], col, face))
    view = mm(rot_matrix(pitch, 0, 0), rot_matrix(0, yaw, 0))
    proj = []
    for pts, col, face in quads:
        vp = [mv(view, [-p[0], p[1], -p[2]]) for p in pts]
        depth = sum(p[2] for p in vp) / 4
        light = {"up": 1.0, "north": 0.85, "south": 0.7, "east": 0.78, "west": 0.78, "down": 0.5}[face]
        c = tuple(min(255, int(col[k] * light)) for k in range(3)) + (255,)
        proj.append((depth, [(p[0], -p[1]) for p in vp], c))
    proj.sort(key=lambda t: -t[0])
    xs = [p[0] for _, ps, _ in proj for p in ps]
    ys = [p[1] for _, ps, _ in proj for p in ps]
    scale = 480 / max(max(xs) - min(xs), max(ys) - min(ys), 1)
    img = Image.new("RGBA", (520, 520), (70, 78, 92, 255))
    dr = ImageDraw.Draw(img)
    for _, ps, c in proj:
        dr.polygon([((x - min(xs)) * scale + 20, (y - min(ys)) * scale + 20) for x, y in ps], fill=c)
    img.save(out)


if __name__ == "__main__":
    main()
