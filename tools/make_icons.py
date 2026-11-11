"""앱 아이콘 생성: #0b6e99 바탕에 흰 'pd'. 실행: python tools/make_icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / "icons"
FONT = "C:/Windows/Fonts/malgunbd.ttf"


def make(size: int, name: str) -> None:
    img = Image.new("RGB", (size, size), "#0b6e99")
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(size * 0.42))
    box = d.textbbox((0, 0), "pd", font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), "pd", font=font, fill="#ffffff")
    img.save(OUT / name)


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)
    for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
        make(size, name)
    print("ok")
