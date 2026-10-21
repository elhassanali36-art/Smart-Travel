const c = require('node:crypto');
const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
const secs = (s) => { const m = /^(\d+)([smhd])$/.exec(s); return Number(m[1]) * { s: 1, m: 60, h: 3600, d: 86400 }[m[2]]; };
class SignJWT {
  constructor(p) { this.p = { ...p }; }
  setProtectedHeader(h) { this.h = h; return this; }
  setIssuer(v) { this.p.iss = v; return this; }
  setAudience(v) { this.p.aud = v; return this; }
  setIssuedAt() { this.p.iat = Math.floor(Date.now() / 1000); return this; }
  setExpirationTime(v) { this.p.exp = this.p.iat + secs(v); return this; }
  async sign(key) { const d = `${b64(this.h)}.${b64(this.p)}`; return `${d}.${c.createHmac('sha256', key).update(d).digest('base64url')}`; }
}
async function jwtVerify(token, key, o) {
  const [h, p, s] = token.split('.');
  if (!s) throw new Error('malformed');
  const hdr = JSON.parse(Buffer.from(h, 'base64url').toString());
  if (!o.algorithms.includes(hdr.alg)) throw new Error('alg');
  const exp = c.createHmac('sha256', key).update(`${h}.${p}`).digest();
  const got = Buffer.from(s, 'base64url');
  if (got.length !== exp.length || !c.timingSafeEqual(got, exp)) throw new Error('sig');
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  if (payload.iss !== o.issuer || payload.aud !== o.audience || payload.exp <= Date.now() / 1000) throw new Error('claims');
  return { payload };
}
module.exports = { SignJWT, jwtVerify };
