"""Sintetiza los efectos de sonido originales del addon (numpy -> wav -> ogg vorbis).

Ningún sonido proviene de grabaciones de terceros: todo es síntesis procedural.
"""
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
DIR = os.path.join(OUT, "sounds/lacobra")
SR = 22050
rng = np.random.default_rng(42)


def t_(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=0.01, r=0.3, shape=2.0):
    t = np.arange(n) / SR
    d = n / SR
    e = np.minimum(1, t / max(a, 1e-4))
    e *= np.clip((d - t) / max(r, 1e-4), 0, 1) ** shape
    return e


def noise(d):
    return rng.uniform(-1, 1, int(SR * d))


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    return np.fft.irfft(X, len(x))


def sweep_filter(x, f0, f1, width=0.5):
    """Filtro pasa-banda que barre de f0 a f1 (por bloques)."""
    out = np.zeros_like(x)
    blk = 1024
    for i in range(0, len(x), blk // 2):
        seg = x[i:i + blk]
        if len(seg) < 16:
            continue
        p = i / len(x)
        fc = f0 * (f1 / f0) ** p
        w = np.hanning(len(seg))
        out[i:i + len(seg)] += band(seg * w, fc * (1 - width), fc * (1 + width)) * 0.75
    return out


def tone(freqs, d, kind="sin"):
    t = t_(d)
    if callable(freqs):
        ph = 2 * np.pi * np.cumsum(freqs(t)) / SR
    else:
        ph = 2 * np.pi * freqs * t
    if kind == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1) - 1
    if kind == "sq":
        return np.sign(np.sin(ph))
    return np.sin(ph)


def chime(base, d=1.2, ratios=(1, 2.01, 3.02, 4.2), decay=3.0):
    t = t_(d)
    s = sum(np.sin(2 * np.pi * base * r * t) * np.exp(-t * decay * (1 + i * 0.6)) / (i + 1) for i, r in enumerate(ratios))
    return s * env(len(t), 0.005, d * 0.3, 1)


def norm(x, peak=0.85):
    m = np.max(np.abs(x)) or 1
    return x / m * peak


def mixdown(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[:len(p)] += p
    return out


def pad(x, start):
    return np.concatenate([np.zeros(int(start * SR)), x])


def write(name, x):
    os.makedirs(DIR, exist_ok=True)
    x = norm(x)
    pcm = (x * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
        wav_path = tf.name
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "libvorbis", "-q:a", "4",
                    os.path.join(DIR, name + ".ogg")], check=True)
    os.unlink(wav_path)


def hiss(d, lo=3000, hi=9000):
    return band(noise(d), lo, hi) * env(int(SR * d), 0.08, d * 0.6, 1.5)


SOUNDS = {}


def snd(f):
    SOUNDS[f.__name__] = f
    return f


@snd
def instinto_on():
    d = 1.0
    up = tone(lambda t: 220 + 660 * t / d, d, "saw") * 0.3 * env(int(SR * d), 0.02, 0.4)
    return mixdown(up, hiss(0.7) * 0.6, pad(chime(880, 0.8), 0.25) * 0.5)


@snd
def instinto_off():
    d = 0.8
    return mixdown(tone(lambda t: 700 - 500 * t / d, d) * env(int(SR * d), 0.01, 0.5) * 0.6, hiss(0.5, 2000, 6000) * 0.4)


@snd
def golpe_especial():
    d = 0.35
    thump = tone(lambda t: 140 - 80 * t / d, d) * np.exp(-t_(d) * 12)
    crack = band(noise(d), 1500, 7000) * np.exp(-t_(d) * 25)
    return mixdown(thump, crack * 0.8, chime(1320, 0.35, decay=9) * 0.4)


@snd
def carga():
    d = 1.3
    f = lambda t: 110 * (1 + 3 * (t / d) ** 1.5)
    s = tone(f, d, "saw") * (0.6 + 0.4 * np.sin(2 * np.pi * 14 * t_(d)))
    s = band(s, 60, 3000) * env(int(SR * d), 0.3, 0.05, 1)
    return mixdown(s, sweep_filter(noise(d), 400, 4000) * env(int(SR * d), 0.5, 0.1) * 0.8)


