const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../../config/database');

const router = express.Router();

// Middleware pour authentifier les admins de plateforme
const authenticatePlatformAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Vérifier que c'est un admin de plateforme
    if (!decoded.isPlatformAdmin) {
      return res.status(403).json({ error: 'Accès réservé aux administrateurs de plateforme' });
    }

    const { rows } = await query(
      'SELECT * FROM platform_admins WHERE id = $1 AND is_active = true',
      [decoded.adminId]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Administrateur non trouvé ou désactivé' });
    }

    req.platformAdmin = rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
    console.error('Erreur auth platform:', err);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

// ====================================
// POST /api/platform/auth/login - Connexion admin plateforme
// ====================================
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('password').notEmpty().withMessage('Mot de passe requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Trouver l'admin
    const { rows } = await query(
      'SELECT * FROM platform_admins WHERE email = $1',
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const admin = rows[0];

    // Vérifier si le compte est actif
    if (!admin.is_active) {
      return res.status(401).json({ error: 'Compte désactivé' });
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      {
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
        isPlatformAdmin: true
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Générer le refresh token
    const refreshToken = jwt.sign(
      { adminId: admin.id, isPlatformAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Mettre à jour la date de dernière connexion
    await query(
      'UPDATE platform_admins SET last_login = CURRENT_TIMESTAMP, last_login_ip = $2 WHERE id = $1',
      [admin.id, req.ip]
    );

    // Logger la connexion
    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, details, ip_address, user_agent)
       VALUES ($1, 'login', $2, $3, $4)`,
      [
        admin.id,
        JSON.stringify({ success: true }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      token,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.first_name,
        lastName: admin.last_name,
        role: admin.role,
        mustChangePassword: admin.must_change_password
      }
    });
  } catch (err) {
    console.error('Erreur login platform:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ====================================
// POST /api/platform/auth/refresh - Rafraîchir le token
// ====================================
router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token requis')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { refreshToken } = req.body;

    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

      if (!decoded.isPlatformAdmin) {
        return res.status(401).json({ error: 'Token invalide' });
      }

      const { rows } = await query(
        'SELECT * FROM platform_admins WHERE id = $1 AND is_active = true',
        [decoded.adminId]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Administrateur non trouvé' });
      }

      const admin = rows[0];

      const newToken = jwt.sign(
        {
          adminId: admin.id,
          email: admin.email,
          role: admin.role,
          isPlatformAdmin: true
        },
        process.env.JWT_SECRET,
        { expiresIn: '8h' }
      );

      res.json({ token: newToken });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }
  } catch (err) {
    console.error('Erreur refresh platform:', err);
    res.status(500).json({ error: 'Erreur lors du rafraîchissement du token' });
  }
});

// ====================================
// GET /api/platform/auth/me - Infos admin connecté
// ====================================
router.get('/me', authenticatePlatformAdmin, async (req, res) => {
  try {
    const admin = req.platformAdmin;

    res.json({
      id: admin.id,
      email: admin.email,
      firstName: admin.first_name,
      lastName: admin.last_name,
      role: admin.role,
      permissions: admin.permissions,
      lastLogin: admin.last_login,
      mustChangePassword: admin.must_change_password
    });
  } catch (err) {
    console.error('Erreur me platform:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

// ====================================
// POST /api/platform/auth/change-password - Changer mot de passe
// ====================================
router.post('/change-password', authenticatePlatformAdmin, [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  body('newPassword').isLength({ min: 12 }).withMessage('Le nouveau mot de passe doit faire au moins 12 caractères')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(currentPassword, req.platformAdmin.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher le nouveau mot de passe
    const newHash = await bcrypt.hash(newPassword, 12);

    // Mettre à jour
    await query(
      'UPDATE platform_admins SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.platformAdmin.id]
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, ip_address)
       VALUES ($1, 'password_changed', $2)`,
      [req.platformAdmin.id, req.ip]
    );

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Erreur change-password platform:', err);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
});

// ====================================
// POST /api/platform/auth/logout - Déconnexion
// ====================================
router.post('/logout', authenticatePlatformAdmin, async (req, res) => {
  try {
    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, ip_address)
       VALUES ($1, 'logout', $2)`,
      [req.platformAdmin.id, req.ip]
    );

    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur logout platform:', err);
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
});

module.exports = router;
module.exports.authenticatePlatformAdmin = authenticatePlatformAdmin;
