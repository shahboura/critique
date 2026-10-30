/** Resolved once per glyph/treatment, never rewritten on the frame clock. */
function rollAccent(color: string, x: number, width: number): string {
  return color === 'rainbow'
    ? `hsl(${260 - 280 * Math.max(0, Math.min(1, width > 0 ? x / width : 0))} 85% 55%)`
    : color;
}

/** Retargeting keeps the appearance clock and therefore the tint continuous. */
function tintAmount(color: string | undefined, opacity: number): number {
  return color ? 1 - Math.max(0, Math.min(1, opacity)) ** 6 : 0;
}

export { rollAccent, tintAmount };
