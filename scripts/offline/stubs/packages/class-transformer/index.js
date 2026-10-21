// Offline stub: every export is a decorator factory that returns a no-op decorator.
module.exports = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : () => () => undefined) });
