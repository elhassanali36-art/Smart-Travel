import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  it('allows up to the limit then blocks within the window', () => {
    let t = 0;
    const rl = new RateLimiter(() => t);
    for (let i = 0; i < 3; i++) expect(rl.consume('k', 3, 1000).allowed).toBe(true);
    const blocked = rl.consume('k', 3, 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBe(1);
  });
  it('reports remaining attempts', () => {
    const rl = new RateLimiter(() => 0);
    expect(rl.consume('k', 3, 1000).remaining).toBe(2);
    expect(rl.consume('k', 3, 1000).remaining).toBe(1);
  });
  it('starts a fresh window after it expires', () => {
    let t = 0;
    const rl = new RateLimiter(() => t);
    rl.consume('k', 1, 1000);
    expect(rl.consume('k', 1, 1000).allowed).toBe(false);
    t = 1000;
    expect(rl.consume('k', 1, 1000).allowed).toBe(true);
  });
  it('keeps keys independent and supports reset()', () => {
    const rl = new RateLimiter(() => 0);
    rl.consume('a', 1, 1000);
    expect(rl.consume('a', 1, 1000).allowed).toBe(false);
    expect(rl.consume('b', 1, 1000).allowed).toBe(true);
    rl.reset('a');
    expect(rl.consume('a', 1, 1000).allowed).toBe(true);
  });
  it('rounds retry-after up to whole seconds', () => {
    let t = 0;
    const rl = new RateLimiter(() => t);
    rl.consume('k', 1, 10_000);
    t = 2500;
    expect(rl.consume('k', 1, 10_000).retryAfterSec).toBe(8);
  });
  it('never grows beyond maxKeys (expired entries first, then oldest)', () => {
    let t = 0;
    const rl = new RateLimiter(() => t, 3);
    rl.consume('a', 1, 1000); rl.consume('b', 1, 1000); rl.consume('c', 1, 1000);
    rl.consume('d', 1, 1000);
    expect(rl.size).toBe(3);
    t = 5000;
    rl.consume('e', 1, 1000);
    expect(rl.size).toBe(1);
  });
});
