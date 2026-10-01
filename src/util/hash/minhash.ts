import { shingle } from './shingle.js';

// Inspired source
// https://github.com/duhaime/minhash/tree/master

export class MinHash {
  // prime is the smallest prime larger than the largest
  // possible hash value (max hash = 32 bit int)
  private readonly prime = 4294967311;
  private readonly maxHash = Math.pow(2, 32) - 1;

  private numPerm: number = 128;
  private seed: number = 1;
  private hashvalues: number[] = [];
  private permA: number[] = [];
  private permB: number[] = [];

  constructor(numPerm: number = 128, seed: number = 1) {
    this.numPerm = numPerm;
    this.seed = seed;
    this.hashvalues = this.initHashValues();
    this.initPermutations();
  }

  // seeded PRNG so two MinHashes built with the same seed share the same
  // permutation family and are therefore comparable
  private randInt(): number {
    const x = Math.sin(this.seed++) * this.maxHash;
    return Math.floor((x - Math.floor(x)) * this.maxHash);
  }

  // every slot starts at the max so the first real hash always wins the min
  private initHashValues(): number[] {
    return new Array<number>(this.numPerm).fill(this.maxHash);
  }

  // precompute the two coefficients of each affine permutation h(x) = a*x + b.
  // `a` must be non-zero to keep the permutation a bijection.
  private initPermutations(): void {
    for (let i = 0; i < this.numPerm; i++) {
      this.permA[i] = this.randInt() || 1;
      this.permB[i] = this.randInt();
    }
  }

  // 32-bit djb2-style string hash, coerced to an unsigned int
  private hash(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (Math.imul(hash, 31) + token.charCodeAt(i)) | 0;
    }
    return hash >>> 0;
  }

  // fold a single shingle into the signature, keeping the running per-permutation
  // minimum. Note: a*hashValue can exceed Number.MAX_SAFE_INTEGER so the modulo is
  // approximate, but it is deterministic, which is all the Jaccard estimate needs.
  update(token: string): void {
    const hashValue = this.hash(token);
    for (let i = 0; i < this.numPerm; i++) {
      const permuted = (this.permA[i] * hashValue + this.permB[i]) % this.prime;
      if (permuted < this.hashvalues[i]) {
        this.hashvalues[i] = permuted;
      }
    }
  }

  // estimated Jaccard similarity = fraction of matching signature slots
  jaccard(other: MinHash): number {
    if (this.numPerm !== other.numPerm) {
      throw new Error(
        'Cannot compare MinHashes with different permutation counts'
      );
    }
    if (this.seed !== other.seed) {
      throw new Error('Cannot compare MinHashes created with different seeds');
    }

    let shared = 0;
    for (let i = 0; i < this.numPerm; i++) {
      if (this.hashvalues[i] === other.hashvalues[i]) {
        shared++;
      }
    }
    return shared / this.numPerm;
  }

  get signature(): readonly number[] {
    return this.hashvalues;
  }
}

// Build a populated MinHash signature for a piece of (normalized) text.
export function minHash(input: string): MinHash {
  const shingles: string[] = shingle(input);
  const mh = new MinHash();
  shingles.forEach((sh) => mh.update(sh));
  return mh;
}

// Convenience: estimated Jaccard similarity between two raw strings.
export function similarity(textA: string, textB: string): number {
  return minHash(textA).jaccard(minHash(textB));
}
