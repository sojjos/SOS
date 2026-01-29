const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../../config/database');
const { authenticatePlatformAdmin } = require('./auth');

const router = express.Router();

// Tous les endpoints nécessitent une authentification platform admin
router.use(authenticatePlatformAdmin);

// Middleware pour vérifier le rôle super_admin
const requireSuperAdmin = (req, res, next) => {
  if (req.platformAdmin.role !== 'super_admin') {
    return res.status(403).json({ error: 'Action réservée aux super administrateurs' });
  }
  next();
};

// ====================================
// GET /api/platform/admins - Liste des admins plateforme
// ====================================
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        pa.id, pa.email, pa.first_name, pa.last_name, pa.role,
        pa.is_active, pa.last_login, pa.created_at,
        creator.email as created_by_email
      FROM platform_admins pa
      LEFT JOIN platform_admins creator ON pa.created_by = creator.id
      ORDER BY pa.created_at DESC
    `);

    res.json({ admins: rows });
  } catch (err) {
    console.error('Erreur liste admins:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des administrateurs' });
  }
});

// ====================================
// POST /api/platform/admins - Créer un admin plateforme
// ====================================
router.post('/', requireSuperAdmin, [
  body('email').isEmail().normalizeEmail().withMessage('Email invalide'),
  body('firstName').trim().notEmpty().withMessage('Prénom requis'),
  body('lastName').trim().notEmpty().withMessage('Nom requis'),
  body('password').isLength({ min: 12 }).withMessage('Mot de passe min. 12 caractères'),
  body('role').isIn(['viewer', 'admin', 'super_admin']).withMessage('Rôle invalide')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, firstName, lastName, password, role } = req.body;

    // Vérifier l'unicité de l'email
    const { rows: existing } = await query(
      'SELECT id FROM platform_admins WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 12);

    // Créer l'admin
    const { rows } = await query(
      `INSERT INTO platform_admins (email, password_hash, first_name, last_name, role, must_change_password, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, role, req.platformAdmin.id]
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'admin_created', 'platform_admin', $2, $3, $4)`,
      [
        req.platformAdmin.id,
        rows[0].id,
        JSON.stringify({ email, role }),
        req.ip
      ]
    );

    res.status(201).json({
      admin: rows[0],
      message: 'Administrateur créé avec succès'
    });
  } catch (err) {
    console.error('Erreur création admin:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'administrateur' });
  }
});

// ====================================
// PUT /api/platform/admins/:id - Modifier un admin
// ====================================
router.put('/:id', requireSuperAdmin, [
  body('firstName').optional().trim().notEmpty().withMessage('Prénom invalide'),
  body('lastName').optional().trim().notEmpty().withMessage('Nom invalide'),
  body('role').optional().isIn(['viewer', 'admin', 'super_admin']).withMessage('Rôle invalide'),
  body('isActive').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;

    // Vérifier que l'admin existe
    const { rows: existing } = await query(
      'SELECT * FROM platform_admins WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Administrateur non trouvé' });
    }

    // Empêcher la modification de son propre rôle/statut
    if (id === req.platformAdmin.id && (req.body.role || req.body.isActive !== undefined)) {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle ou statut' });
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (req.body.firstName) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(req.body.firstName);
    }
    if (req.body.lastName) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(req.body.lastName);
    }
    if (req.body.role) {
      updates.push(`role = $${paramIndex++}`);
      values.push(req.body.role);
    }
    if (req.body.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(req.body.isActive);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }

    values.push(id);
    const { rows } = await query(
      `UPDATE platform_admins SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}
       RETURNING id, email, first_name, last_name, role, is_active`,
      values
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'admin_updated', 'platform_admin', $2, $3, $4)`,
      [
        req.platformAdmin.id,
        id,
        JSON.stringify({ changes: req.body }),
        req.ip
      ]
    );

    res.json({
      admin: rows[0],
      message: 'Administrateur modifié avec succès'
    });
  } catch (err) {
    console.error('Erreur modification admin:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de l\'administrateur' });
  }
});

// ====================================
// POST /api/platform/admins/:id/reset-password - Réinitialiser mot de passe
// ====================================
router.post('/:id/reset-password', requireSuperAdmin, [
  body('newPassword').isLength({ min: 12 }).withMessage('Mot de passe min. 12 caractères')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    // Vérifier que l'admin existe
    const { rows: existing } = await query(
      'SELECT id FROM platform_admins WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Administrateur non trouvé' });
    }

    // Hasher le nouveau mot de passe
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await query(
      'UPDATE platform_admins SET password_hash = $1, must_change_password = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [passwordHash, id]
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, 'admin_password_reset', 'platform_admin', $2, $3)`,
      [req.platformAdmin.id, id, req.ip]
    );

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('Erreur reset password admin:', err);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation du mot de passe' });
  }
});

// ====================================
// DELETE /api/platform/admins/:id - Supprimer un admin
// ====================================
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Empêcher de se supprimer soi-même
    if (id === req.platformAdmin.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous supprimer vous-même' });
    }

    // Vérifier que l'admin existe
    const { rows: existing } = await query(
      'SELECT * FROM platform_admins WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Administrateur non trouvé' });
    }

    // Vérifier qu'il reste au moins un super_admin
    const { rows: superAdmins } = await query(
      "SELECT COUNT(*) as count FROM platform_admins WHERE role = 'super_admin' AND is_active = true AND id != $1",
      [id]
    );

    if (existing[0].role === 'super_admin' && parseInt(superAdmins[0].count) === 0) {
      return res.status(400).json({ error: 'Impossible de supprimer le dernier super administrateur' });
    }

    // Désactiver plutôt que supprimer (pour garder l'historique)
    await query(
      'UPDATE platform_admins SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );

    // Logger l'action
    await query(
      `INSERT INTO platform_logs (platform_admin_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'admin_deleted', 'platform_admin', $2, $3, $4)`,
      [
        req.platformAdmin.id,
        id,
        JSON.stringify({ email: existing[0].email }),
        req.ip
      ]
    );

    res.json({ message: 'Administrateur désactivé avec succès' });
  } catch (err) {
    console.error('Erreur suppression admin:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'administrateur' });
  }
});

module.exports = router;
