const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query, pool } = require('../config/database');
const { authenticate, requireAdmin, requireFullAdmin } = require('../middlewares/auth');

// Toutes les routes admin nécessitent l'authentification et les droits admin
router.use(authenticate);
router.use(requireAdmin);

// Fonction pour logger les actions admin
const logAdminAction = async (adminId, action, entityType, entityId, details, ipAddress) => {
  try {
    await query(
      `INSERT INTO admin_logs (admin_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [adminId, action, entityType, entityId, JSON.stringify(details), ipAddress]
    );
  } catch (err) {
    console.error('Erreur log admin:', err);
  }
};

// ====================================
// GESTION DES AGENCES
// ====================================

// POST /api/admin/agencies - Créer une nouvelle agence
router.post('/agencies', requireFullAdmin, async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, code, address, city, country, config, copy_from_agency_id } = req.body;

    if (!name || !code) {
      return res.status(400).json({ error: 'Nom et code requis' });
    }

    // Vérifier unicité du code
    const { rows: existing } = await query(
      'SELECT id FROM agencies WHERE code = $1',
      [code]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Ce code d\'agence existe déjà' });
    }

    await client.query('BEGIN');

    // Créer l'agence
    const { rows: agencyRows } = await client.query(
      `INSERT INTO agencies (name, code, address, city, country, config)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, code, address || null, city || null, country || 'Belgique', config || '{}']
    );

    const newAgency = agencyRows[0];

    // Si on copie depuis une autre agence
    if (copy_from_agency_id) {
      // Copier les niveaux hiérarchiques
      await client.query(`
        INSERT INTO hierarchy_levels (agency_id, level_number, name, description, permissions, escalates_to_level)
        SELECT $1, level_number, name, description, permissions, escalates_to_level
        FROM hierarchy_levels WHERE agency_id = $2
      `, [newAgency.id, copy_from_agency_id]);

      // Copier les types de problèmes
      await client.query(`
        INSERT INTO problem_types (agency_id, name, description, color, icon, parent_id)
        SELECT $1, name, description, color, icon, NULL
        FROM problem_types WHERE agency_id = $2 AND parent_id IS NULL
      `, [newAgency.id, copy_from_agency_id]);

      // Copier les lieux
      await client.query(`
        INSERT INTO locations (agency_id, name, location_type, parent_id)
        SELECT $1, name, location_type, NULL
        FROM locations WHERE agency_id = $2 AND parent_id IS NULL
      `, [newAgency.id, copy_from_agency_id]);

      // Copier les configs SLA
      await client.query(`
        INSERT INTO sla_configs (agency_id, urgency, blocking_level, response_time_hours, resolution_time_hours)
        SELECT $1, urgency, blocking_level, response_time_hours, resolution_time_hours
        FROM sla_configs WHERE agency_id = $2
      `, [newAgency.id, copy_from_agency_id]);

      // Copier les groupes de confidentialité
      await client.query(`
        INSERT INTO confidentiality_groups (agency_id, name, description, can_read_levels, can_write_levels)
        SELECT $1, name, description, can_read_levels, can_write_levels
        FROM confidentiality_groups WHERE agency_id = $2
      `, [newAgency.id, copy_from_agency_id]);
    }

    await client.query('COMMIT');

    await logAdminAction(
      req.user.id, 'CREATE', 'agency', newAgency.id,
      { name, code, copied_from: copy_from_agency_id },
      req.ip
    );

    res.status(201).json(newAgency);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur création agence:', err);
    res.status(500).json({ error: 'Erreur lors de la création de l\'agence' });
  } finally {
    client.release();
  }
});

