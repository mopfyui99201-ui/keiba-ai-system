# -*- coding: utf-8 -*-
"""
make_icons.py - 2つのカスタムアイコン（.icns）を生成
1. 閲覧用: ダーク背景に緑色の馬のシルエットと右肩上がりグラフ
2. 管理者用: ダーク背景に紫色と水色の歯車＋鍵
"""
import os
import subprocess
from PIL import Image, ImageDraw

ICON_DIR = "/Users/m.kairi.c/cline-workspace/keiba-elizabeth-app/icons"
os.makedirs(ICON_DIR, exist_ok=True)

def make_rounded_bg(size, bg_color):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([0, 0, size, size], radius=size // 5, fill=bg_color)
    return img

def draw_horse(draw, cx, cy, scale, color):
    s = max(1, int(scale))
    draw.ellipse([cx - 20*s, cy - 10*s, cx + 20*s, cy + 10*s], fill=color)
    draw.polygon([(cx + 15*s, cy - 5*s), (cx + 30*s, cy - 20*s), (cx + 35*s, cy - 10*s), (cx + 25*s, cy + 5*s)], fill=color)
    draw.ellipse([cx + 30*s, cy - 25*s, cx + 45*s, cy - 5*s], fill=color)
    for x in [-12, -4, 4, 12]:
        draw.rectangle([cx + x*s, cy + 5*s, cx + x*s + 6*s, cy + 25*s], fill=color)
    draw.arc([cx - 25*s, cy - 5*s, cx - 5*s, cy + 20*s], start=200, end=340, fill=color, width=max(1, 4*s))

def draw_graph(draw, cx, cy, scale, color):
    s = max(1, int(scale))
    points = [
        (int(cx - 20*s), int(cy + 15*s)),
        (int(cx - 5*s), int(cy + 5*s)),
        (int(cx + 10*s), int(cy + 12*s)),
        (int(cx + 25*s), int(cy - 15*s)),
    ]
    for i in range(len(points) - 1):
        draw.line([points[i], points[i+1]], fill=color, width=max(1, 4*s))
    for px, py in points:
        draw.ellipse([px - 3*s, py - 3*s, px + 3*s, py + 3*s], fill=color)

def draw_gear(draw, cx, cy, scale, color):
    s = max(1, int(scale))
    import math
    outer = int(22*s)
    inner = int(10*s)
    teeth = 8
    points = []
    for i in range(teeth * 2):
        angle = math.pi * i / teeth
        r = outer if i % 2 == 0 else inner
        points.append((int(cx + r * math.cos(angle)), int(cy + r * math.sin(angle))))
    draw.polygon(points, fill=color)
    draw.ellipse([int(cx - 6*s), int(cy - 6*s), int(cx + 6*s), int(cy + 6*s)], fill=(30, 30, 30, 255))

def draw_key(draw, cx, cy, scale, color):
    s = max(1, int(scale))
    draw.ellipse([int(cx - 8*s), int(cy - 20*s), int(cx + 8*s), int(cy - 4*s)], outline=color, width=max(1, 4*s))
    draw.rectangle([int(cx - 2*s), int(cy - 4*s), int(cx + 2*s), int(cy + 8*s)], fill=color)
    draw.rectangle([int(cx + 2*s), int(cy + 4*s), int(cx + 10*s), int(cy + 10*s)], fill=color)

def generate_icns(name, draw_func):
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    iconset = os.path.join(ICON_DIR, name + ".iconset")
    os.makedirs(iconset, exist_ok=True)

    for size in sizes:
        img = make_rounded_bg(size, (30, 30, 30, 255))
        draw = ImageDraw.Draw(img)
        draw_func(draw, size // 2, size // 2, size / 256.0)
        img.save(os.path.join(iconset, f"icon_{size}x{size}.png"))

    for size in [32, 128, 256, 512]:
        img = make_rounded_bg(size * 2, (30, 30, 30, 255))
        draw = ImageDraw.Draw(img)
        draw_func(draw, size, size, size / 128.0)
        img.save(os.path.join(iconset, f"icon_{size}x{size}@2x.png"))

    icns_path = os.path.join(ICON_DIR, name + ".icns")
    subprocess.run(["iconutil", "-c", "icns", "-o", icns_path, iconset], check=True)
    print(f"生成完了: {icns_path}")
    return icns_path

def view_draw(draw, cx, cy, scale):
    draw_horse(draw, cx - 15, cy + 5, scale, (76, 175, 80, 255))
    draw_graph(draw, cx + 15, cy - 5, scale, (255, 152, 0, 255))

def admin_draw(draw, cx, cy, scale):
    draw_gear(draw, cx - 12, cy - 5, scale, (156, 39, 176, 255))
    draw_key(draw, cx + 12, cy + 5, scale, (3, 169, 244, 255))

view_icns = generate_icns("viewer_icon", view_draw)
admin_icns = generate_icns("admin_icon", admin_draw)

print(f"\n両アイコン生成完了:")
print(f"  閲覧用: {view_icns}")
print(f"  管理者用: {admin_icns}")