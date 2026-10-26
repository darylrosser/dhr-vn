# Small textures drawn at build time (Pillow): keycap legends, the desk mat,
# handwritten notes. Written to blender/out/ (not committed; the packed GLB
# carries them).

import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from lib import OUT

MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
MONO_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf'
HAND = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'


def _font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


def _save(img, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name)
    img.save(path)
    return path


# A 60% board: (label, width in key units) per row. Accent keys get colour.
KB_ROWS = [
    [('ESC', 1), ('1', 1), ('2', 1), ('3', 1), ('4', 1), ('5', 1), ('6', 1), ('7', 1), ('8', 1), ('9', 1), ('0', 1), ('-', 1), ('=', 1), ('BKSP', 2)],
    [('TAB', 1.5), ('Q', 1), ('W', 1), ('E', 1), ('R', 1), ('T', 1), ('Y', 1), ('U', 1), ('I', 1), ('O', 1), ('P', 1), ('[', 1), (']', 1), ('\\', 1.5)],
    [('CAPS', 1.75), ('A', 1), ('S', 1), ('D', 1), ('F', 1), ('G', 1), ('H', 1), ('J', 1), ('K', 1), ('L', 1), (';', 1), ("'", 1), ('ENTER', 2.25)],
    [('SHIFT', 2.25), ('Z', 1), ('X', 1), ('C', 1), ('V', 1), ('B', 1), ('N', 1), ('M', 1), (',', 1), ('.', 1), ('/', 1), ('SHIFT', 2.75)],
    [('CTRL', 1.25), ('◆', 1.25), ('ALT', 1.25), ('', 6.25), ('ALT', 1.25), ('FN', 1.25), ('▤', 1.25), ('CTRL', 1.25)],
]
KB_ACCENT = {'ESC': ('#e8a33a', '#1a1208'), 'ENTER': ('#e8a33a', '#1a1208'), '': ('#2a9d96', '#0a1c1b')}


def keyboard_layout(unit):
    """Keys as (label, x centre, z centre, width, depth) in metres, the board
    centred on 0 (x to the right, z towards you), plus its (width, depth)."""
    keys = []
    W, D = 15 * unit, len(KB_ROWS) * unit
    for r, row in enumerate(KB_ROWS):
        x = -W / 2
        for label, w in row:
            keys.append((label, x + w * unit / 2, -D / 2 + (r + 0.5) * unit, w * unit, unit))
            x += w * unit
    return keys, (W, D)


def keyboard_texture(unit, px_per_unit=96):
    """The keycap atlas: every key drawn where it sits on the board (worn
    dark grey caps, cream legends, a couple of accent caps)."""
    keys, (W, D) = keyboard_layout(unit)
    s = px_per_unit / unit
    img = Image.new('RGB', (round(W * s), round(D * s)), '#2b2a28')
    d = ImageDraw.Draw(img)
    f_big = _font(MONO_BOLD, int(px_per_unit * 0.34))
    f_small = _font(MONO_BOLD, int(px_per_unit * 0.2))
    for label, x, zc, w, dep in keys:
        x0, y0 = (x - w / 2 + W / 2) * s, (zc - dep / 2 + D / 2) * s
        x1, y1 = x0 + w * s, y0 + dep * s
        cap, ink = KB_ACCENT.get(label, ('#33312e', '#d8cdb4'))
        d.rectangle([x0, y0, x1, y1], fill=cap)
        # the dished top, lighter in the middle; the shine worn into WASD and space
        d.rounded_rectangle([x0 + 6, y0 + 5, x1 - 6, y1 - 9], radius=8, fill=_shade(cap, 1.12))
        if label in ('W', 'A', 'S', 'D', ''):
            d.rounded_rectangle([x0 + 14, y0 + 12, x1 - 14, y1 - 18], radius=10, fill=_shade(cap, 1.22))
        f = f_big if len(label) == 1 else f_small
        d.text((x0 + 14, y0 + 10), label, font=f, fill=ink)
    return _save(img.filter(ImageFilter.GaussianBlur(0.6)), 'kb_keys.png')


