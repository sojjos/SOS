const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, requireAgencyAccess } = require('../middlewares/auth');

// Obtenir les templates pour une agence (filtres par niveau utilisateur)
router.get('/agency/:agencyId', authenticate, requireAgencyAccess('agencyId'), async (req, res) => {
  try {
    const { agencyId } = req.params;
    const { user } = req;

    // Determiner le niveau de l'utilisateur
    let userLevel = 999;
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const userAccess = user.agency_accesses?.find(a => a.agency_id === agencyId);
      userLevel = userAccess?.level_number ?? 0;
    }

    // Recuperer les templates accessibles
    const { rows } = await query(
      `SELECT
        tt.*,
        pt.name AS problem_type_name,
        l.name AS location_name,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM ticket_templates tt
      LEFT JOIN problem_types pt ON tt.problem_type_id = pt.id
      LEFT JOIN locations l ON tt.default_location_id = l.id
      LEFT JOIN users u ON tt.created_by = u.id
      WHERE tt.agency_id = $1
        AND tt.is_active = true
        AND tt.min_level_required <= $2
      ORDER BY tt.usage_count DESC, tt.name ASC`,
      [agencyId, userLevel]
    );

    res.json(rows);
  } catch (error) {
    console.error('Erreur recuperation templates:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Obtenir un template par ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT
        tt.*,
        pt.name AS problem_type_name,
        l.name AS location_name
      FROM ticket_templates tt
      LEFT JOIN problem_types pt ON tt.problem_type_id = pt.id
      LEFT JOIN locations l ON tt.default_location_id = l.id
      WHERE tt.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Template non trouve' });
    }

    // Incrementer le compteur d'utilisation
    await query(
      'UPDATE ticket_templates SET usage_count = usage_count + 1 WHERE id = $1',
      [id]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('Erreur recuperation template:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Creer un template (niveau 2+ ou admin)
router.post('/', authenticate, async (req, res) => {
  try {
    const { user } = req;
    const {
      agency_id,
      name,
      description,
      title_template,
      description_template,
      problem_type_id,
      default_urgency,
      default_blocking,
      default_location_id,
      profile_type,
      min_level_required
    } = req.body;

    // Verifier le niveau de l'utilisateur (doit etre niveau 2+ ou admin)
    let userLevel = 999;
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      const userAccess = user.agency_accesses?.find(a => a.agency_id === agency_id);
      userLevel = userAccess?.level_number ?? 0;

      if (userLevel < 2) {
        return res.status(403).json({ error: 'Niveau insuffisant pour creer un template' });
      }
    }

    const { rows } = await query(
      `INSERT INTO ticket_templates (
        agency_id, name, description, title_template, description_template,
        problem_type_id, default_urgency, default_blocking, default_location_id,
        profile_type, min_level_required, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        agency_id, name, description, title_template, description_template,
        problem_type_id || null, default_urgency || null, default_blocking || null,
        default_location_id || null, profile_type || 'terrain',
        min_level_required || 0, user.id
      ]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Un template avec ce nom existe deja' });
    }
    console.error('Erreur creation template:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Modifier un template
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;
    const {
      name,
      description,
      title_template,
      description_template,
      problem_type_id,
      default_urgency,
      default_blocking,
      default_location_id,
      profile_type,
      min_level_required,
      is_active
    } = req.body;

    // Verifier que le template existe
    const { rows: existing } = await query(
      'SELECT * FROM ticket_templates WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Template non trouve' });
    }

    // Verifier les permissions (createur ou admin)
    const isAdmin = user.account_type === 'admin' || user.account_type === 'admin_delegated';
    if (!isAdmin && existing[0].created_by !== user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez modifier que vos propres templates' });
    }

    const { rows } = await query(
      `UPDATE ticket_templates SET
        name = COALESCE($1, name),
        description = $2,
        title_template = $3,
        description_template = $4,
        problem_type_id = $5,
        default_urgency = $6,
        default_blocking = $7,
        default_location_id = $8,
        profile_type = COALESCE($9, profile_type),
        min_level_required = COALESCE($10, min_level_required),
        is_active = COALESCE($11, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
      RETURNING *`,
      [
        name, description, title_template, description_template,
        problem_type_id || null, default_urgency || null, default_blocking || null,
        default_location_id || null, profile_type, min_level_required,
        is_active, id
      ]
    );

    res.json(rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Un template avec ce nom existe deja' });
    }
    console.error('Erreur modification template:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Supprimer un template
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = req;

    // Verifier que le template existe
    const { rows: existing } = await query(
      'SELECT * FROM ticket_templates WHERE id = $1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Template non trouve' });
    }

    // Verifier les permissions (createur ou admin)
    const isAdmin = user.account_type === 'admin' || user.account_type === 'admin_delegated';
    if (!isAdmin && existing[0].created_by !== user.id) {
      return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres templates' });
    }

    await query('DELETE FROM ticket_templates WHERE id = $1', [id]);

    res.json({ message: 'Template supprime' });
  } catch (error) {
    console.error('Erreur suppression template:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Admin: obtenir tous les templates d'une agence
router.get('/admin/agency/:agencyId', authenticate, async (req, res) => {
  try {
    const { user } = req;
    const { agencyId } = req.params;

    // Admin seulement
    if (user.account_type !== 'admin' && user.account_type !== 'admin_delegated') {
      return res.status(403).json({ error: 'Acces refuse' });
    }

    const { rows } = await query(
      `SELECT
        tt.*,
        pt.name AS problem_type_name,
        l.name AS location_name,
        u.first_name || ' ' || u.last_name AS created_by_name
      FROM ticket_templates tt
      LEFT JOIN problem_types pt ON tt.problem_type_id = pt.id
      LEFT JOIN locations l ON tt.default_location_id = l.id
      LEFT JOIN users u ON tt.created_by = u.id
      WHERE tt.agency_id = $1
      ORDER BY tt.created_at DESC`,
      [agencyId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Erreur recuperation templates admin:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
