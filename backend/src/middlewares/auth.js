const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

// Middleware d'authentification
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'authentification requis' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Vérifier que l'utilisateur existe et est actif
      const { rows } = await query(
        `SELECT u.*,
          CASE WHEN u.account_type IN ('admin', 'admin_delegated') THEN true ELSE false END as is_admin
         FROM users u
         WHERE u.id = $1 AND u.is_active = true`,
        [decoded.userId]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
      }

      const user = rows[0];
      delete user.password_hash;

      // Charger les accès par agence si ce n'est pas un admin
      if (!user.is_admin) {
        const { rows: accesses } = await query(
          `SELECT uaa.*, a.name as agency_name, a.code as agency_code,
                  hl.level_number, hl.name as level_name, hl.permissions
           FROM user_agency_access uaa
           JOIN agencies a ON uaa.agency_id = a.id
           LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
           WHERE uaa.user_id = $1 AND uaa.is_active = true AND a.is_active = true`,
          [user.id]
        );
        user.agency_accesses = accesses;
      }

      req.user = user;
      req.token = token;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Token invalide' });
    }
  } catch (err) {
    console.error('Erreur auth middleware:', err);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

// Middleware pour vérifier si admin
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  if (req.user.account_type !== 'admin' && req.user.account_type !== 'admin_delegated') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs' });
  }

  next();
};

// Middleware pour vérifier si admin complet (pas délégué)
const requireFullAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise' });
  }

  if (req.user.account_type !== 'admin') {
    return res.status(403).json({ error: 'Accès réservé aux administrateurs complets' });
  }

  next();
};

// Middleware pour vérifier l'accès à une agence
const requireAgencyAccess = (agencyIdParam = 'agencyId') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    const agencyId = req.params[agencyIdParam] || req.body.agency_id || req.query.agency_id;

    if (!agencyId) {
      return res.status(400).json({ error: 'ID d\'agence requis' });
    }

    // Les admins ont accès à toutes les agences
    if (req.user.account_type === 'admin' || req.user.account_type === 'admin_delegated') {
      // Charger les infos de l'agence
      const { rows } = await query(
        'SELECT * FROM agencies WHERE id = $1 AND is_active = true',
        [agencyId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Agence non trouvée' });
      }

      req.agency = rows[0];
      req.userAgencyAccess = {
        access_type: 'full',
        level_number: 999, // Niveau max pour admin
        permissions: { all: true }
      };
      return next();
    }

    // Pour les utilisateurs normaux, vérifier l'accès
    const access = req.user.agency_accesses?.find(a => a.agency_id === agencyId);

    if (!access) {
      return res.status(403).json({ error: 'Accès non autorisé à cette agence' });
    }

    // Charger l'agence
    const { rows } = await query(
      'SELECT * FROM agencies WHERE id = $1 AND is_active = true',
      [agencyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agence non trouvée' });
    }

    req.agency = rows[0];
    req.userAgencyAccess = access;
    next();
  };
};

// Middleware pour vérifier une permission spécifique
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    // Les admins ont toutes les permissions
    if (req.user.account_type === 'admin' || req.user.account_type === 'admin_delegated') {
      return next();
    }

    // Vérifier la permission dans l'accès agence
    if (!req.userAgencyAccess) {
      return res.status(403).json({ error: 'Accès agence non vérifié' });
    }

    const permissions = req.userAgencyAccess.permissions || {};

    if (permissions.all || permissions[permission]) {
      return next();
    }

    res.status(403).json({
      error: 'Permission insuffisante',
      required: permission
    });
  };
};

// Middleware pour vérifier le niveau hiérarchique minimum
const requireMinLevel = (minLevel) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentification requise' });
    }

    // Les admins passent toujours
    if (req.user.account_type === 'admin' || req.user.account_type === 'admin_delegated') {
      return next();
    }

    if (!req.userAgencyAccess) {
      return res.status(403).json({ error: 'Accès agence non vérifié' });
    }

    if (req.userAgencyAccess.level_number < minLevel) {
      return res.status(403).json({
        error: 'Niveau hiérarchique insuffisant',
        required: minLevel,
        current: req.userAgencyAccess.level_number
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireAdmin,
  requireFullAdmin,
  requireAgencyAccess,
  requirePermission,
  requireMinLevel
};
