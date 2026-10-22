function requirePermission(...permissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    const role = (req.user.role || '').toLowerCase();
    if (role === 'superadmin' || role === 'super_admin' || role === 'admin') {
      return next();
    }
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some((p) => userPermissions.includes(p));
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient permissions for this action',
      });
    }
    next();
  };
}

module.exports = { requirePermission };
