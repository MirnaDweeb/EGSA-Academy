const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Token missing.' });
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (tokenErr) {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Invalid or expired access token.',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    // Account state enforcement
    if (user.accountStatus === 'suspended' || user.accountStatus === 'disabled') {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DEACTIVATED',
        message: 'Account is deactivated or suspended. Please contact EGSA administration.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Authentication failure.' });
  }
}

function authorize(...roles) {
  const allowed = new Set();
  roles.forEach((r) => {
    if (!r) return;
    const str = String(r).trim();
    allowed.add(str);
    allowed.add(str.toLowerCase());
    allowed.add(str.toUpperCase());
    if (
      str.toUpperCase() === 'SUPER_ADMIN' ||
      str.toUpperCase() === 'ADMIN' ||
      str.toUpperCase() === 'PRE_UNIVERSITY_ADMIN' ||
      str.toUpperCase() === 'UNIVERSITY_ADMIN'
    ) {
      allowed.add('admin');
      allowed.add('ADMIN');
      allowed.add('SUPER_ADMIN');
      allowed.add('super_admin');
      allowed.add('superadmin');
    }
  });

  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role authorization.' });
    }
    const userRole = String(req.user.role || '').trim();
    if (
      !allowed.has(userRole) &&
      !allowed.has(userRole.toLowerCase()) &&
      !allowed.has(userRole.toUpperCase())
    ) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role authorization.' });
    }
    next();
  };
}

function requireApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const configuredKey = process.env.INTEGRATION_API_KEY || 'egsa_integration_secret_2026';
  if (!apiKey || apiKey !== configuredKey) {
    if (process.env.NODE_ENV === 'development' && !process.env.INTEGRATION_API_KEY) {
      return next();
    }
    return res.status(401).json({ success: false, message: 'Invalid or missing API key for integration endpoint.' });
  }
  next();
}

module.exports = {
  protect,
  authenticate: protect,
  authorize,
  requireApiKey,
};
