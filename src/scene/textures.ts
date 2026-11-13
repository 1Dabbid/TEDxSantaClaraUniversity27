import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
  type Texture,
} from 'three';
import { ENGRAVING_ROWS, ENGRAVING_SEPARATOR, type EngravingRow } from './engraving';
import { MIC, barrelRadius } from './layout';

const MONO = "ui-monospace, 'SFMono-Regular', 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace";

/** Relative row heights in the engraved band. */
const ROW_WEIGHT = { rule: 0.2, title: 1.7, label: 1.0, body: 0.62 } as const;

function placeholder(): DataTexture {
  const t = new DataTexture(new Uint8Array([0]), 1, 1, RedFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
}

export const EMPTY_MASK = placeholder();

/** Yield to the main thread (idle time when available) so the build never blocks scrolling. */
const yieldToIdle = () =>
  new Promise<void>((resolve) => {
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout: 120 });
    else setTimeout(resolve, 16);
  });

/**
 * Engraving mask atlas: 1 where metal has been laser-etched away.
 * u wraps the full barrel circumference, v runs up the engraved band.
 * Each row is drawn with a horizontal scale that compensates for the taper,
 * so letters keep their proportions on the barrel.
 *
 * Built incrementally (rows drawn in ~8 ms slices between idle callbacks) straight into a canvas that is
 * uploaded to the GPU as a single-channel (R8) texture: no pixel readback, no CPU blur. The canvas text
 * antialiasing gives the walls their slope; mipmaps are generated on the GPU.
 */
export async function createEngravingMask(width: number, height: number, rows: readonly EngravingRow[] = ENGRAVING_ROWS): Promise<Texture> {
  try {
    await document.fonts?.ready;
  } catch {
    /* ignore */
  }
  const sans = getComputedStyle(document.body).fontFamily || 'sans-serif';
  try {
    await Promise.all([document.fonts?.load(`600 64px ${sans}`), document.fonts?.load(`500 64px ${sans}`)]);
  } catch {
    /* ignore */
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return EMPTY_MASK;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.textBaseline = 'middle';

  const bandH = MIC.bandY[1] - MIC.bandY[0];
  const pxPerM = height / bandH;
  const total = rows.reduce((s, r) => s + (r.kind === 'rule' ? ROW_WEIGHT.rule : ROW_WEIGHT[r.style]), 0);
  // Leave a margin top and bottom of the band.
  const margin = height * 0.03;
  const unit = (height - margin * 2) / total;

  let yTop = margin;
  let slice = performance.now();
  for (const row of rows) {
    // Time-sliced: draw rows for ~8 ms, then give the main thread back.
    if (performance.now() - slice > 8) {
      await yieldToIdle();
      slice = performance.now();
    }
    const h = unit * (row.kind === 'rule' ? ROW_WEIGHT.rule : ROW_WEIGHT[row.style]);
    const yMid = yTop + h / 2;
    // Canvas y=0 is the top of the band (nearest the grille).
    const yMic = MIC.bandY[1] - (yMid / height) * bandH;
    const circ = 2 * Math.PI * barrelRadius(yMic);
    const sx = width / circ / pxPerM; // horizontal squeeze for this ring

    if (row.kind === 'rule') {
      ctx.fillRect(0, yMid - Math.max(1, h * 0.12), width, Math.max(2, h * 0.24));
    } else {
      const size =
        row.style === 'title' ? h * 0.62 : row.style === 'label' ? h * 0.56 : h * 0.6;
      const font =
        row.style === 'body' ? `500 ${size}px ${MONO}` : `${row.style === 'title' ? 600 : 500} ${size}px ${sans}`;
      ctx.font = font;
      const tracking = row.style === 'title' ? size * 0.18 : row.style === 'label' ? size * 0.12 : size * 0.02;
      const measure = (s: string) => ctx.measureText(s).width + tracking * s.length;
      const sep = measure(ENGRAVING_SEPARATOR);
      const avail = width / sx;
      // Fill the ring with repeated phrases, then justify.
      const items: string[] = [];
      let used = 0;
      for (let i = 0; i < 64; i++) {
        const p = row.phrases[i % row.phrases.length];
        const w = measure(p) + sep;
        if (used + w > avail && items.length >= 1) break;
        items.push(p);
        used += w;
      }
      const extra = (avail - used) / items.length;
      ctx.save();
      ctx.scale(sx, 1);
      let x = extra / 2;
      for (const p of items) {
        drawTracked(ctx, p, x, yMid, tracking);
        x += measure(p);
        // Separator
        drawTracked(ctx, ENGRAVING_SEPARATOR, x, yMid, tracking);
        x += sep + extra;
      }
      ctx.restore();
    }
    yTop += h;
  }

  const tex = new CanvasTexture(canvas);
  // Single channel on the GPU: WebGL2 uploads the canvas straight into an R8
  // texture (the browser drops G/B/A during the upload; no pixel readback here).
  // 4096 x 2048 R8 with its mip chain is ~11 MB instead of ~45 MB as RGBA8.
  tex.format = RedFormat;
  tex.internalFormat = 'R8';
  // flipY (default) puts v = 0 at the bottom of the band, like the old mask.
  tex.wrapS = RepeatWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function drawTracked(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, tracking: number) {
  if (tracking < 0.5) {
    ctx.fillText(s, x, y);
    return;
  }
  let cx = x;
  for (const ch of s) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + tracking;
  }
}
