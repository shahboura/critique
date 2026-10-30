type TextMotionUnit = 'character' | 'run' | 'word' | 'value';
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function segments(value: string, by: TextMotionUnit = 'character'): string[] {
  // Editable numbers need the exact same shaping as their native input,
  // including currency spaces and locale-specific separators.
  if (by === 'value') return value ? [value] : [];
  const parts =
    by === 'word'
      ? (value.match(/\S+|\s+/gu) ?? [])
      : [...graphemes.segment(value)].map(({ segment }) => segment);
  return parts.map((part) => part.replaceAll(' ', '\u00a0'));
}

export { segments };
export type { TextMotionUnit };
