#!/usr/bin/env python3
"""Sakina logo system — generates every SVG variant from three hand-drawn vector marks.
Run: python3 brand/build-logo.py   → brand/out/svg/*.svg (+ test sheet HTML). PNG/PDF exports are made by export-logo.mjs.
No raster tools, no image generators: every file here is clean vector geometry.
"""
import os, math
OUT = os.path.join(os.path.dirname(__file__), 'out', 'svg')
os.makedirs(OUT, exist_ok=True)

EMERALD = '#174B3C'
GOLD = '#C9A24D'
IVORY = '#F7F4EC'
INK = '#111111'
WHITE = '#FFFFFF'

def star8(cx, cy, r_out, r_in):
    pts = []
    for i in range(16):
        a = math.pi / 8 * i - math.pi / 2
        r = r_out if i % 2 == 0 else r_in
        pts.append(f"{cx + r*math.cos(a):.1f},{cy + r*math.sin(a):.1f}")
    return 'M' + ' L'.join(pts) + ' Z'

# ---------- Concept 1: open book in simple geometry ----------
def mark_book(stroke, accent, sw=64):
    return f'''
  <g fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M500 360 C 420 300 300 290 170 310 L 170 720 C 300 700 420 710 500 770"/>
    <path d="M500 360 C 580 300 700 290 830 310 L 830 720 C 700 700 580 710 500 770"/>
    <path d="M500 360 L 500 770"/>
  </g>
  <path d="{star8(500, 190, 78, 32)}" fill="{accent}"/>'''

# ---------- Concept 2 (FINAL): mihrab arch + light ----------
def mark_mihrab(stroke, accent, sw=70):
    # Pointed arch open at the apex; an 8-point star sits in the opening (light entering the niche).
    # The legs stand on a wider base so the form also reads as a niche / an open book at small sizes.
    return f'''
  <g fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M 255 820 L 255 600 A 490 490 0 0 1 405 248"/>
    <path d="M 745 820 L 745 600 A 490 490 0 0 0 595 248"/>
    <path d="M 185 820 L 815 820"/>
  </g>
  <path d="{star8(500, 172, 92, 38)}" fill="{accent}"/>'''

# ---------- Concept 3: letter-based (س of سكينة — contingent on the final name) ----------
def mark_seen(stroke, accent, sw=70):
    return f'''
  <g fill="none" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">
    <path d="M 850 560 Q 810 430 770 560 Q 730 430 690 560 Q 650 430 610 560 C 610 760 380 800 290 690 C 220 600 290 480 400 500"/>
  </g>
  <circle cx="470" cy="620" r="46" fill="{accent}"/>'''

MARKS = {'1-book': mark_book, '2-mihrab': mark_mihrab, '3-seen': mark_seen}
FINAL = '2-mihrab'

def svg(body, w=1000, h=1000, bg=None):
    bgrect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{bgrect}{body}\n</svg>\n'

VARIANTS = {
    'green-gold': (EMERALD, GOLD),
    'black': (INK, INK),
    'white': (WHITE, WHITE),
    'ivory-on-emerald': (IVORY, GOLD),
}

# Wordmark: the tentative name set in Amiri Quran (OFL). If the final name changes, only this text changes.
WORD = 'سكينة'
# Outlines of the word shaped with HarfBuzz from Amiri Quran (OFL) — see brand/wordmark-path.txt (units: 1000/em, advance 2023, y up→flipped)
WORD_PATH = open(os.path.join(os.path.dirname(__file__), 'wordmark-path.txt'), encoding='utf-8').read().strip()
WORD_ADV = 2023
def wordmark(fill, x, y, size, anchor='middle'):
    """Place the outlined word with its baseline at y; x is the anchor (start=right edge in RTL)."""
    s = size / 1000
    w = WORD_ADV * s
    left = x - w / 2 if anchor == 'middle' else (x - w if anchor == 'start' else x)
    return f'<path transform="translate({left:.1f},{y}) scale({s:.4f})" d="{WORD_PATH}" fill="{fill}"/>'

def write(name, content):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        f.write(content)

# Concept sheets (3 marks, same treatment) ----------------------------------------
for key, fn in MARKS.items():
    for vname, (stroke, accent) in VARIANTS.items():
        bg = EMERALD if vname == 'ivory-on-emerald' else None
        write(f'concept-{key}-mark-{vname}.svg', svg(fn(stroke, accent), bg=bg))

