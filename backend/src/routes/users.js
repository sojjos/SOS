const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticate, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// ====================================
// GET /api/users - Liste des utilisateurs (Admin)
// ====================================
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { agency_id, account_type, is_active, search, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let baseQuery = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
             u.account_type, u.is_active, u.last_login, u.created_at
      FROM users u
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (account_type) {
      baseQuery += ` AND u.account_type = $${paramIndex++}`;
      params.push(account_type);
    }

    if (is_active !== undefined) {
      baseQuery += ` AND u.is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }

    if (search) {
      baseQuery += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex++})`;
      params.push(`%${search}%`);
    }

    if (agency_id) {
      baseQuery += ` AND EXISTS (
        SELECT 1 FROM user_agency_access uaa
        WHERE uaa.user_id = u.id AND uaa.agency_id = $${paramIndex++}
      )`;
      params.push(agency_id);
    }

    // Count
    const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) as sub`;
    const { rows: countRows } = await query(countQuery, params);
    const total = parseInt(countRows[0].count);

    // Pagination
    baseQuery += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), offset);

    const { rows: users } = await query(baseQuery, params);

    // Charger les accès agences pour chaque utilisateur
    for (const user of users) {
      const { rows: accesses } = await query(`
        SELECT uaa.*, a.name as agency_name, a.code as agency_code,
               hl.level_number, hl.name as level_name
        FROM user_agency_access uaa
        JOIN agencies a ON uaa.agency_id = a.id
        LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
        WHERE uaa.user_id = $1
      `, [user.id]);
      user.agency_accesses = accesses;
    }

    res.json({
      users,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error('Erreur liste users:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des utilisateurs' });
  }
});

// ====================================
// GET /api/users/:id - Détail utilisateur
// ====================================
router.get('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
             u.account_type, u.is_active, u.is_email_verified,
             u.last_login, u.created_at, u.updated_at
      FROM users u
      WHERE u.id = $1
    `, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    const user = rows[0];

    // Charger les accès
    const { rows: accesses } = await query(`
      SELECT uaa.*, a.name as agency_name, a.code as agency_code,
             hl.level_number, hl.name as level_name, hl.permissions
      FROM user_agency_access uaa
      JOIN agencies a ON uaa.agency_id = a.id
      LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
      WHERE uaa.user_id = $1
    `, [id]);
    user.agency_accesses = accesses;

    res.json(user);
  } catch (err) {
    console.error('Erreur détail user:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l\'utilisateur' });
  }
});

// ====================================
// POST /api/users - Créer un utilisateur (Admin)
// ====================================
router.post('/', authenticate, requireAdmin, [
  body('email').isEmail().normalizeEmail(),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('password').isLength({ min: 8 }),
  body('accountType').isIn(['admin', 'admin_delegated', 'user'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, firstName, lastName, phone, password, accountType, agencyAccesses } = req.body;

    // Vérifier email unique
    const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Créer l'utilisateur
    const { rows } = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, account_type, is_active, is_email_verified)
      VALUES ($1, $2, $3, $4, $5, $6, true, true)
      RETURNING id
    `, [email.toLowerCase(), passwordHash, firstName, lastName, phone || null, accountType]);

    const userId = rows[0].id;

    // Ajouter les accès agences si utilisateur standard
    if (accountType === 'user' && agencyAccesses && agencyAccesses.length > 0) {
      for (const access of agencyAccesses) {
        await query(`
          INSERT INTO user_agency_access (user_id, agency_id, hierarchy_level_id, access_type, profile_types, is_union_member)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          userId,
          access.agency_id,
          access.hierarchy_level_id || null,
          access.access_type || 'full',
          JSON.stringify(access.profile_types || ['terrain']),
          access.is_union_member || false
        ]);
      }
    }

    // Log admin
    await query(`
      INSERT INTO admin_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, 'user_created', 'user', $2, $3, $4)
    `, [req.user.id, userId, JSON.stringify({ email, accountType }), req.ip]);

    res.status(201).json({ id: userId, message: 'Utilisateur créé avec succès' });
  } catch (err) {
    console.error('Erreur création user:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'utilisateur' });
  }
});

// ====================================
// PUT /api/users/:id - Modifier un utilisateur
// ====================================
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, phone, accountType, isActive, agencyAccesses } = req.body;

    // Vérifier que l'utilisateur existe
    const { rows: existing } = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    // Mettre à jour
    await query(`
      UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone = COALESCE($3, phone),
        account_type = COALESCE($4, account_type),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `, [firstName, lastName, phone, accountType, isActive, id]);

    // Mettre à jour les accès si fournis
    if (agencyAccesses) {
      // Désactiver les anciens accès
      await query('UPDATE user_agency_access SET is_active = false WHERE user_id = $1', [id]);

      // Ajouter/Réactiver les nouveaux
      for (const access of agencyAccesses) {
        await query(`
          INSERT INTO user_agency_access (user_id, agency_id, hierarchy_level_id, access_type, profile_types, is_union_member, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, true)
          ON CONFLICT (user_id, agency_id)
          DO UPDATE SET
            hierarchy_level_id = EXCLUDED.hierarchy_level_id,
            access_type = EXCLUDED.access_type,
            profile_types = EXCLUDED.profile_types,
            is_union_member = EXCLUDED.is_union_member,
            is_active = true,
            updated_at = CURRENT_TIMESTAMP
        `, [
          id,
          access.agency_id,
          access.hierarchy_level_id || null,
          access.access_type || 'full',
          JSON.stringify(access.profile_types || ['terrain']),
          access.is_union_member || false
        ]);
      }
    }

    // Log
    await query(`
      INSERT INTO admin_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES ($1, 'user_updated', 'user', $2, $3, $4)
    `, [req.user.id, id, JSON.stringify(req.body), req.ip]);

    res.json({ message: 'Utilisateur mis à jour avec succès' });
  } catch (err) {
    console.error('Erreur modification user:', err);
    res.status(500).json({ error: 'Erreur lors de la modification de l\'utilisateur' });
  }
});

// ====================================
// PUT /api/users/:id/deactivate - Désactiver (pas supprimer)
// ====================================
router.put('/:id/deactivate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await query('UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // Log
    await query(`
      INSERT INTO admin_logs (user_id, action, entity_type, entity_id, ip_address)
      VALUES ($1, 'user_deactivated', 'user', $2, $3)
    `, [req.user.id, id, req.ip]);

    res.json({ message: 'Utilisateur désactivé' });
  } catch (err) {
    console.error('Erreur désactivation user:', err);
    res.status(500).json({ error: 'Erreur lors de la désactivation' });
  }
});

// ====================================
// PUT /api/users/:id/reactivate - Réactiver
// ====================================
router.put('/:id/reactivate', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await query('UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);

    // Log
    await query(`
      INSERT INTO admin_logs (user_id, action, entity_type, entity_id, ip_address)
      VALUES ($1, 'user_reactivated', 'user', $2, $3)
    `, [req.user.id, id, req.ip]);

    res.json({ message: 'Utilisateur réactivé' });
  } catch (err) {
    console.error('Erreur réactivation user:', err);
    res.status(500).json({ error: 'Erreur lors de la réactivation' });
  }
});

module.exports = router;
