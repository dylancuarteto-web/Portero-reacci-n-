"""Renderizador de vista previa para geometrías Bedrock (solo herramienta de desarrollo).

Dibuja las geometrías del add-on con sus texturas sobre un maniquí gris genérico,
para revisar forma, colores y proporciones sin abrir Minecraft. No es exacto al
motor (sin iluminación real ni orden de transparencias perfecto).

Uso (desde ClaudeNPC):  python source/preview_render.py <salida.png>
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
RP = ROOT / "RP"


# --- Transformaciones ---------------------------------------------------------

def rot_x(a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    # Convención Bedrock comprobada en el juego: x positivo baja la cara frontal (-z).
    return np.array([[1, 0, 0], [0, c, s], [0, -s, c]])


def rot_y(a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return np.array([[c, 0, -s], [0, 1, 0], [s, 0, c]])


def rot_z(a):
    c, s = math.cos(math.radians(a)), math.sin(math.radians(a))
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def euler(r):
    x, y, z = r if r else (0, 0, 0)
    return rot_x(x) @ rot_y(y) @ rot_z(z)


class Affine:
    def __init__(self, m=None, t=None):
        self.m = np.eye(3) if m is None else m
        self.t = np.zeros(3) if t is None else t

    def apply(self, p):
        return self.m @ np.asarray(p, dtype=float) + self.t

    def then(self, other):
        """self primero, luego other."""
        return Affine(other.m @ self.m, other.m @ self.t + other.t)


def about(pivot, rotation):
    p = np.asarray(pivot, dtype=float)
    m = euler(rotation)
    return Affine(m, p - m @ p)


# --- Caras de un cubo ---------------------------------------------------------

def cube_faces(origin, size, inflate=0.0):
    x0, y0, z0 = (origin[i] - inflate for i in range(3))
    x1, y1, z1 = (origin[i] + size[i] + inflate for i in range(3))
    return {
        "north": [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
        "south": [(x1, y1, z1), (x0, y1, z1), (x0, y0, z1), (x1, y0, z1)],
        "east": [(x1, y1, z0), (x1, y1, z1), (x1, y0, z1), (x1, y0, z0)],
        "west": [(x0, y1, z1), (x0, y1, z0), (x0, y0, z0), (x0, y0, z1)],
        "up": [(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)],
        "down": [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
    }


def homography(src, dst):
    a, b = [], []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.append(u)
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y]); b.append(v)
    return np.linalg.solve(np.array(a, float), np.array(b, float))


# --- Escena -------------------------------------------------------------------

class Scene:
    def __init__(self):
        self.faces = []  # (profundidad, quad3d, imagen, brillo, emisivo)

    def add_geometry(self, geo_path, tex_path, pose=None, hidden=(), emissive=(), skip_roots=(), scale=None):
        geo = json.loads(Path(geo_path).read_text())["minecraft:geometry"][0]
        tex = Image.open(tex_path).convert("RGBA")
        tw, th = geo["description"]["texture_width"], geo["description"]["texture_height"]
        sx, sy = tex.width / tw, tex.height / th
        bones = {b["name"]: b for b in geo["bones"]}
        pose = pose or {}
        cache = {}

        def world(name):
            if name in cache:
                return cache[name]
            b = bones[name]
            local = about(b.get("pivot", [0, 0, 0]), b.get("rotation"))
            extra = pose.get(name)
            if isinstance(extra, dict):
                if extra.get("rot"):
                    local = local.then(about(b.get("pivot", [0, 0, 0]), extra["rot"]))
                if extra.get("pos"):
                    local = local.then(Affine(np.eye(3), np.asarray(extra["pos"], dtype=float)))
            elif extra:
                local = local.then(about(b.get("pivot", [0, 0, 0]), extra))
            if scale and name in scale:
                piv = np.asarray(b.get("pivot", [0, 0, 0]), dtype=float)
                m = np.diag(scale[name])
                local = Affine(m, piv - m @ piv).then(local)
            parent = b.get("parent")
            tr = local.then(world(parent)) if parent in bones else local
            if parent and parent not in bones and parent in pose:
                tr = tr.then(about(PLAYER_PIVOTS.get(parent, [0, 0, 0]), pose[parent]))
            cache[name] = tr
            return tr

        for name, b in bones.items():
            if name in hidden or any(self._descends(bones, name, r) for r in skip_roots):
                continue
            tr = world(name)
            for c in b.get("cubes", []):
                ctr = about(c.get("pivot", [0, 0, 0]), c.get("rotation")).then(tr) if c.get("rotation") else tr
                faces = cube_faces(c["origin"], c["size"], c.get("inflate", 0))
                uvs = c.get("uv", {})
                if isinstance(uvs, list):
                    u0, v0 = uvs
                    w, h, d = c["size"]
                    uvs = {"up": {"uv": [u0 + d, v0], "uv_size": [w, d]}, "down": {"uv": [u0 + d + w, v0], "uv_size": [w, d]},
                           "west": {"uv": [u0, v0 + d], "uv_size": [d, h]}, "north": {"uv": [u0 + d, v0 + d], "uv_size": [w, h]},
                           "east": {"uv": [u0 + d + w, v0 + d], "uv_size": [d, h]}, "south": {"uv": [u0 + 2 * d + w, v0 + d], "uv_size": [w, h]}}
                for face, quad in faces.items():
                    uv = uvs.get(face)
                    if not uv:
                        continue
                    u, v = uv["uv"]
                    w, h = uv["uv_size"]
                    if abs(w) < 1e-6 or abs(h) < 1e-6:
                        continue
                    box = (int(round(u * sx)), int(round(v * sy)),
                           int(round((u + w) * sx)), int(round((v + h) * sy)))
                    img = tex.crop(box) if box[2] > box[0] and box[3] > box[1] else None
                    if img is None:
                        continue
                    pts = [ctr.apply(p) for p in quad]
                    self.faces.append((pts, img, name in emissive))

    @staticmethod
    def _descends(bones, name, root):
        while name:
            if name == root:
                return True
            name = bones[name].get("parent") if name in bones else None
        return False

    def add_box(self, origin, size, color, pose_pivot=None, pose_rot=None):
        tr = about(pose_pivot, pose_rot) if pose_rot else Affine()
        for face, quad in cube_faces(origin, size).items():
            img = Image.new("RGBA", (4, 4), color)
            self.faces.append(([tr.apply(p) for p in quad], img, False))

    def render(self, yaw, pitch, scale, size=(520, 560), center=(0, 16, 0), bg=(36, 40, 48)):
        cam = rot_x(pitch) @ rot_y(yaw)
        light = np.array([0.4, 0.8, -0.45])
        light /= np.linalg.norm(light)
        cx, cy = size[0] / 2, size[1] / 2
        canvas = Image.new("RGBA", size, bg + (255,))
        items = []
        for pts, img, emissive in self.faces:
            v = [cam @ (np.asarray(p) - np.asarray(center)) for p in pts]
            n = np.cross(v[1] - v[0], v[3] - v[0])
            norm = np.linalg.norm(n)
            if norm < 1e-9:
                continue
            n /= norm
            if n[2] > 0.0:  # cara de espaldas a la cámara (la cámara mira hacia +z)
                continue
            depth = sum(p[2] for p in v) / 4
            wn = np.cross(pts[1] - pts[0], pts[3] - pts[0])
            wn /= (np.linalg.norm(wn) or 1)
            shade = 1.0 if emissive else 0.55 + 0.45 * max(0.0, float(-wn @ (-light)))
            quad2d = [(cx + p[0] * scale, cy - p[1] * scale) for p in v]
            items.append((depth, quad2d, img, shade, emissive))
        items.sort(key=lambda i: -i[0])
        glow = Image.new("RGBA", size, (0, 0, 0, 0))
        for depth, quad, img, shade, emissive in items:
            xs = [p[0] for p in quad]; ys = [p[1] for p in quad]
            bx0, by0 = int(math.floor(min(xs))), int(math.floor(min(ys)))
            bx1, by1 = int(math.ceil(max(xs))) + 1, int(math.ceil(max(ys))) + 1
            if bx1 - bx0 < 1 or by1 - by0 < 1:
                continue
            w, h = img.size
            local = [(x - bx0, y - by0) for x, y in quad]
            try:
                coeffs = homography([(0, 0), (w, 0), (w, h), (0, h)], local)
            except np.linalg.LinAlgError:
                continue
            warped = img.transform((bx1 - bx0, by1 - by0), Image.PERSPECTIVE, tuple(coeffs), Image.NEAREST)
            mask = Image.new("L", warped.size, 0)
            ImageDraw.Draw(mask).polygon(local, fill=255)
            if shade < 0.999:
                rgb = warped.convert("RGB").point(lambda c: int(c * shade))
                warped = Image.merge("RGBA", (*rgb.split(), warped.getchannel("A")))
            alpha = Image.composite(warped.getchannel("A"), Image.new("L", warped.size, 0), mask)
            if emissive:
                # Material emisivo: el alfa marca el brillo, el color se ve opaco.
                alpha = mask
                g = warped.copy(); g.putalpha(mask)
                glow.alpha_composite(g, (bx0, by0))
            warped.putalpha(alpha)
            canvas.alpha_composite(warped, (bx0, by0))
        bloom = glow.filter(ImageFilter.GaussianBlur(6))
        canvas = Image.alpha_composite(canvas, Image.blend(Image.new("RGBA", size, (0, 0, 0, 0)), bloom, 0.9))
        return canvas


PLAYER_PIVOTS = {"head": [0, 24, 0], "rightArm": [-5, 22, 0], "leftArm": [5, 22, 0], "body": [0, 24, 0]}


def add_mannequin(scene, skin=(118, 118, 124, 255), arm_pose=None, head_pose=None):
    """Maniquí gris genérico con las proporciones del jugador."""
    dark = tuple(int(c * 0.8) for c in skin[:3]) + (255,)
    scene.add_box([-4, 24, -4], [8, 8, 8], skin, PLAYER_PIVOTS["head"], head_pose)
    scene.add_box([-4, 12, -2], [8, 12, 4], dark)
    scene.add_box([-8, 12, -2], [4, 12, 4], skin, PLAYER_PIVOTS["rightArm"], arm_pose)
    scene.add_box([4, 12, -2], [4, 12, 4], skin)
    scene.add_box([-4, 0, -2], [4, 12, 4], dark)
    scene.add_box([0, 0, -2], [4, 12, 4], dark)


def sheet(images, labels, out):
    w = sum(i.width for i in images) + 10 * (len(images) - 1)
    h = max(i.height for i in images) + 24
    s = Image.new("RGBA", (w, h), (20, 22, 26, 255))
    d = ImageDraw.Draw(s)
    x = 0
    for img, label in zip(images, labels):
        s.alpha_composite(img, (x, 24))
        d.text((x + 8, 6), label, fill=(255, 200, 120, 255))
        x += img.width + 10
    s.save(out)


def pose_de(anim_file, nombre):
    """Postura fija (primer valor) de una animación en bucle, para dibujarla."""
    data = json.loads(Path(anim_file).read_text())["animations"][nombre]["bones"]
    pose = {}
    for bone, canales in data.items():
        entrada = {}
        for canal, clave in (("rotation", "rot"), ("position", "pos")):
            v = canales.get(canal)
            if isinstance(v, list) and all(isinstance(c, (int, float)) for c in v):
                entrada[clave] = v
        if entrada:
            pose[bone] = entrada
    return pose


def sumar(*poses):
    total = {}
    for pose in poses:
        for bone, e in pose.items():
            t = total.setdefault(bone, {})
            for clave, v in e.items():
                t[clave] = [a + b for a, b in zip(t.get(clave, [0, 0, 0]), v)]
    return total


def main(out):
    models = RP / "models/entity"
    tex = RP / "textures/entity/claudenpc"
    anims = RP / "animations"
    shots, labels = [], []
    cielo = (120, 160, 210)
    for yaw, label in ((0, "Claude"), (-35, "Claude 3/4")):
        sc = Scene()
        sc.add_geometry(models / "claude.geo.json", tex / "claude.png", emissive=("emblema",))
        shots.append(sc.render(yaw, 8, 9, size=(260, 340), center=(0, 16, 0), bg=cielo))
        labels.append(label)
    sc = Scene()
    sc.add_geometry(models / "claude.geo.json", tex / "claude.png", emissive=("emblema",),
                    pose=pose_de(anims / "claude.animation.json", "animation.claudenpc.cubrirse"))
    shots.append(sc.render(-30, 8, 9, size=(260, 340), center=(0, 16, 0), bg=cielo))
    labels.append("Escudo arriba")
    sc = Scene()
    sc.add_geometry(models / "claude.geo.json", tex / "claude.png", emissive=("emblema",),
                    pose=pose_de(anims / "claude.animation.json", "animation.claudenpc.sentado"))
    shots.append(sc.render(-60, 8, 9, size=(260, 340), center=(0, 10, 0), bg=cielo))
    labels.append("Sentado en clase")
    libro = pose_de(anims / "maestro.animation.json", "animation.claudenpc.maestro.libro")
    for yaw, label in ((0, "Claude Maestro"), (-35, "Maestro 3/4"), (150, "Maestro espalda")):
        sc = Scene()
        sc.add_geometry(models / "maestro.geo.json", tex / "maestro.png", emissive=("pin",), pose=libro)
        shots.append(sc.render(yaw, 8, 9, size=(260, 340), center=(0, 16, 0), bg=(150, 132, 112)))
        labels.append(label)
    sc = Scene()
    sc.add_geometry(models / "maestro.geo.json", tex / "maestro.png", emissive=("pin",), pose=sumar(libro, {
        "leftArm": {"rot": [-38, 0, -16]}, "rightArm": {"rot": [-62, 0, 24]}, "head": {"rot": [24, 0, 0]}}))
    shots.append(sc.render(-25, 8, 9, size=(260, 340), center=(0, 16, 0), bg=(150, 132, 112)))
    labels.append("Maestro leyendo")
    sc = Scene()
    sc.add_geometry(models / "maestro.geo.json", tex / "maestro.png", emissive=("pin",), pose=libro)
    shots.append(sc.render(-20, 4, 26, size=(260, 340), center=(0, 28, -2), bg=(150, 132, 112)))
    labels.append("Lentes y cabello")
    for yaw, label in ((0, "Claude Golden"),):
        sc = Scene()
        sc.add_geometry(models / "golden.geo.json", tex / "golden.png",
                        hidden=("aura_head", "aura_body", "aura_rarm", "aura_larm", "aura_rleg", "aura_lleg"),
                        emissive=("head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg", "ojos", "emblema", "halo", "orbes"))
        sc.add_geometry(models / "golden.geo.json", tex / "golden.png",
                        hidden=("head", "body", "rightArm", "leftArm", "rightLeg", "leftLeg", "ojos", "emblema", "halo", "orbes"))
        shots.append(sc.render(yaw, 8, 8, size=(260, 340), center=(0, 18, 0), bg=(40, 44, 70)))
        labels.append(label)
    # Dos filas para que se vea bien en el móvil.
    mitad = (len(shots) + 1) // 2
    fila1, fila2 = Path(out).with_suffix(".a.png"), Path(out).with_suffix(".b.png")
    sheet(shots[:mitad], labels[:mitad], fila1)
    sheet(shots[mitad:], labels[mitad:], fila2)
    a, b = Image.open(fila1), Image.open(fila2)
    hoja = Image.new("RGBA", (max(a.width, b.width), a.height + b.height + 8), (20, 22, 26, 255))
    hoja.alpha_composite(a.convert("RGBA"), (0, 0))
    hoja.alpha_composite(b.convert("RGBA"), (0, a.height + 8))
    hoja.save(out)
    fila1.unlink()
    fila2.unlink()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "preview.png")
