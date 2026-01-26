const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

// ====================================
// POST /api/auth/login - Connexion
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

    // Trouver l'utilisateur
    const { rows } = await query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user = rows[0];

    // Vérifier si le compte est actif
    if (!user.is_active) {
      return res.status(401).json({ error: 'Compte désactivé. Contactez un administrateur.' });
    }

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Générer le token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        accountType: user.account_type
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    // Générer le refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );

    // Mettre à jour la date de dernière connexion
    await query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Charger les accès aux agences
    let agencyAccesses = [];
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const { rows: accesses } = await query(
        `SELECT uaa.*, a.name as agency_name, a.code as agency_code,
                hl.level_number, hl.name as level_name
         FROM user_agency_access uaa
         JOIN agencies a ON uaa.agency_id = a.id
         LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
         WHERE uaa.user_id = $1 AND uaa.is_active = true AND a.is_active = true`,
        [user.id]
      );
      agencyAccesses = accesses;
    } else {
      // Pour les admins, charger toutes les agences
      const { rows: agencies } = await query(
        'SELECT id as agency_id, name as agency_name, code as agency_code FROM agencies WHERE is_active = true'
      );
      agencyAccesses = agencies.map(a => ({
        ...a,
        access_type: 'full',
        level_number: 999,
        level_name: 'Administrateur'
      }));
    }

    // Logger la connexion
    await query(
      `INSERT INTO admin_logs (user_id, action, entity_type, details, ip_address, user_agent)
       VALUES ($1, 'login', 'user', $2, $3, $4)`,
      [
        user.id,
        JSON.stringify({ success: true }),
        req.ip,
        req.get('User-Agent')
      ]
    );

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        accountType: user.account_type,
        isAdmin: user.account_type === 'admin' || user.account_type === 'admin_delegated',
        agencyAccesses
      }
    });
  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

// ====================================
// POST /api/auth/refresh - Rafraîchir le token
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

      // Vérifier que l'utilisateur existe toujours
      const { rows } = await query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );

      if (rows.length === 0) {
        return res.status(401).json({ error: 'Utilisateur non trouvé' });
      }

      const user = rows[0];

      // Générer un nouveau token
      const newToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          accountType: user.account_type
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      res.json({ token: newToken });
    } catch (jwtError) {
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }
  } catch (err) {
    console.error('Erreur refresh:', err);
    res.status(500).json({ error: 'Erreur lors du rafraîchissement du token' });
  }
});

// ====================================
// POST /api/auth/request-access - Demande d'accès
// ====================================
router.post('/request-access', [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('requestedAgencies').isArray({ min: 1 }).withMessage('Au moins une agence requise')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, firstName, lastName, phone, requestedAgencies, message } = req.body;

    // Vérifier si l'email existe déjà
    const { rows: existingUser } = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'Un compte existe déjà avec cet email' });
    }

    // Vérifier s'il y a déjà une demande en attente
    const { rows: existingRequest } = await query(
      'SELECT id FROM access_requests WHERE email = $1 AND status = $2',
      [email.toLowerCase(), 'pending']
    );

    if (existingRequest.length > 0) {
      return res.status(400).json({ error: 'Une demande est déjà en attente pour cet email' });
    }

    // Créer la demande d'accès
    const { rows } = await query(
      `INSERT INTO access_requests (email, first_name, last_name, phone, requested_agencies, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        email.toLowerCase(),
        firstName,
        lastName,
        phone || null,
        JSON.stringify(requestedAgencies),
        message || null
      ]
    );

    // TODO: Envoyer notification aux admins

    res.status(201).json({
      message: 'Demande d\'accès envoyée avec succès. Vous serez notifié par email.',
      requestId: rows[0].id
    });
  } catch (err) {
    console.error('Erreur request-access:', err);
    res.status(500).json({ error: 'Erreur lors de la demande d\'accès' });
  }
});

// ====================================
// GET /api/auth/me - Infos utilisateur connecté
// ====================================
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = req.user;

    // Charger les accès aux agences
    let agencyAccesses = [];
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const { rows: accesses } = await query(
        `SELECT uaa.*, a.name as agency_name, a.code as agency_code,
                hl.level_number, hl.name as level_name, hl.permissions
         FROM user_agency_access uaa
         JOIN agencies a ON uaa.agency_id = a.id
         LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
         WHERE uaa.user_id = $1 AND uaa.is_active = true AND a.is_active = true`,
        [user.id]
      );
      agencyAccesses = accesses;
    } else {
      const { rows: agencies } = await query(
        'SELECT id as agency_id, name as agency_name, code as agency_code FROM agencies WHERE is_active = true'
      );
      agencyAccesses = agencies.map(a => ({
        ...a,
        access_type: 'full',
        level_number: 999,
        level_name: 'Administrateur'
      }));
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      accountType: user.account_type,
      isAdmin: user.account_type === 'admin' || user.account_type === 'admin_delegated',
      isFullAdmin: user.account_type === 'admin',
      agencyAccesses,
      lastLogin: user.last_login,
      createdAt: user.created_at
    });
  } catch (err) {
    console.error('Erreur me:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des informations' });
  }
});

// ====================================
// POST /api/auth/change-password - Changer mot de passe
// ====================================
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Mot de passe actuel requis'),
  body('newPassword').isLength({ min: 8 }).withMessage('Le nouveau mot de passe doit faire au moins 8 caractères')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;

    // Récupérer le hash actuel
    const { rows } = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    }

    // Hasher le nouveau mot de passe
    const newHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Mettre à jour
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.user.id]
    );

    // Logger l'action
    await query(
      `INSERT INTO admin_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'password_changed', 'user', $2, $3)`,
      [req.user.id, req.user.id, req.ip]
    );

    res.json({ message: 'Mot de passe modifié avec succès' });
  } catch (err) {
    console.error('Erreur change-password:', err);
    res.status(500).json({ error: 'Erreur lors du changement de mot de passe' });
  }
});

// ====================================
// POST /api/auth/logout - Déconnexion
// ====================================
router.post('/logout', authenticate, async (req, res) => {
  try {
    // Logger la déconnexion
    await query(
      `INSERT INTO admin_logs (user_id, action, entity_type, ip_address)
       VALUES ($1, 'logout', 'user', $2)`,
      [req.user.id, req.ip]
    );

    res.json({ message: 'Déconnexion réussie' });
  } catch (err) {
    console.error('Erreur logout:', err);
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
});

module.exports = router;
