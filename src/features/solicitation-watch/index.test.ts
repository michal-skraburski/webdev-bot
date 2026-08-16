import assert from 'node:assert';
import { describe, it } from 'node:test';
import { detectSolicitation } from './index.js';

void describe('detectSolicitation', () => {
  const flagged: Array<[string, string]> = [
    ['can anyone check out my website?', 'self-promotion'],
    [
      'pls take a look at my new portfolio',
      'promo without explicit noun after "my"',
    ],
    ['check out my youtube channel', 'promo without opener'],
    ['sub to my channel', 'subscribe shorthand'],
    ['who is looking for a developer', 'recruiting question'],
    ['anyone need a designer?', 'recruiting need'],
    ['looking for clients for my agency', 'recruiting for clients'],
    ['i can help you, dm me', 'service offer + dm'],
    ['message me if interested', 'dm solicitation'],
  ];

  for (const [text, why] of flagged) {
    void it(`flags: "${text}" (${why})`, () => {
      assert.notStrictEqual(detectSolicitation(text), null);
    });
  }

  const allowed = [
    'hey everyone, how do I center a div?',
    'my website keeps throwing a 500 error, any idea why?',
    'I am reading the MDN docs on flexbox',
    'does anyone know a good article about closures?',
    'good morning all',
  ];

  for (const text of allowed) {
    void it(`ignores: "${text}"`, () => {
      assert.strictEqual(detectSolicitation(text), null);
    });
  }
});
