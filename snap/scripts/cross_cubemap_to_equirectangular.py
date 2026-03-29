"""
cross_cubemap_to_equirectangular.py — Ayana Teleport Me Lens

Converts horizontal-cross cubemap PNGs (from generate_cubemaps.py) into
equirectangular 2:1 panoramas. These map cleanly onto a sphere in Lens Studio
with a simple unlit / equirect material when cubemap assets are awkward.

INPUT LAYOUT (horizontal cross):
         [  TOP  ]
  [LEFT][FRONT][RIGHT][BACK]
         [BOTTOM]

USAGE:
    cd snap/scripts
    pip install Pillow numpy
    python cross_cubemap_to_equirectangular.py
    python cross_cubemap_to_equirectangular.py ../assets/cubemaps/eiffeltower_s0.png

OUTPUT:
    ../assets/equirect/{same_basename}.png

Default output size: 2048×1536 (4:3) for the Ayana sphere workflow in Lens Studio.
Classic 2:1 equirectangular is still supported when explicitly requested.

ENV:
    EQUIRECT_WIDTH=2048 EQUIRECT_HEIGHT=1536   # both optional; any explicit pair is honored as-is
    EQUIRECT_WIDTH=2048 only → height = width×3/4 (keeps 4:3)
    EQUIRECT_HEIGHT=1536 only → width = height×4/3
Higher res: set both, e.g. EQUIRECT_WIDTH=4096 EQUIRECT_HEIGHT=2048
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

try:
    import numpy as np
except ImportError:
    print("numpy required. Run: pip install numpy")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Pillow required. Run: pip install Pillow")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_DIR = SCRIPT_DIR.parent / "assets" / "cubemaps"
DEFAULT_OUTPUT_DIR = SCRIPT_DIR.parent / "assets" / "equirect"

# Default panorama resolution (4:3). Maps full longitude × latitude; classic 2:1 is optional.
DEFAULT_OUT_W = 2048
DEFAULT_OUT_H = 1536  # 4:3 ratio — matches Ayana Lens Studio sphere workflow


def extract_faces_cross(img: np.ndarray) -> dict[str, np.ndarray]:
    """img: (H, W, C) uint8. Returns six (F,F,C) arrays keyed by face name."""
    h, w = img.shape[0], img.shape[1]
    if w % 4 != 0 or h % 3 != 0:
        raise ValueError(f"Expected width divisible by 4 and height by 3, got {w}×{h}")
    f = w // 4
    if h != 3 * f:
        raise ValueError(f"Expected height == 3×face, got h={h}, face={f}")

    return {
        "top": img[0:f, f : 2 * f].copy(),
        "left": img[f : 2 * f, 0:f].copy(),
        "front": img[f : 2 * f, f : 2 * f].copy(),
        "right": img[f : 2 * f, 2 * f : 3 * f].copy(),
        "back": img[f : 2 * f, 3 * f : 4 * f].copy(),
        "bottom": img[2 * f : 3 * f, f : 2 * f].copy(),
    }


def bilinear_batch(face: np.ndarray, u: np.ndarray, v: np.ndarray) -> np.ndarray:
    """Bilinear sample face (F,F,C) at u,v in [0,1], arrays same shape."""
    f_sz = face.shape[0]
    if f_sz < 2:
        return np.broadcast_to(face[0, 0], u.shape + (face.shape[2],))

    uu = np.clip(u.astype(np.float64), 0.0, 1.0) * (f_sz - 1)
    vv = np.clip(v.astype(np.float64), 0.0, 1.0) * (f_sz - 1)
    x0 = np.floor(uu).astype(np.int32)
    y0 = np.floor(vv).astype(np.int32)
    x1 = np.minimum(x0 + 1, f_sz - 1)
    y1 = np.minimum(y0 + 1, f_sz - 1)
    tx = (uu - x0)[..., None]
    ty = (vv - y0)[..., None]
    c00 = face[y0, x0].astype(np.float32)
    c10 = face[y0, x1].astype(np.float32)
    c01 = face[y1, x0].astype(np.float32)
    c11 = face[y1, x1].astype(np.float32)
    a = c00 * (1.0 - tx) + c10 * tx
    b = c01 * (1.0 - tx) + c11 * tx
    return (a * (1.0 - ty) + b * ty).clip(0, 255).astype(np.uint8)


def cross_to_equirect(
    img_rgb: np.ndarray,
    out_w: int,
    out_h: int,
) -> np.ndarray:
    faces = extract_faces_cross(img_rgb)
    out = np.zeros((out_h, out_w, img_rgb.shape[2]), dtype=np.uint8)

    xs = (np.arange(out_w, dtype=np.float64) + 0.5) / out_w
    ys = (np.arange(out_h, dtype=np.float64) + 0.5) / out_h
    lam = 2.0 * np.pi * xs - np.pi
    phi = 0.5 * np.pi - np.pi * ys[:, None]

    cos_phi = np.cos(phi)
    sin_phi = np.sin(phi)
    sin_lam = np.sin(lam)
    cos_lam = np.cos(lam)

    dx = cos_phi * sin_lam
    dy = sin_phi
    dz = cos_phi * cos_lam

    ax = np.abs(dx)
    ay = np.abs(dy)
    az = np.abs(dz)

    m_x = (ax >= ay) & (ax >= az)
    m_y = ~m_x & (ay >= az)
    m_z = ~m_x & ~(ay >= az)

    m_right = m_x & (dx > 0.0)
    m_left = m_x & (dx <= 0.0)
    m_top = m_y & (dy > 0.0)
    m_bottom = m_y & (dy <= 0.0)
    m_front = m_z & (dz > 0.0)
    m_back = m_z & (dz <= 0.0)

    u = np.zeros((out_h, out_w), dtype=np.float64)
    v = np.zeros((out_h, out_w), dtype=np.float64)

    with np.errstate(divide="ignore", invalid="ignore"):
        u = np.where(m_right, (-dz / ax + 1.0) * 0.5, u)
        v = np.where(m_right, (-dy / ax + 1.0) * 0.5, v)
        u = np.where(m_left, (dz / ax + 1.0) * 0.5, u)
        v = np.where(m_left, (-dy / ax + 1.0) * 0.5, v)
        u = np.where(m_top, (dx / ay + 1.0) * 0.5, u)
        v = np.where(m_top, (dz / ay + 1.0) * 0.5, v)
        u = np.where(m_bottom, (dx / ay + 1.0) * 0.5, u)
        v = np.where(m_bottom, (-dz / ay + 1.0) * 0.5, v)
        u = np.where(m_front, (dx / az + 1.0) * 0.5, u)
        v = np.where(m_front, (-dy / az + 1.0) * 0.5, v)
        u = np.where(m_back, (-dx / az + 1.0) * 0.5, u)
        v = np.where(m_back, (-dy / az + 1.0) * 0.5, v)

    for name, mask in (
        ("right", m_right),
        ("left", m_left),
        ("top", m_top),
        ("bottom", m_bottom),
        ("front", m_front),
        ("back", m_back),
    ):
        if not np.any(mask):
            continue
        sampled = bilinear_batch(faces[name], u, v)
        for c in range(out.shape[2]):
            out[..., c] = np.where(mask, sampled[..., c], out[..., c])

    return out


def convert_file(src: Path, dst: Path, out_w: int, out_h: int) -> None:
    pil = Image.open(src).convert("RGB")
    arr = np.asarray(pil)
    eq = cross_to_equirect(arr, out_w, out_h)
    dst.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(eq).save(dst, "PNG", optimize=True)
    print(f"  {src.name}  →  {dst}  ({out_w}×{out_h})")


def resolve_output_size(env_w: str, env_h: str) -> tuple[int, int]:
    """
    Output dimensions for the latitude/longitude panorama grid.
    - Neither env → DEFAULT_OUT_W × DEFAULT_OUT_H (2048×1536, 4:3)
    - Both set → exact sizes (no forced aspect)
    - Only width → height = width * 3/4 (keeps 4:3)
    - Only height → width = height * 4/3
    """
    if not env_w and not env_h:
        return DEFAULT_OUT_W, DEFAULT_OUT_H
    if env_w and env_h:
        return int(env_w), int(env_h)
    if env_w:
        w = int(env_w)
        h = max(2, int(round(w * 3 / 4)))
        return w, h
    h = int(env_h)
    w = max(2, int(round(h * 4 / 3)))
    return w, h


def main() -> None:
    argv = [a for a in sys.argv[1:] if not a.startswith("-")]
    env_w = os.environ.get("EQUIRECT_WIDTH", "").strip()
    env_h = os.environ.get("EQUIRECT_HEIGHT", "").strip()

    if argv:
        paths = [Path(p).resolve() for p in argv]
    else:
        paths = sorted(DEFAULT_INPUT_DIR.glob("*_s[012].png"))
        if not paths:
            print(f"No cubemap PNGs in {DEFAULT_INPUT_DIR}")
            sys.exit(1)

    out_w, out_h = resolve_output_size(env_w, env_h)

    print("Cross cubemap → equirectangular")
    print(f"Output size: {out_w}×{out_h}")
    print(f"Output dir:  {DEFAULT_OUTPUT_DIR}\n")

    for p in paths:
        if not p.is_file():
            print(f"Skip missing: {p}")
            continue
        dst = DEFAULT_OUTPUT_DIR / p.name
        convert_file(p, dst, out_w, out_h)

    print("\nLens Studio: import PNG as Texture (2D), sphere + Unlit material,")
    print("  assign this texture; use an equirectangular/sphere UV material if available.")


if __name__ == "__main__":
    main()
