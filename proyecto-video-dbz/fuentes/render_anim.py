import sys, subprocess
sys.path.insert(0, sys.argv[1])
from scenes import *
out, i0, i1 = sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
FPS = 30
cmd = ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
       "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p", out]
p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
surf = skia.Surface(W, H)
for n in range(i0, i1):
    c = surf.getCanvas(); c.clear(skia.Color(0, 0, 0, 255))
    render(c, n / FPS)
    p.stdin.write(surf.makeImageSnapshot().toarray(colorType=skia.kRGBA_8888_ColorType).tobytes())
p.stdin.close(); p.wait()