@snd
def remate_lanzar():
    d = 0.7
    kick = tone(lambda t: 90 - 40 * t, 0.25) * np.exp(-t_(0.25) * 18)
    whoosh = sweep_filter(noise(d), 3000, 500, 0.6) * env(int(SR * d), 0.02, 0.5)
    return mixdown(kick * 1.2, whoosh)


@snd
def impacto():
    d = 1.4
    boom = band(noise(d), 30, 400) * np.exp(-t_(d) * 4)
    sub = tone(lambda t: 70 - 30 * t / d, d) * np.exp(-t_(d) * 3)
    sparkle = mixdown(*[pad(chime(1000 + 300 * i, 0.5, decay=8), 0.05 * i) for i in range(4)]) * 0.15
    return mixdown(boom * 1.2, sub, sparkle)


@snd
def veneno_lanzar():
    d = 1.0
    h = hiss(d, 3500, 10000)
    h *= 0.6 + 0.4 * np.sin(2 * np.pi * 7 * t_(d))
    return mixdown(h, tone(lambda t: 300 + 200 * np.sin(t * 20), d) * env(int(SR * d), 0.05, 0.6) * 0.2)


@snd
def veneno_golpe():
    d = 0.5
    return mixdown(band(noise(d), 800, 3000) * np.exp(-t_(d) * 10), tone(lambda t: 500 - 300 * t, d, "sq") * np.exp(-t_(d) * 9) * 0.2)


@snd
def dominio_on():
    d = 2.0
    drone = sum(tone(f, d, "saw") / (i + 1) for i, f in enumerate([55, 82.5, 110.3]))
    drone = band(drone, 40, 1500) * env(int(SR * d), 0.4, 0.8)
    return mixdown(drone, pad(chime(660, 1.4, decay=2), 0.3) * 0.5, pad(chime(990, 1.2, decay=2), 0.6) * 0.4)


@snd
def dominio_pulso():
    d = 0.6
    return mixdown(tone(lambda t: 160 - 60 * t, d) * np.exp(-t_(d) * 6), band(noise(d), 200, 1200) * np.exp(-t_(d) * 8) * 0.5)


@snd
def onda():
    d = 1.8
    w = sweep_filter(noise(d), 200, 4000, 0.7) * env(int(SR * d), 0.05, 1.2)
    sub = tone(lambda t: 60 + 10 * t, d) * np.exp(-t_(d) * 2)
    return mixdown(w, sub * 0.9)


@snd
def suprema_carga():
    d = 3.2
    f = lambda t: 55 * (1 + 4 * (t / d) ** 2)
    s = sum(tone(lambda t, k=k: f(t) * k, d, "saw") / k for k in (1, 1.5, 2.01))
    s = band(s, 40, 4000) * env(int(SR * d), 1.5, 0.05, 1)
    trem = 0.7 + 0.3 * np.sin(2 * np.pi * np.cumsum(4 + 16 * t_(d) / d) / SR)
    return mixdown(s * trem, hiss(d, 2000, 8000) * np.linspace(0, 0.8, int(SR * d)))


@snd
def suprema_transformacion():
    d = 2.0
    choir = sum(np.sin(2 * np.pi * f * t_(d) + np.sin(2 * np.pi * 5 * t_(d)) * 0.4) for f in (220, 277.2, 329.6, 440))
    choir *= env(int(SR * d), 0.3, 1.0)
    return mixdown(choir * 0.5, pad(chime(880, 1.5, decay=1.5), 0.2) * 0.6)


@snd
def suprema_final():
    d = 2.2
    notes = [523.3, 659.3, 784, 1046.5]
    return mixdown(*[pad(chime(n, 1.6, decay=2.2), i * 0.12) * 0.6 for i, n in enumerate(notes)])


@snd
def totem():
    d = 1.6
    return mixdown(pad(chime(392, 1.4, decay=2), 0) * 0.7, pad(chime(587, 1.2, decay=2), 0.15) * 0.6, hiss(1.0, 4000, 9000) * 0.3)


