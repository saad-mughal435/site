"""Build the OpenGraph card for saadm.dev.

Output: og.png at the site root, 1200x630, optimised PNG.
Run:    python scripts/build-og.py     (from the site/ directory)
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]  # site/
OUT = ROOT / "og.png"

W, H = 1200, 630
PAD = 72
FONTS = Path("C:/Windows/Fonts")


# ---------- colour palette (matches the dark portfolio shell) ----------
BG_TOP = (7, 8, 13)
BG_BOTTOM = (15, 22, 36)
GRAD_A = (124, 156, 255)   # accent blue
GRAD_B = (94, 234, 212)    # mint
GRAD_C = (196, 181, 253)   # violet
TEXT = (237, 241, 248)
MUTED = (181, 189, 204)
DIM = (122, 130, 148)


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont:
    """Try a few common Windows fonts, falling back to default."""
    for candidate in (name, name.lower(), name.upper()):
        p = FONTS / candidate
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def vertical_gradient(draw: ImageDraw.ImageDraw, top: tuple, bottom: tuple) -> None:
    for y in range(H):
        t = y / H
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))


def soft_blob(img: Image.Image, cx: int, cy: int, radius: int, colour: tuple, opacity: int) -> None:
    """Paint a soft circular accent (radial gradient via overlay + blur)."""
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse(
        [cx - radius, cy - radius, cx + radius, cy + radius],
        fill=(colour[0], colour[1], colour[2], opacity),
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=radius // 2))
    img.alpha_composite(overlay)


def measure(font: ImageFont.FreeTypeFont, text: str) -> tuple[int, int]:
    bbox = font.getbbox(text)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def pill(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    label: str,
    font: ImageFont.FreeTypeFont,
    *,
    bg=(255, 255, 255, 14),
    fg=TEXT,
    pad_x: int = 14,
    pad_y: int = 8,
    radius: int = 999,
    stroke: tuple | None = (255, 255, 255, 28),
) -> int:
    """Draw a rounded pill, return the pill width (incl padding)."""
    tw, th = measure(font, label)
    box = [x, y, x + tw + pad_x * 2, y + th + pad_y * 2]
    draw.rounded_rectangle(box, radius=radius, fill=bg, outline=stroke, width=1)
    draw.text((x + pad_x, y + pad_y - 1), label, font=font, fill=fg)
    return tw + pad_x * 2


def main() -> None:
    img = Image.new("RGBA", (W, H), BG_TOP + (255,))
    base = Image.new("RGB", (W, H), BG_TOP)
    bd = ImageDraw.Draw(base)
    vertical_gradient(bd, BG_TOP, BG_BOTTOM)
    img = base.convert("RGBA")

    # Soft accent blobs in the corners — give the card depth without competing with the text.
    soft_blob(img, W - 80, 80, 220, GRAD_A, 70)
    soft_blob(img, 60, H - 60, 260, GRAD_B, 55)
    soft_blob(img, W // 2 + 100, H + 40, 320, GRAD_C, 35)

    draw = ImageDraw.Draw(img)

    # Top thin gradient line — the "accent stripe" the site uses.
    for x in range(W):
        t = x / W
        r = int(GRAD_A[0] + (GRAD_B[0] - GRAD_A[0]) * t)
        g = int(GRAD_A[1] + (GRAD_B[1] - GRAD_A[1]) * t)
        b = int(GRAD_A[2] + (GRAD_B[2] - GRAD_A[2]) * t)
        draw.line([(x, 0), (x, 3)], fill=(r, g, b, 255))

    # Fonts — fall back gracefully if Inter etc. not installed.
    f_brand = load_font("consolab.ttf", 18)
    f_mono = load_font("consola.ttf", 16)
    f_eyebrow = load_font("consolab.ttf", 16)
    f_title = load_font("arialbd.ttf", 72)
    f_title_sm = load_font("arialbd.ttf", 60)
    f_role = load_font("arialbd.ttf", 32)
    f_tag = load_font("arial.ttf", 22)
    f_chip = load_font("consolab.ttf", 15)

    # ---------- Brand / URL header ----------
    draw.text((PAD, PAD - 24), "saadm.dev", font=f_brand, fill=DIM)

    # Brand logo (gradient square + S)
    logo_x = W - PAD - 56
    logo_y = PAD - 28
    draw.rounded_rectangle([logo_x, logo_y, logo_x + 56, logo_y + 56], radius=14, fill=GRAD_A)
    # diagonal overlay to fake a gradient
    grad = Image.new("RGBA", (56, 56), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for i in range(56):
        a = int(255 * (i / 56))
        gd.line([(0, i), (56, i)], fill=(GRAD_B[0], GRAD_B[1], GRAD_B[2], a))
    rounded_mask = Image.new("L", (56, 56), 0)
    ImageDraw.Draw(rounded_mask).rounded_rectangle([0, 0, 56, 56], radius=14, fill=255)
    img.paste(grad, (logo_x, logo_y), rounded_mask)
    s_font = load_font("arialbd.ttf", 30)
    sw, sh = measure(s_font, "S")
    draw.text((logo_x + (56 - sw) // 2, logo_y + (56 - sh) // 2 - 4), "S", font=s_font, fill=BG_TOP)

    # ---------- Eyebrow ----------
    eyebrow_y = 170
    draw.text((PAD, eyebrow_y), "● MUHAMMAD SAAD", font=f_eyebrow, fill=GRAD_B)

    # ---------- Title (two lines for impact + fit) ----------
    title_y = eyebrow_y + 38
    line1 = "Electrical & Automation"
    line2 = "Engineer · Software Builder"
    # Auto-fit: shrink one notch if the longest line still overflows.
    title_font = f_title
    w1 = measure(title_font, line1)[0]
    w2 = measure(title_font, line2)[0]
    avail = W - PAD * 2
    if max(w1, w2) > avail:
        title_font = f_title_sm
    draw.text((PAD, title_y), line1, font=title_font, fill=TEXT)
    line_h = measure(title_font, line1)[1] + 14
    draw.text((PAD, title_y + line_h), line2, font=title_font, fill=TEXT)

    # ---------- Role line ----------
    role_y = title_y + line_h * 2 + 18
    role_a = "ERP / OEE Developer "
    role_b = "·"
    role_c = " Full-Stack"
    x = PAD
    draw.text((x, role_y), role_a, font=f_role, fill=GRAD_A)
    x += measure(f_role, role_a)[0]
    draw.text((x, role_y), role_b, font=f_role, fill=DIM)
    x += measure(f_role, role_b)[0]
    draw.text((x, role_y), role_c, font=f_role, fill=GRAD_C)

    # ---------- Tagline pill ----------
    tag_y = role_y + 60
    pill(
        draw,
        PAD,
        tag_y,
        "UAE-based  ·  Open to relocate worldwide",
        f_tag,
        bg=(31, 122, 85, 64),
        fg=(94, 234, 212),
        stroke=(94, 234, 212, 90),
        pad_x=20,
        pad_y=10,
    )

    # ---------- Stack chips along the bottom ----------
    chips = ["Python", "FastAPI", "MongoDB", "Docker", "React", "Sage", "Linux"]
    chip_y = H - PAD - 30
    cx = PAD
    for c in chips:
        cw = pill(draw, cx, chip_y, c, f_chip, bg=(255, 255, 255, 12), fg=MUTED, stroke=(255, 255, 255, 24), pad_x=12, pad_y=7)
        cx += cw + 8
        if cx > W - PAD - 80:
            break

    # ---------- Bottom-right URL (above the chip row to avoid overlap) ----------
    url = "saadm.dev"
    uw, uh = measure(f_mono, url)
    draw.text((W - PAD - uw, H - PAD - 30 + 8), url, font=f_mono, fill=GRAD_B)

    # ---------- Save ----------
    img.convert("RGB").save(OUT, "PNG", optimize=True)
    print(f"OG image written: {OUT}  ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
