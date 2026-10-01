import assert from 'node:assert';
import { describe, it } from 'node:test';
import { MinHash, minHash, similarity } from './minhash.js';

void describe('util/hash/minhash.ts', () => {
  void describe('similarity', () => {
    void it('catches identical self-promotion spam', () => {
      const msg1 =
        'Check out my new portfolio website! Built with React and Tailwind';
      const msg2 =
        'Check out my new portfolio website! Built with React and Tailwind';
      const actual = similarity(msg1, msg2);

      assert.strictEqual(actual, 1);
    });

    void it('catches copy-paste spam with minor punctuation differences', () => {
      const msg1 = 'hey guys check out my new website!';
      const msg2 = 'hey guys, check out my new website';
      const actual = similarity(msg1, msg2);

      // normalization strips punctuation/casing so the shingle sets are identical
      assert.strictEqual(actual, 1);
    });

    void it('stays highly similar for reordered messages', () => {
      const msg1 =
        'I just launched my SaaS app! Check it out and let me know what you think';
      const msg2 =
        'Check it out and let me know what you think! I just launched my SaaS app';
      const actual = similarity(msg1, msg2); // 0.796875

      // char shingles are not fully reorder-invariant (unlike word-set Jaccard),
      // but reordered content still scores very high
      assert.ok(actual > 0.7);
    });

    void it('resists single-character mutation evasion', () => {
      const msg1 = 'check out my new portfolio website built with react';
      const msg2 = 'check out my new portfolio websiteee built with react';
      const actual = similarity(msg1, msg2);

      assert.ok(actual > 0.8);
    });

    void it('does not flag similar but different questions', () => {
      const msg1 = 'How do I center a div in CSS?';
      const msg2 = 'How do I align a div to the right in CSS?';
      const actual = similarity(msg1, msg2); // 0.234375

      assert.ok(actual < 0.8);
    });
  });

  void describe('MinHash', () => {
    void it('estimates a similarity of 1 for a signature against itself', () => {
      const signature = minHash('duplicate spam message content');

      assert.strictEqual(signature.jaccard(signature), 1);
    });

    void it('throws when comparing signatures with different seeds', () => {
      const first = new MinHash(128, 1);
      const second = new MinHash(128, 2);

      assert.throws(() => first.jaccard(second), /different seeds/);
    });

    void it('throws when comparing signatures with different permutation counts', () => {
      const first = new MinHash(128);
      const second = new MinHash(64);

      assert.throws(
        () => first.jaccard(second),
        /different permutation counts/
      );
    });
  });
});
