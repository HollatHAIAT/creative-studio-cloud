export type Box = { x: number; y: number; w: number; h: number };

/**
 * Largest crop of aspect `ratio` (w/h, in pixels) inside an image of `imgW`x`imgH`,
 * centred on the focal point and shifted to keep the subject box inside when possible.
 * Returns fractions of the image plus whether the subject fully fits.
 */
export function recommendCrop(imgW: number, imgH: number, ratio: number, focal: { x: number; y: number }, subject: Box): { crop: Box; fits: boolean } {
  let cw = imgW, ch = imgW / ratio;
  if (ch > imgH) { ch = imgH; cw = imgH * ratio; }
  const w = cw / imgW, h = ch / imgH;
  const place = (center: number, size: number, sStart: number, sSize: number) => {
    let start = center - size / 2;
    if (sSize <= size) { start = Math.min(start, sStart); start = Math.max(start, sStart + sSize - size); }
    return Math.min(Math.max(start, 0), 1 - size);
  };
  const x = place(focal.x, w, subject.x, subject.w);
  const y = place(focal.y, h, subject.y, subject.h);
  const eps = 0.005;
  const fits = subject.x >= x - eps && subject.y >= y - eps && subject.x + subject.w <= x + w + eps && subject.y + subject.h <= y + h + eps;
  return { crop: { x, y, w, h }, fits };
}

export const RATIOS = { "4:5": 4 / 5, "1:1": 1, "9:16": 9 / 16, "3:4": 3 / 4 } as const;
export type RatioKey = keyof typeof RATIOS;
