const crypto = require('crypto');
const asyncHandler = require('./asyncHandler');

const ok = (res, data, meta) => {
  if (meta !== undefined) {
    return res.status(200).json({ success: true, data, items: data, meta });
  }
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return res.status(200).json({ success: true, ...data });
  }
  return res.status(200).json({ success: true, data });
};

const isId = (v) => /^[a-f\d]{24}$/i.test(String(v || ''));

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const pick = (obj, keys) =>
  keys.reduce((acc, k) => {
    if (obj && obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

const sha256 = (str) => crypto.createHash('sha256').update(String(str || '')).digest('hex');

module.exports = {
  asyncHandler,
  ok,
  isId,
  escapeRegex,
  pick,
  pct,
  sha256,
};
