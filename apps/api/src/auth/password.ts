import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);
const KEYLEN = 64;

// Stored format: scrypt$<saltHex>$<keyHex> (Node default scrypt cost, 16-byte random salt).
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

// Never throws on malformed stored values: returns false.
export async function verifyPassword(password: string, stored: string) {
  const [prefix, saltHex, keyHex] = stored.split('$');
  if (prefix !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== KEYLEN) return false;
  const key = (await scrypt(password, Buffer.from(saltHex, 'hex'), KEYLEN)) as Buffer;
  return timingSafeEqual(expected, key);
}

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
