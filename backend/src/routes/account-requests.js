const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, pool } = require('../config/database');
const { authenticate, requireAdmin } = require('../middlewares/auth');
const { sendEmail } = require('../services/email');

// POST /api/account-requests - Soumettre une demande de compte
router.post('/', async (req, res) => {
  try {
    const { email, first_name, last_name, phone, requested_agencies, message } = req.body;

    if (!email || !first_name || !last_name || !requested_agencies?.length) {
      return res.status(400).json({ error: 'Champs requis manquants' });
    }

    // Vérifier que l'email n'existe pas déjà
    const { rows: existingUser } = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    // Vérifier qu'il n'y a pas déjà une demande en attente
    const { rows: existingRequest } = await query(
      "SELECT id FROM access_requests WHERE email = $1 AND status = 'pending'",
      [email.toLowerCase()]
    );

    if (existingRequest.length > 0) {
      return res.status(409).json({ error: 'Une demande est déjà en cours pour cet email' });
    }

    // Créer la demande
    const { rows } = await query(
      `INSERT INTO access_requests (email, first_name, last_name, phone, requested_agencies, message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [
        email.toLowerCase(),
        first_name,
        last_name,
        phone || null,
        JSON.stringify(requested_agencies),
        message || null
      ]
    );

    // Notifier les admins (email)
    try {
      const { rows: admins } = await query(
        "SELECT email FROM users WHERE account_type IN ('admin', 'admin_delegated') AND is_active = true"
      );

      for (const admin of admins) {
        await sendEmail(admin.email, 'new_account_request', {
          first_name,
          last_name,
          email,
          requested_agencies
        });
      }
    } catch (emailErr) {
      console.error('Erreur notification admins:', emailErr);
    }

    res.status(201).json({
      message: 'Demande envoyée avec succès',
      request_id: rows[0].id
    });
  } catch (err) {
    console.error('Erreur création demande:', err);
    res.status(500).json({ error: 'Erreur lors de la création de la demande' });
  }
});

// GET /api/account-requests/status/:email - Vérifier le statut d'une demande
router.get('/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const { rows } = await query(
      `SELECT status, created_at, processed_at, rejection_reason
       FROM access_requests
       WHERE email = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email.toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Aucune demande trouvée' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur vérification statut:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification' });
  }
});

// ====================================
// ROUTES ADMIN
// ====================================

router.use(authenticate);
router.use(requireAdmin);

// GET /api/account-requests - Liste des demandes
router.get('/', async (req, res) => {
  try {
    const { status = 'pending', limit = 50, offset = 0 } = req.query;

    const { rows } = await query(
      `SELECT ar.*,
              u.first_name || ' ' || u.last_name as processed_by_name
       FROM access_requests ar
       LEFT JOIN users u ON ar.processed_by = u.id
       WHERE ($1 = 'all' OR ar.status = $1)
       ORDER BY ar.created_at DESC
       LIMIT $2 OFFSET $3`,
      [status, parseInt(limit), parseInt(offset)]
    );

    const { rows: countRows } = await query(
      "SELECT status, COUNT(*) as count FROM access_requests GROUP BY status"
    );

    const counts = countRows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, {});

    res.json({
      requests: rows,
      counts
    });
  } catch (err) {
    console.error('Erreur liste demandes:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/account-requests/:id - Détail d'une demande
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT ar.*,
              u.first_name || ' ' || u.last_name as processed_by_name
       FROM access_requests ar
       LEFT JOIN users u ON ar.processed_by = u.id
       WHERE ar.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée' });
    }

    // Récupérer les infos des agences demandées
    const request = rows[0];
    const agencyIds = request.requested_agencies.map(a => a.agency_id);

    if (agencyIds.length > 0) {
      const { rows: agencies } = await query(
        'SELECT id, name, code FROM agencies WHERE id = ANY($1)',
        [agencyIds]
      );

      request.agencies_info = agencies;
    }

    res.json(request);
  } catch (err) {
    console.error('Erreur détail demande:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// POST /api/account-requests/:id/approve - Approuver une demande
router.post('/:id/approve', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { agency_accesses } = req.body;

    await client.query('BEGIN');

    // Récupérer la demande
    const { rows: requestRows } = await client.query(
      "SELECT * FROM access_requests WHERE id = $1 AND status = 'pending'",
      [id]
    );

    if (requestRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Demande non trouvée ou déjà traitée' });
    }

    const request = requestRows[0];

    // Générer un mot de passe temporaire
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    // Créer l'utilisateur
    const { rows: userRows } = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, account_type, account_status, must_change_password, is_email_verified)
       VALUES ($1, $2, $3, $4, $5, 'user', 'active', true, true)
       RETURNING id`,
      [request.email, passwordHash, request.first_name, request.last_name, request.phone]
    );

    const userId = userRows[0].id;

    // Ajouter les accès aux agences
    const accesses = agency_accesses || request.requested_agencies;
    for (const access of accesses) {
      await client.query(
        `INSERT INTO user_agency_access (user_id, agency_id, hierarchy_level_id, access_type, profile_types)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          access.agency_id,
          access.hierarchy_level_id,
          access.access_type || 'full',
          JSON.stringify(access.profile_types || ['terrain'])
        ]
      );
    }

    // Mettre à jour la demande
    await client.query(
      `UPDATE access_requests
       SET status = 'approved', processed_by = $1, processed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [req.user.id, id]
    );

    await client.query('COMMIT');

    // Envoyer l'email de bienvenue
    try {
      await sendEmail(request.email, 'welcome', {
        first_name: request.first_name,
        email: request.email,
        temp_password: tempPassword
      });
    } catch (emailErr) {
      console.error('Erreur envoi email bienvenue:', emailErr);
    }

    // Logger l'action admin
    await query(
      `INSERT INTO admin_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'APPROVE_REQUEST', 'access_request', $2, $3, $4)`,
      [req.user.id, id, JSON.stringify({ user_id: userId }), req.ip]
    );

    res.json({
      message: 'Demande approuvée, compte créé',
      user_id: userId
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Erreur approbation:', err);
    res.status(500).json({ error: 'Erreur lors de l\'approbation' });
  } finally {
    client.release();
  }
});

// POST /api/account-requests/:id/reject - Rejeter une demande
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const { rows } = await query(
      `UPDATE access_requests
       SET status = 'rejected', processed_by = $1, processed_at = CURRENT_TIMESTAMP, rejection_reason = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING email, first_name`,
      [req.user.id, reason || null, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée ou déjà traitée' });
    }

    // Notifier le demandeur
    try {
      await sendEmail(rows[0].email, 'request_rejected', {
        first_name: rows[0].first_name,
        reason: reason || 'Aucune raison spécifiée'
      });
    } catch (emailErr) {
      console.error('Erreur notification rejet:', emailErr);
    }

    // Logger l'action admin
    await query(
      `INSERT INTO admin_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, 'REJECT_REQUEST', 'access_request', $2, $3, $4)`,
      [req.user.id, id, JSON.stringify({ reason }), req.ip]
    );

    res.json({ message: 'Demande rejetée' });
  } catch (err) {
    console.error('Erreur rejet:', err);
    res.status(500).json({ error: 'Erreur lors du rejet' });
  }
});

module.exports = router;
