import { hashOpaqueToken, hashPassword, verifyPassword } from './password';

describe('password hashing (scrypt)', () => {
  it('never stores the plaintext and uses the documented format', async () => {
    const h = await hashPassword('Correct-Horse-9');
    expect(h).not.toContain('Correct-Horse-9');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(h.split('$')).toHaveLength(3);
  });
  it('verifies the right password and rejects wrong ones', async () => {
    const h = await hashPassword('Correct-Horse-9');
    expect(await verifyPassword('Correct-Horse-9', h)).toBe(true);
    expect(await verifyPassword('correct-horse-9', h)).toBe(false);
    expect(await verifyPassword('', h)).toBe(false);
  });
  it('uses a fresh random salt for every hash', async () => {
    const a = await hashPassword('Same-Password-1');
    const b = await hashPassword('Same-Password-1');
    expect(a).not.toBe(b);
    expect(await verifyPassword('Same-Password-1', a)).toBe(true);
    expect(await verifyPassword('Same-Password-1', b)).toBe(true);
  });
  it('returns false (never throws) for malformed stored values', async () => {
    for (const bad of ['', 'plaintext', 'scrypt$', 'scrypt$aa$', 'md5$aa$bb', 'scrypt$zz$00', 'scrypt$aabb$ccdd']) expect(await verifyPassword('x', bad)).toBe(false);
  });
  it('hashes opaque tokens deterministically with SHA-256', () => {
    expect(hashOpaqueToken('abc')).toBe(hashOpaqueToken('abc'));
    expect(hashOpaqueToken('abc')).toHaveLength(64);
    expect(hashOpaqueToken('abc')).not.toBe(hashOpaqueToken('abd'));
    expect(hashOpaqueToken('abc')).not.toContain('abc');
  });
});