// PUT /api/admin/agencies/:id - Modifier une agence
router.put('/agencies/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, city, country, config, is_active } = req.body;

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIndex++}`);
      params.push(address);
    }
    if (city !== undefined) {
      updates.push(`city = $${paramIndex++}`);
      params.push(city);
    }
    if (country !== undefined) {
      updates.push(`country = $${paramIndex++}`);
      params.push(country);
    }
    if (config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(config));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Aucune modification fournie' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    params.push(id);

    const { rows } = await query(
      `UPDATE agencies SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Agence non trouvée' });
    }

    await logAdminAction(req.user.id, 'UPDATE', 'agency', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification agence:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// ====================================
// GESTION DES NIVEAUX HIÉRARCHIQUES
// ====================================

// GET /api/admin/agencies/:agencyId/hierarchy-levels
router.get('/agencies/:agencyId/hierarchy-levels', async (req, res) => {
  try {
    const { agencyId } = req.params;

    const { rows } = await query(
      `SELECT * FROM hierarchy_levels
       WHERE agency_id = $1
       ORDER BY level_number`,
      [agencyId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération niveaux:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/admin/agencies/:agencyId/hierarchy-levels
router.post('/agencies/:agencyId/hierarchy-levels', async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { level_number, name, description, permissions, escalates_to_level } = req.body;

    if (level_number === undefined || !name) {
      return res.status(400).json({ error: 'Numéro de niveau et nom requis' });
    }

    const { rows } = await query(
      `INSERT INTO hierarchy_levels (agency_id, level_number, name, description, permissions, escalates_to_level)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [agencyId, level_number, name, description || null, JSON.stringify(permissions || {}), escalates_to_level]
    );

    await logAdminAction(req.user.id, 'CREATE', 'hierarchy_level', rows[0].id, req.body, req.ip);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erreur création niveau:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/admin/hierarchy-levels/:id
router.put('/hierarchy-levels/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, escalates_to_level } = req.body;

    const { rows } = await query(
      `UPDATE hierarchy_levels
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           permissions = COALESCE($3, permissions),
           escalates_to_level = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, description, permissions ? JSON.stringify(permissions) : null, escalates_to_level, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Niveau non trouvé' });
    }

    await logAdminAction(req.user.id, 'UPDATE', 'hierarchy_level', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification niveau:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// DELETE /api/admin/hierarchy-levels/:id
router.delete('/hierarchy-levels/:id', requireFullAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier qu'aucun utilisateur n'utilise ce niveau
    const { rows: users } = await query(
      'SELECT COUNT(*) as count FROM user_agency_access WHERE hierarchy_level_id = $1',
      [id]
    );

    if (parseInt(users[0].count) > 0) {
      return res.status(409).json({
        error: 'Impossible de supprimer: des utilisateurs utilisent ce niveau'
      });
    }

    const result = await query('DELETE FROM hierarchy_levels WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Niveau non trouvé' });
    }

    await logAdminAction(req.user.id, 'DELETE', 'hierarchy_level', id, {}, req.ip);

    res.json({ message: 'Niveau supprimé' });
  } catch (err) {
    console.error('Erreur suppression niveau:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ====================================
// GESTION DES TYPES DE PROBLÈMES
// ====================================

// GET /api/admin/agencies/:agencyId/problem-types
router.get('/agencies/:agencyId/problem-types', async (req, res) => {
  try {
    const { agencyId } = req.params;

    const { rows } = await query(
      `SELECT * FROM problem_types
       WHERE agency_id = $1 AND is_active = true
       ORDER BY name`,
      [agencyId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération types:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/admin/agencies/:agencyId/problem-types
router.post('/agencies/:agencyId/problem-types', async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { name, description, color, icon, parent_id, dynamic_fields } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nom requis' });
    }

    const { rows } = await query(
      `INSERT INTO problem_types (agency_id, name, description, color, icon, parent_id, dynamic_fields)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [agencyId, name, description, color || '#6c757d', icon, parent_id, JSON.stringify(dynamic_fields || [])]
    );

    await logAdminAction(req.user.id, 'CREATE', 'problem_type', rows[0].id, req.body, req.ip);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erreur création type:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/admin/problem-types/:id
router.put('/problem-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, dynamic_fields, is_active } = req.body;

    const { rows } = await query(
      `UPDATE problem_types
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           color = COALESCE($3, color),
           icon = COALESCE($4, icon),
           dynamic_fields = COALESCE($5, dynamic_fields),
           is_active = COALESCE($6, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7
       RETURNING *`,
      [name, description, color, icon, dynamic_fields ? JSON.stringify(dynamic_fields) : null, is_active, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Type non trouvé' });
    }

    await logAdminAction(req.user.id, 'UPDATE', 'problem_type', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification type:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// ====================================
// GESTION DES LIEUX
// ====================================

// GET /api/admin/agencies/:agencyId/locations
router.get('/agencies/:agencyId/locations', async (req, res) => {
  try {
    const { agencyId } = req.params;

    const { rows } = await query(
      `SELECT * FROM locations
       WHERE agency_id = $1 AND is_active = true
       ORDER BY location_type, name`,
      [agencyId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération lieux:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/admin/agencies/:agencyId/locations
router.post('/agencies/:agencyId/locations', async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { name, location_type, parent_id } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nom requis' });
    }

    const { rows } = await query(
      `INSERT INTO locations (agency_id, name, location_type, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [agencyId, name, location_type || 'terrain', parent_id]
    );

    await logAdminAction(req.user.id, 'CREATE', 'location', rows[0].id, req.body, req.ip);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erreur création lieu:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/admin/locations/:id
router.put('/locations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, location_type, is_active } = req.body;

    const { rows } = await query(
      `UPDATE locations
       SET name = COALESCE($1, name),
           location_type = COALESCE($2, location_type),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, location_type, is_active, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lieu non trouvé' });
    }

    await logAdminAction(req.user.id, 'UPDATE', 'location', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification lieu:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// ====================================
// GESTION DES SLA
// ====================================

// GET /api/admin/agencies/:agencyId/sla-configs
router.get('/agencies/:agencyId/sla-configs', async (req, res) => {
  try {
    const { agencyId } = req.params;

    const { rows } = await query(
      'SELECT * FROM sla_configs WHERE agency_id = $1 ORDER BY urgency, blocking_level',
      [agencyId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération SLA:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// PUT /api/admin/sla-configs/:id
router.put('/sla-configs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { response_time_hours, resolution_time_hours } = req.body;

    const { rows } = await query(
      `UPDATE sla_configs
       SET response_time_hours = COALESCE($1, response_time_hours),
           resolution_time_hours = COALESCE($2, resolution_time_hours),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [response_time_hours, resolution_time_hours, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Config SLA non trouvée' });
    }

    await logAdminAction(req.user.id, 'UPDATE', 'sla_config', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification SLA:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// ====================================
// GESTION DES GROUPES DE CONFIDENTIALITÉ
// ====================================

// GET /api/admin/agencies/:agencyId/confidentiality-groups
router.get('/agencies/:agencyId/confidentiality-groups', async (req, res) => {
  try {
    const { agencyId } = req.params;

    const { rows } = await query(
      'SELECT * FROM confidentiality_groups WHERE agency_id = $1 ORDER BY name',
      [agencyId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération groupes:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/admin/agencies/:agencyId/confidentiality-groups
router.post('/agencies/:agencyId/confidentiality-groups', async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { name, description, can_read_levels, can_write_levels } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nom requis' });
    }

    const { rows } = await query(
      `INSERT INTO confidentiality_groups (agency_id, name, description, can_read_levels, can_write_levels)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [agencyId, name, description, JSON.stringify(can_read_levels || []), JSON.stringify(can_write_levels || [])]
    );

    await logAdminAction(req.user.id, 'CREATE', 'confidentiality_group', rows[0].id, req.body, req.ip);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erreur création groupe:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/admin/confidentiality-groups/:id
router.put('/confidentiality-groups/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, can_read_levels, can_write_levels } = req.body;

    const { rows } = await query(
      `UPDATE confidentiality_groups
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           can_read_levels = COALESCE($3, can_read_levels),
           can_write_levels = COALESCE($4, can_write_levels),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, description, can_read_levels ? JSON.stringify(can_read_levels) : null,
       can_write_levels ? JSON.stringify(can_write_levels) : null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Groupe non trouvé' });
    }

    await logAdminAction(req.user.id, 'UPDATE', 'confidentiality_group', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification groupe:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// ====================================
// GESTION DES UTILISATEURS (ADMIN)
// ====================================

// GET /api/admin/users - Liste tous les utilisateurs
router.get('/users', async (req, res) => {
  try {
    const { agency_id, account_type, is_active, search, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT u.id, u.email, u.first_name, u.last_name, u.account_type,
             u.is_active, u.is_email_verified, u.created_at, u.last_login,
             json_agg(
               json_build_object(
                 'agency_id', uaa.agency_id,
                 'agency_name', a.name,
                 'level_number', hl.level_number,
                 'level_name', hl.name
               )
             ) FILTER (WHERE uaa.id IS NOT NULL) as agency_accesses
      FROM users u
      LEFT JOIN user_agency_access uaa ON u.id = uaa.user_id AND uaa.is_active = true
      LEFT JOIN agencies a ON uaa.agency_id = a.id
      LEFT JOIN hierarchy_levels hl ON uaa.hierarchy_level_id = hl.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (agency_id) {
      sql += ` AND uaa.agency_id = $${paramIndex++}`;
      params.push(agency_id);
    }

    if (account_type) {
      sql += ` AND u.account_type = $${paramIndex++}`;
      params.push(account_type);
    }

    if (is_active !== undefined) {
      sql += ` AND u.is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }

    if (search) {
      sql += ` AND (u.email ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex++})`;
      params.push(`%${search}%`);
    }

    sql += ` GROUP BY u.id ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(sql, params);

    res.json(rows);
  } catch (err) {
    console.error('Erreur liste utilisateurs:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/admin/users - Créer un utilisateur
router.post('/users', async (req, res) => {
  try {
    const { email, password, first_name, last_name, account_type, agency_accesses } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }

    // Vérifier que seul un admin complet peut créer un autre admin
    if (account_type === 'admin' && req.user.account_type !== 'admin') {
      return res.status(403).json({ error: 'Seul un admin complet peut créer un admin' });
    }

    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const { rows } = await query(
      `INSERT INTO users (email, password_hash, first_name, last_name, account_type, is_active, is_email_verified)
       VALUES ($1, $2, $3, $4, $5, true, true)
       RETURNING id, email, first_name, last_name, account_type, is_active, created_at`,
      [email, passwordHash, first_name, last_name, account_type || 'user']
    );

    const newUser = rows[0];

    // Ajouter les accès agences si fournis
    if (agency_accesses && agency_accesses.length > 0) {
      for (const access of agency_accesses) {
        await query(
          `INSERT INTO user_agency_access (user_id, agency_id, hierarchy_level_id, access_type, profile_types)
           VALUES ($1, $2, $3, $4, $5)`,
          [newUser.id, access.agency_id, access.hierarchy_level_id, access.access_type || 'limited',
           JSON.stringify(access.profile_types || ['terrain'])]
        );
      }
    }

    await logAdminAction(req.user.id, 'CREATE', 'user', newUser.id,
      { email, account_type: account_type || 'user' }, req.ip);

    res.status(201).json(newUser);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Cet email existe déjà' });
    }
    console.error('Erreur création utilisateur:', err);
    res.status(500).json({ error: 'Erreur lors de la création' });
  }
});

// PUT /api/admin/users/:id - Modifier un utilisateur
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, account_type, is_active } = req.body;

    // Vérifier les permissions pour modifier un admin
    const { rows: targetUser } = await query('SELECT account_type FROM users WHERE id = $1', [id]);

    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    if (targetUser[0].account_type === 'admin' && req.user.account_type !== 'admin') {
      return res.status(403).json({ error: 'Seul un admin complet peut modifier un admin' });
    }

    const { rows } = await query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           account_type = COALESCE($3, account_type),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, email, first_name, last_name, account_type, is_active`,
      [first_name, last_name, account_type, is_active, id]
    );

    await logAdminAction(req.user.id, 'UPDATE', 'user', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification utilisateur:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// PUT /api/admin/users/:id/reset-password - Réinitialiser le mot de passe
router.put('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe trop court (min 8 caractères)' });
    }

    const passwordHash = await bcrypt.hash(new_password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const result = await query(
      `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [passwordHash, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    await logAdminAction(req.user.id, 'RESET_PASSWORD', 'user', id, {}, req.ip);

    res.json({ message: 'Mot de passe réinitialisé' });
  } catch (err) {
    console.error('Erreur reset password:', err);
    res.status(500).json({ error: 'Erreur lors de la réinitialisation' });
  }
});

// ====================================
// GESTION DES ACCÈS AGENCES
// ====================================

// POST /api/admin/users/:userId/agency-access
router.post('/users/:userId/agency-access', async (req, res) => {
  try {
    const { userId } = req.params;
    const { agency_id, hierarchy_level_id, access_type, profile_types } = req.body;

    if (!agency_id || !hierarchy_level_id) {
      return res.status(400).json({ error: 'Agence et niveau requis' });
    }

    // Vérifier que l'accès n'existe pas déjà
    const { rows: existing } = await query(
      'SELECT id FROM user_agency_access WHERE user_id = $1 AND agency_id = $2',
      [userId, agency_id]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Accès déjà existant pour cette agence' });
    }

    const { rows } = await query(
      `INSERT INTO user_agency_access (user_id, agency_id, hierarchy_level_id, access_type, profile_types)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, agency_id, hierarchy_level_id, access_type || 'limited', JSON.stringify(profile_types || ['terrain'])]
    );

    await logAdminAction(req.user.id, 'CREATE', 'user_agency_access', rows[0].id, req.body, req.ip);

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Erreur ajout accès:', err);
    res.status(500).json({ error: 'Erreur lors de l\'ajout' });
  }
});

// PUT /api/admin/user-agency-access/:id
router.put('/user-agency-access/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { hierarchy_level_id, access_type, profile_types, is_active } = req.body;

    const { rows } = await query(
      `UPDATE user_agency_access
       SET hierarchy_level_id = COALESCE($1, hierarchy_level_id),
           access_type = COALESCE($2, access_type),
           profile_types = COALESCE($3, profile_types),
           is_active = COALESCE($4, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [hierarchy_level_id, access_type, profile_types ? JSON.stringify(profile_types) : null, is_active, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Accès non trouvé' });
    }

    await logAdminAction(req.user.id, 'UPDATE', 'user_agency_access', id, req.body, req.ip);

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur modification accès:', err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// DELETE /api/admin/user-agency-access/:id
router.delete('/user-agency-access/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM user_agency_access WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Accès non trouvé' });
    }

    await logAdminAction(req.user.id, 'DELETE', 'user_agency_access', id, {}, req.ip);

    res.json({ message: 'Accès supprimé' });
  } catch (err) {
    console.error('Erreur suppression accès:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// ====================================
// LOGS ADMIN
// ====================================

// GET /api/admin/logs - Consulter les logs admin
router.get('/logs', requireFullAdmin, async (req, res) => {
  try {
    const { admin_id, entity_type, action, start_date, end_date, limit = 100, offset = 0 } = req.query;

    let sql = `
      SELECT al.*, u.email as admin_email, u.first_name as admin_first_name, u.last_name as admin_last_name
      FROM admin_logs al
      JOIN users u ON al.admin_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (admin_id) {
      sql += ` AND al.admin_id = $${paramIndex++}`;
      params.push(admin_id);
    }

    if (entity_type) {
      sql += ` AND al.entity_type = $${paramIndex++}`;
      params.push(entity_type);
    }

    if (action) {
      sql += ` AND al.action = $${paramIndex++}`;
      params.push(action);
    }

    if (start_date) {
      sql += ` AND al.created_at >= $${paramIndex++}`;
      params.push(start_date);
    }

    if (end_date) {
      sql += ` AND al.created_at <= $${paramIndex++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const { rows } = await query(sql, params);

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération logs:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// ====================================
// STATISTIQUES GLOBALES
// ====================================

// GET /api/admin/stats - Statistiques globales du système
router.get('/stats', async (req, res) => {
  try {
    const [agencies, users, tickets, activeTickets] = await Promise.all([
      query('SELECT COUNT(*) as count FROM agencies WHERE is_active = true'),
      query('SELECT COUNT(*) as count FROM users WHERE is_active = true'),
      query('SELECT COUNT(*) as count FROM tickets'),
      query("SELECT COUNT(*) as count FROM tickets WHERE status NOT IN ('cloture', 'annule')")
    ]);

    res.json({
      agencies_count: parseInt(agencies.rows[0].count),
      users_count: parseInt(users.rows[0].count),
      total_tickets: parseInt(tickets.rows[0].count),
      active_tickets: parseInt(activeTickets.rows[0].count)
    });
  } catch (err) {
    console.error('Erreur stats globales:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

module.exports = router;