def _shade(hex_color, k):
    r, g, b = (int(hex_color[i:i + 2], 16) for i in (1, 3, 5))
    return '#%02x%02x%02x' % tuple(min(255, int(c * k)) for c in (r, g, b))


def desk_mat():
    """A big cloth desk mat: dark, a faint circuit-trace print, frayed by use."""
    W, H = 1024, 456
    img = Image.new('RGB', (W, H), '#17191c')
    d = ImageDraw.Draw(img)
    import random
    r = random.Random(7)
    for _ in range(70):  # traces
        x, y = r.randrange(W), r.randrange(H)
        col = '#22343a' if r.random() < 0.7 else '#3a2e1a'
        for _ in range(r.randrange(2, 5)):
            if r.random() < 0.5:
                nx, ny = x + r.choice((-1, 1)) * r.randrange(30, 160), y
            else:
                step = r.randrange(20, 90) * r.choice((-1, 1))
                nx, ny = x + step, y + step
            d.line([x, y, nx, ny], fill=col, width=3)
            x, y = nx, ny
        d.ellipse([x - 6, y - 6, x + 6, y + 6], outline=col, width=3)
    d.text((W - 230, H - 52), 'DHR // WORKSHOP', font=_font(MONO_BOLD, 26), fill='#2a3c40')
    d.rectangle([4, 4, W - 5, H - 5], outline='#0c0d0f', width=6)  # stitched edge
    # wear: a lighter patch where the wrists rest, a coffee ring
    wear = Image.new('L', (W, H), 0)
    ImageDraw.Draw(wear).ellipse([W * 0.25, H * 0.62, W * 0.75, H * 1.15], fill=40)
    img = Image.composite(Image.new('RGB', (W, H), '#2a2c30'), img, wear.filter(ImageFilter.GaussianBlur(60)))
    d = ImageDraw.Draw(img)
    d.ellipse([W * 0.83, H * 0.16, W * 0.83 + 74, H * 0.16 + 74], outline='#2b2014', width=5)
    return _save(img, 'desk_mat.png')


def note(name, lines, paper='#e9e2cf', ink='#1d2c66', ruled=True, size=(512, 700), font_size=40):
    """A page of handwriting (or a sticky note)."""
    W, H = size
    img = Image.new('RGB', (W, H), paper)
    d = ImageDraw.Draw(img)
    if ruled:
        for y in range(110, H, 46):
            d.line([0, y, W, y], fill='#a9c0d6', width=2)
        d.line([70, 0, 70, H], fill='#d99a9a', width=2)
    f = _font(HAND, font_size)
    y = 64 if ruled else 40
    for ln in lines:
        strike = ln.startswith('~')
        text = ln.lstrip('~')
        d.text((84 if ruled else 30, y), text, font=f, fill=ink)
        if strike:
            w = d.textlength(text, font=f)
            d.line([84 if ruled else 30, y + font_size * 0.6, (84 if ruled else 30) + w, y + font_size * 0.55], fill=ink, width=4)
        y += 46 if ruled else font_size + 14
    return _save(img.filter(ImageFilter.GaussianBlur(0.5)), f'{name}.png')


def pegboard():
    """Brown hardboard full of holes, outlines drawn where the tools hang."""
    W, H = 1024, 556
    img = Image.new('RGB', (W, H), '#7a5a3a')
    d = ImageDraw.Draw(img)
    import random
    r = random.Random(3)
    for _ in range(4000):  # grain and grime
        x, y = r.randrange(W), r.randrange(H)
        d.point((x, y), fill='#6a4c30' if r.random() < 0.6 else '#8a6a48')
    for y in range(14, H, 28):
        for x in range(14, W, 28):
            d.ellipse([x - 4, y - 4, x + 4, y + 4], fill='#1e140c')
    d.rectangle([2, 2, W - 3, H - 3], outline='#3a2818', width=6)
    return _save(img.filter(ImageFilter.GaussianBlur(0.6)), 'pegboard.png')
