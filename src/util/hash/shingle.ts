import { normalizeText } from '../text.js';

const config = {
  kVOdd: 6,
  kVEven: 6,
};

function even(num: number): boolean {
  return num % 2 === 0;
}

// how many chars to group per shingle. The finer (greater) this value is the
// more exact a duplicate must be to match.
function selectK(whole: string): number {
  return even(whole.length) ? config.kVEven : config.kVOdd;
}

// lowercase, strip punctuation/symbols and collapse whitespace so that cosmetic
// differences (casing, punctuation, spacing) do not change the shingle set
function normalize(whole: string): string {
  return normalizeText(whole).join(' ');
}

export function shingle(whole: string): string[] {
  const normalized = normalize(whole);
  return shingleByChar(normalized, selectK(normalized));
}

/* kV: number, how many chars to group together.
 * whole: string, expected to be already preprocessed and normalized.
 */
function shingleByChar(whole: string, kV: number): string[] {
  // strings at or below the window size become a single shingle so that short
  // messages still produce something to hash (empty string produces none)
  if (whole.length <= kV) {
    return whole.length > 0 ? [whole] : [];
  }

  // sliding window: step one char at a time, yielding whole.length - kV + 1 shingles
  return Array.from({ length: whole.length - kV + 1 }, (_, index) =>
    whole.slice(index, index + kV)
  );
}
