const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const sharp = require('sharp');
const { query } = require('../config/database');
const { authenticate, requireAgencyAccess } = require('../middlewares/auth');

// Configuration du stockage
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB par défaut
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

// Créer les dossiers nécessaires
const ensureUploadDirs = async () => {
  const dirs = [
    UPLOAD_DIR,
    path.join(UPLOAD_DIR, 'tickets'),
    path.join(UPLOAD_DIR, 'comments'),
    path.join(UPLOAD_DIR, 'thumbnails')
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
};

ensureUploadDirs();

// Configuration multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subdir = req.body.ticket_id ? 'tickets' : 'comments';
    cb(null, path.join(UPLOAD_DIR, subdir));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Type de fichier non autorisé: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5 // Maximum 5 fichiers par upload
  }
});

// Middleware d'authentification
router.use(authenticate);

// POST /api/uploads - Upload de fichiers
router.post('/', upload.array('files', 5), async (req, res) => {
  try {
    const { ticket_id, comment_id } = req.body;

    if (!ticket_id && !comment_id) {
      // Supprimer les fichiers uploadés
      for (const file of req.files) {
        await fs.unlink(file.path).catch(() => {});
      }
      return res.status(400).json({ error: 'ticket_id ou comment_id requis' });
    }

    // Vérifier l'accès au ticket
    if (ticket_id) {
      const { rows: ticket } = await query(
        'SELECT agency_id FROM tickets WHERE id = $1',
        [ticket_id]
      );

      if (ticket.length === 0) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(() => {});
        }
        return res.status(404).json({ error: 'Ticket non trouvé' });
      }

      // Vérifier l'accès à l'agence
      const hasAccess = req.user.agency_accesses?.some(
        a => a.agency_id === ticket[0].agency_id
      );

      if (!hasAccess && !['admin', 'admin_delegated'].includes(req.user.account_type)) {
        for (const file of req.files) {
          await fs.unlink(file.path).catch(() => {});
        }
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
    }

    const attachments = [];

    for (const file of req.files) {
      const isImage = file.mimetype.startsWith('image/');
      let thumbnailPath = null;

      // Générer une miniature pour les images
      if (isImage) {
        try {
          const thumbFilename = `thumb-${path.basename(file.filename)}`;
          thumbnailPath = path.join(UPLOAD_DIR, 'thumbnails', thumbFilename);

          await sharp(file.path)
            .resize(200, 200, {
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ quality: 80 })
            .toFile(thumbnailPath);

          thumbnailPath = `/uploads/thumbnails/${thumbFilename}`;
        } catch (err) {
          console.error('Erreur génération miniature:', err);
          thumbnailPath = null;
        }
      }

      // Insérer en base
      const { rows } = await query(
        `INSERT INTO attachments
         (ticket_id, comment_id, original_name, stored_name, mime_type, file_size, file_path, uploaded_by, is_image, thumbnail_path)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          ticket_id || null,
          comment_id || null,
          file.originalname,
          file.filename,
          file.mimetype,
          file.size,
          `/uploads/${ticket_id ? 'tickets' : 'comments'}/${file.filename}`,
          req.user.id,
          isImage,
          thumbnailPath
        ]
      );

      attachments.push(rows[0]);
    }

    // Logger dans l'historique du ticket si applicable
    if (ticket_id) {
      await query(
        `INSERT INTO ticket_history (ticket_id, user_id, action, details)
         VALUES ($1, $2, 'attachment_added', $3)`,
        [ticket_id, req.user.id, JSON.stringify({
          count: attachments.length,
          files: attachments.map(a => a.original_name)
        })]
      );
    }

    res.status(201).json({
      message: `${attachments.length} fichier(s) uploadé(s)`,
      attachments
    });

  } catch (err) {
    console.error('Erreur upload:', err);

    // Nettoyer les fichiers en cas d'erreur
    if (req.files) {
      for (const file of req.files) {
        await fs.unlink(file.path).catch(() => {});
      }
    }

    res.status(500).json({ error: 'Erreur lors de l\'upload' });
  }
});

// GET /api/uploads/ticket/:ticketId - Récupérer les pièces jointes d'un ticket
router.get('/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Vérifier l'accès
    const { rows: ticket } = await query(
      'SELECT agency_id FROM tickets WHERE id = $1',
      [ticketId]
    );

    if (ticket.length === 0) {
      return res.status(404).json({ error: 'Ticket non trouvé' });
    }

    const { rows } = await query(
      `SELECT a.*, u.first_name || ' ' || u.last_name as uploaded_by_name
       FROM attachments a
       JOIN users u ON a.uploaded_by = u.id
       WHERE a.ticket_id = $1
       ORDER BY a.created_at DESC`,
      [ticketId]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur récupération attachments:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// GET /api/uploads/:id/download - Télécharger un fichier
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT a.*, t.agency_id
       FROM attachments a
       LEFT JOIN tickets t ON a.ticket_id = t.id
       WHERE a.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const attachment = rows[0];

    // Vérifier l'accès à l'agence
    if (attachment.agency_id) {
      const hasAccess = req.user.agency_accesses?.some(
        a => a.agency_id === attachment.agency_id
      );

      if (!hasAccess && !['admin', 'admin_delegated'].includes(req.user.account_type)) {
        return res.status(403).json({ error: 'Accès non autorisé' });
      }
    }

    const filePath = path.join(UPLOAD_DIR, '..', attachment.file_path);

    // Vérifier que le fichier existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Fichier non trouvé sur le serveur' });
    }

    res.download(filePath, attachment.original_name);

  } catch (err) {
    console.error('Erreur téléchargement:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement' });
  }
});

// DELETE /api/uploads/:id - Supprimer un fichier (admin ou uploadeur)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      'SELECT * FROM attachments WHERE id = $1',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const attachment = rows[0];

    // Vérifier les permissions (admin ou uploadeur)
    if (attachment.uploaded_by !== req.user.id &&
        !['admin', 'admin_delegated'].includes(req.user.account_type)) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    // Supprimer le fichier physique
    const filePath = path.join(UPLOAD_DIR, '..', attachment.file_path);
    await fs.unlink(filePath).catch(() => {});

    // Supprimer la miniature si présente
    if (attachment.thumbnail_path) {
      const thumbPath = path.join(UPLOAD_DIR, '..', attachment.thumbnail_path);
      await fs.unlink(thumbPath).catch(() => {});
    }

    // Supprimer de la base
    await query('DELETE FROM attachments WHERE id = $1', [id]);

    // Logger
    if (attachment.ticket_id) {
      await query(
        `INSERT INTO ticket_history (ticket_id, user_id, action, details)
         VALUES ($1, $2, 'attachment_deleted', $3)`,
        [attachment.ticket_id, req.user.id, JSON.stringify({
          filename: attachment.original_name
        })]
      );
    }

    res.json({ message: 'Fichier supprimé' });

  } catch (err) {
    console.error('Erreur suppression:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// Gestion des erreurs multer
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `Fichier trop volumineux. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Trop de fichiers. Maximum: 5 fichiers par upload'
      });
    }
    return res.status(400).json({ error: err.message });
  }

  if (err.message && err.message.includes('Type de fichier')) {
    return res.status(400).json({ error: err.message });
  }

  next(err);
});

module.exports = router;
