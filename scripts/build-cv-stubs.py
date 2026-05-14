"""Build placeholder CV PDFs so the /cv/ download links don't 404.

Each PDF is a single-page branded "quick reference" — name, role focus,
contact, public summary, and an explicit "request the full version" line.
Replace these with real CVs whenever ready.

Output: cv/saad-{software,it,engineering}.pdf  (relative to site/)
Run:    python scripts/build-cv-stubs.py       (from the site/ directory)
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]  # site/
OUT_DIR = ROOT / "cv"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# A4 @ 150 dpi
W, H = 1240, 1754
PAD = 96
FONTS = Path("C:/Windows/Fonts")

BG = (252, 251, 247)
INK = (20, 32, 43)
INK_SOFT = (60, 70, 82)
MUTED = (107, 119, 133)
ACCENT = (31, 122, 85)
ACCENT_2 = (45, 171, 116)
GOLD = (201, 160, 73)
RULE = (215, 218, 222)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    p = FONTS / name
    if p.exists():
        return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def measure(f: ImageFont.FreeTypeFont, t: str) -> tuple[int, int]:
    b = f.getbbox(t)
    return b[2] - b[0], b[3] - b[1]


def draw_cv(variant_slug: str, role_title: str, summary: list[str], skills: list[str]) -> Path:
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)

    # Top accent bar (gradient via stripes)
    for x in range(W):
        t = x / W
        r = int(ACCENT[0] + (GOLD[0] - ACCENT[0]) * t)
        g = int(ACCENT[1] + (GOLD[1] - ACCENT[1]) * t)
        b = int(ACCENT[2] + (GOLD[2] - ACCENT[2]) * t)
        d.line([(x, 0), (x, 8)], fill=(r, g, b))

    # Fonts
    f_brand = font("consolab.ttf", 18)
    f_name = font("arialbd.ttf", 56)
    f_role = font("arial.ttf", 28)
    f_eyebrow = font("consolab.ttf", 16)
    f_h2 = font("arialbd.ttf", 22)
    f_body = font("arial.ttf", 18)
    f_meta = font("arial.ttf", 16)
    f_mono = font("consola.ttf", 16)

    y = PAD + 16
    d.text((PAD, y), "saadm.dev", font=f_brand, fill=MUTED)
    d.text((W - PAD - measure(f_brand, "Quick reference · " + variant_slug)[0], y),
           f"Quick reference · {variant_slug}", font=f_brand, fill=MUTED)

    # Name
    y += 56
    d.text((PAD, y), "Muhammad Saad", font=f_name, fill=INK)

    # Role
    y += 80
    d.text((PAD, y), role_title, font=f_role, fill=ACCENT)

    # Availability pill
    y += 50
    pill_label = "UAE-based  ·  Open to relocate worldwide"
    tw, th = measure(f_meta, pill_label)
    pad_x, pad_y = 18, 10
    d.rounded_rectangle(
        [PAD, y, PAD + tw + pad_x * 2, y + th + pad_y * 2],
        radius=999,
        fill=(31, 122, 85, 30),
        outline=ACCENT,
        width=1,
    )
    d.text((PAD + pad_x, y + pad_y - 1), pill_label, font=f_meta, fill=ACCENT)

    # Rule
    y += 60
    d.line([(PAD, y), (W - PAD, y)], fill=RULE, width=1)

    # Two-column grid: left = summary, right = contact
    y += 28
    left_x = PAD
    right_x = W - PAD - 380
    col_y = y

    # ---- Left: Summary + Skills ----
    d.text((left_x, col_y), "● PROFILE", font=f_eyebrow, fill=ACCENT)
    col_y += 30
    for line in summary:
        d.text((left_x, col_y), line, font=f_body, fill=INK_SOFT)
        col_y += 28

    col_y += 16
    d.text((left_x, col_y), "● CORE SKILLS", font=f_eyebrow, fill=ACCENT)
    col_y += 30
    # render skills as chip rows
    chip_x = left_x
    chip_y = col_y
    chip_pad_x, chip_pad_y = 12, 6
    for sk in skills:
        sw, sh = measure(f_mono, sk)
        cw = sw + chip_pad_x * 2
        if chip_x + cw > W - PAD - 400:
            chip_x = left_x
            chip_y += sh + chip_pad_y * 2 + 8
        d.rounded_rectangle(
            [chip_x, chip_y, chip_x + cw, chip_y + sh + chip_pad_y * 2],
            radius=8, fill=(31, 122, 85, 18), outline=RULE, width=1,
        )
        d.text((chip_x + chip_pad_x, chip_y + chip_pad_y - 1), sk, font=f_mono, fill=ACCENT)
        chip_x += cw + 8

    # ---- Right: Contact + Current role + Education ----
    d.text((right_x, y), "● CONTACT", font=f_eyebrow, fill=ACCENT)
    cy = y + 30
    rows = [
        ("Email",    "saad@saadm.dev"),
        ("Web",      "saadm.dev"),
        ("LinkedIn", "linkedin.com/in/muhammadsaad435"),
        ("GitHub",   "github.com/saad-mughal435"),
        ("Phone",    "+971 50 257 8065"),
    ]
    for k, v in rows:
        d.text((right_x, cy), k, font=f_meta, fill=MUTED)
        d.text((right_x + 90, cy), v, font=f_meta, fill=INK_SOFT)
        cy += 26

    cy += 14
    d.text((right_x, cy), "● CURRENT ROLE", font=f_eyebrow, fill=ACCENT)
    cy += 30
    d.text((right_x, cy), "Automation Engineer · ERP Developer", font=f_body, fill=INK)
    cy += 26
    d.text((right_x, cy), "IT Administrator", font=f_body, fill=INK)
    cy += 26
    d.text((right_x, cy), "Kingsley Beverage FZCO · Dubai", font=f_meta, fill=MUTED)
    cy += 22
    d.text((right_x, cy), "2024 – present", font=f_mono, fill=MUTED)

    cy += 30
    d.text((right_x, cy), "● EDUCATION", font=f_eyebrow, fill=ACCENT)
    cy += 30
    d.text((right_x, cy), "B.Sc. Electrical Engineering", font=f_body, fill=INK)
    cy += 26
    d.text((right_x, cy), "Computer Engineering major", font=f_body, fill=INK)
    cy += 26
    d.text((right_x, cy), "COMSATS University Islamabad", font=f_meta, fill=MUTED)

    # Footer note
    note = "This is a public quick-reference. Full CV with detailed experience available on request — email saad@saadm.dev."
    f_note_y = H - PAD - 60
    d.line([(PAD, f_note_y - 14), (W - PAD, f_note_y - 14)], fill=RULE, width=1)
    d.text((PAD, f_note_y), note, font=f_meta, fill=MUTED)
    d.text((PAD, f_note_y + 24), "Generated 2026-05-14 · saadm.dev", font=f_mono, fill=MUTED)

    out = OUT_DIR / f"saad-{variant_slug}.pdf"
    img.save(out, "PDF", resolution=150.0)
    return out


def main() -> None:
    variants = {
        "software": (
            "Software / Programming",
            [
                "Builds production software end-to-end: Python, FastAPI, MongoDB,",
                "SQL Server, React, vanilla JS. Owns the stack from database",
                "to deployment.",
                "Sole developer of a real MES/ERP/OEE platform replacing Excel and",
                "paper workflows for an automated beverage plant.",
            ],
            ["Python", "FastAPI", "MongoDB", "SQL Server", "React", "JavaScript",
             "Docker", "Nginx", "Linux", "Git", "OpenAI", "pandas", "openpyxl",
             "pyodbc", "fpdf", "REST", "JWT"],
        ),
        "it": (
            "IT / Infrastructure / Operations",
            [
                "Runs production infrastructure for a manufacturing site: SQL Server,",
                "MongoDB, Linux, Docker, Nginx, Cloudflare, SSL/Let's-Encrypt,",
                "cron-based automation.",
                "Prior network engineering experience with PSTN and GPON.",
                "Hands-on with Krones production-line systems and utilities.",
            ],
            ["Linux", "Docker", "nginx", "Cloudflare", "SQL Server", "MongoDB",
             "Bash", "PowerShell", "Git", "GitHub Actions", "Let's Encrypt",
             "GPON", "PSTN", "Networking", "DevOps", "Monitoring"],
        ),
        "engineering": (
            "Engineering / Industrial / Automation",
            [
                "Electrical & Automation Engineer with hands-on production-floor",
                "experience: Krones beverage lines (blow-molder, filler, inspector,",
                "shrink-pack, palletiser).",
                "Builds the digital systems that operate alongside the machines:",
                "OEE monitoring, QC seam-check, batch tracking, downtime reports.",
                "Power-plant / utilities exposure during prior tenure.",
            ],
            ["Krones lines", "Blow-molder", "Filler", "Variopac", "Palletiser",
             "PLC concepts", "RCA", "OEE", "QC seam-check", "Batch tracking",
             "Production planning", "Utilities", "MV/LV", "Electrical safety",
             "Industrial automation"],
        ),
    }

    for slug, (role, summary, skills) in variants.items():
        out = draw_cv(slug, role, summary, skills)
        size_kb = out.stat().st_size // 1024
        print(f"  [ok] {out.name}  ({size_kb} KB)")


if __name__ == "__main__":
    main()