# Final mark exports ------------------------------------------------------------
fn = MARKS[FINAL]
for vname, (stroke, accent) in VARIANTS.items():
    bg = EMERALD if vname == 'ivory-on-emerald' else None
    write(f'sakina-mark-{vname}.svg', svg(fn(stroke, accent), bg=bg))
    # Horizontal lockup: mark left (in LTR sense) / right of the Arabic word → in RTL the mark sits to the right of the name.
    body = f'<g transform="translate(1400,0) scale(1)">{fn(stroke, accent)}</g>' + wordmark(stroke, 1280, 640, 560, 'start')
    write(f'sakina-lockup-horizontal-{vname}.svg', svg(body, w=2400, h=1000, bg=bg))
    # Vertical lockup: mark above the word.
    body = f'<g transform="translate(250,0) scale(0.9)">{fn(stroke, accent)}</g>' + wordmark(stroke, 700, 1300, 440, 'middle')
    write(f'sakina-lockup-vertical-{vname}.svg', svg(body, w=1400, h=1500, bg=bg))

# Name placeholder lockup (for when the final name is not yet decided) ------------
body = f'<g transform="translate(1380,0)">{fn(EMERALD, GOLD)}</g><rect x="150" y="400" width="1100" height="220" rx="24" fill="none" stroke="{EMERALD}" stroke-width="6" stroke-dasharray="24 18"/><path transform="translate(450,560) scale(0.22)" d="{WORD_PATH}" fill="none" stroke="{EMERALD}" stroke-width="8" stroke-dasharray="20 14" opacity=".6"/>'
write('sakina-lockup-horizontal-name-placeholder.svg', svg(body, w=2400, h=1000))

# App icons --------------------------------------------------------------------
# iOS: 1024 square, NO rounded corners in the file (iOS applies the mask). Keep the mark inside the central 80%.
ios = f'<rect width="1024" height="1024" fill="{EMERALD}"/><g transform="translate(112,112) scale(0.8)">{fn(IVORY, GOLD, sw=76)}</g>'
write('appicon-ios-1024.svg', svg(ios, w=1024, h=1024))
# Android adaptive: 108dp canvas, safe zone = 66dp circle. Foreground layer keeps the mark inside the circle (scale 0.56 of 1000 → 560 of 1080 px at 10x).
android_fg = f'<g transform="translate(260,260) scale(0.56)">{fn(IVORY, GOLD, sw=80)}</g>'
write('appicon-android-foreground-1080.svg', svg(android_fg, w=1080, h=1080))
write('appicon-android-background-1080.svg', svg(f'<rect width="1080" height="1080" fill="{EMERALD}"/>', w=1080, h=1080))
# Maskable / PWA 512 (safe zone = inner 80%)
write('appicon-maskable-512.svg', svg(f'<rect width="512" height="512" fill="{EMERALD}"/><g transform="translate(56,56) scale(0.4)">{fn(IVORY, GOLD, sw=76)}</g>', w=512, h=512))
# Monochrome (Android themed icon / iOS tinted): single color, no background.
write('appicon-monochrome-1080.svg', svg(f'<g transform="translate(260,260) scale(0.56)">{fn(INK, INK, sw=80)}</g>', w=1080, h=1080))

# Test sheet: 24/48/64 px, mono, light & dark ------------------------------------
cells = ''
x = 40
for key in MARKS:
    for size in (24, 48, 64):
        for (bg, stroke, accent, label) in ((IVORY, EMERALD, GOLD, 'light'), ('#101C18', IVORY, GOLD, 'dark'), (IVORY, INK, INK, 'mono'), ('#101C18', WHITE, WHITE, 'mono-dark')):
            pass
rows = []
y = 40
for key, fn in MARKS.items():
    x = 40
    for (bg, stroke, accent) in ((IVORY, EMERALD, GOLD), ('#101C18', IVORY, GOLD), (IVORY, INK, INK), ('#101C18', WHITE, WHITE)):
        for size in (24, 48, 64):
            s = size / 1000
            rows.append(f'<rect x="{x-8}" y="{y-8}" width="{size+16}" height="{size+16}" fill="{bg}"/><g transform="translate({x},{y}) scale({s})">{fn(stroke, accent)}</g>')
            x += size + 36
        x += 30
    rows.append(f'<text x="40" y="{y+105}" font-family="sans-serif" font-size="16" fill="#333">concept {key} — 24 / 48 / 64 px · light · dark · mono · mono-dark</text>')
    y += 150
write('test-sheet.svg', svg(''.join(rows), w=1500, h=y, bg='#DDDDDD'))
print('wrote', len(os.listdir(OUT)), 'svg files →', OUT)