@snd
def guardian_zap():
    d = 0.3
    return tone(lambda t: 1800 - 1400 * t / d, d, "sq") * np.exp(-t_(d) * 14) * 0.5 + band(noise(d), 3000, 8000) * np.exp(-t_(d) * 20) * 0.3


@snd
def atajada():
    d = 0.6
    slap = band(noise(0.12), 500, 5000) * np.exp(-t_(0.12) * 40)
    return mixdown(slap * 1.4, pad(chime(740, 0.5, decay=6), 0.04) * 0.6, pad(tone(lambda t: 200, 0.3) * np.exp(-t_(0.3) * 12), 0) * 0.6)


@snd
def balon_patada():
    d = 0.3
    return mixdown(tone(lambda t: 120 - 60 * t / d, d) * np.exp(-t_(d) * 20), band(noise(d), 1000, 4000) * np.exp(-t_(d) * 35) * 0.6)


@snd
def balon_golpe():
    d = 0.5
    return mixdown(tone(lambda t: 200 - 100 * t, d) * np.exp(-t_(d) * 14), chime(1200, 0.5, decay=8) * 0.4)


@snd
def jefe_siseo():
    d = 1.6
    h = hiss(d, 2500, 9000)
    h *= 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 1.2 * t_(d)))
    rattle = (np.sin(2 * np.pi * 30 * t_(d)) > 0.6) * band(noise(d), 2000, 6000) * env(int(SR * d), 0.3, 0.6) * 0.5
    return mixdown(h, rattle)


@snd
def jefe_rugido():
    d = 2.2
    f = lambda t: 70 + 30 * np.sin(2 * np.pi * 3 * t) + 40 * np.exp(-t)
    roar = tone(f, d, "saw") * (1 + 0.5 * band(noise(d), 20, 80))
    roar = band(roar, 40, 1800) * env(int(SR * d), 0.15, 0.9)
    return mixdown(roar, hiss(d, 1500, 7000) * 0.6)


@snd
def jefe_herido():
    d = 0.5
    return mixdown(band(noise(d), 1800, 7000) * env(int(SR * d), 0.01, 0.4), tone(lambda t: 260 - 160 * t, d, "saw") * env(int(SR * d), 0.01, 0.3) * 0.3)


@snd
def jefe_muerte():
    d = 3.0
    fall = tone(lambda t: 120 * np.exp(-t * 0.6), d, "saw")
    fall = band(fall, 30, 1500) * env(int(SR * d), 0.05, 2.0)
    return mixdown(fall, hiss(2.5, 1000, 6000) * 0.5, pad(impacto() * 0.6, 1.2))


@snd
def jefe_mordida():
    d = 0.35
    return mixdown(band(noise(d), 300, 2500) * np.exp(-t_(d) * 16), tone(lambda t: 90, d) * np.exp(-t_(d) * 20))


@snd
def esbirro_siseo():
    return hiss(0.7, 4000, 10000) * 0.8


@snd
def sin_energia():
    d = 0.35
    return mixdown(tone(220, 0.15, "sq") * 0.3 * env(int(SR * 0.15), 0.005, 0.05), pad(tone(165, 0.18, "sq") * 0.3 * env(int(SR * 0.18), 0.005, 0.06), 0.16))


@snd
def menu():
    return mixdown(chime(988, 0.4, decay=8) * 0.6, pad(chime(1319, 0.4, decay=8) * 0.5, 0.06))


@snd
def listo():
    return mixdown(chime(784, 0.5, decay=6) * 0.5, pad(chime(1175, 0.6, decay=5) * 0.5, 0.08))


@snd
def invocacion():
    d = 3.5
    drone = band(sum(tone(f, d, "saw") for f in (41, 61.7, 82.4)), 30, 900) * env(int(SR * d), 1.5, 0.6)
    return mixdown(drone, hiss(d, 2000, 7000) * 0.4, pad(jefe_rugido() * 0.8, 1.6))


if __name__ == "__main__":
    for name, fn in SOUNDS.items():
        write(name, fn())
    print("sonidos:", len(SOUNDS))
