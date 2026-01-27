const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs').promises;
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { query } = require('../config/database');
const { authenticate } = require('../middlewares/auth');

const EXPORT_DIR = process.env.EXPORT_DIR || './exports';
const EXPORT_EXPIRY_HOURS = 24;

// Créer le dossier d'exports
const ensureExportDir = async () => {
  try {
    await fs.mkdir(EXPORT_DIR, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
};
ensureExportDir();

router.use(authenticate);

// Vérifier les permissions d'export
const checkExportPermission = async (req, res, next) => {
  try {
    const { agency_id, export_type } = req.body || req.query;

    // Admin a tous les droits
    if (['admin', 'admin_delegated'].includes(req.user.account_type)) {
      return next();
    }

    // Vérifier les permissions spécifiques
    const access = req.user.agency_accesses?.find(a => a.agency_id === agency_id);
    if (!access) {
      return res.status(403).json({ error: 'Accès non autorisé à cette agence' });
    }

    // Vérifier les permissions d'export pour ce niveau
    const { rows } = await query(
      `SELECT * FROM export_permissions
       WHERE agency_id = $1 AND hierarchy_level_id = $2`,
      [agency_id, access.hierarchy_level_id]
    );

    if (rows.length === 0) {
      return res.status(403).json({ error: 'Export non autorisé pour votre niveau' });
    }

    const permissions = rows[0];
    const permissionMap = {
      tickets: 'can_export_tickets',
      stats: 'can_export_stats',
      users: 'can_export_users',
      audit: 'can_export_audit'
    };

    if (!permissions[permissionMap[export_type]]) {
      return res.status(403).json({ error: 'Export de ce type non autorisé' });
    }

    req.exportPermissions = permissions;
    next();
  } catch (err) {
    console.error('Erreur vérification permission export:', err);
    res.status(500).json({ error: 'Erreur de vérification des permissions' });
  }
};

// POST /api/exports/tickets - Exporter des tickets
router.post('/tickets', checkExportPermission, async (req, res) => {
  try {
    const { agency_id, format, filters = {} } = req.body;

    if (!agency_id || !format) {
      return res.status(400).json({ error: 'agency_id et format requis' });
    }

    if (!['excel', 'csv', 'pdf'].includes(format)) {
      return res.status(400).json({ error: 'Format non supporté' });
    }

    // Créer l'entrée d'export
    const { rows: exportRows } = await query(
      `INSERT INTO export_requests (user_id, agency_id, export_type, format, filters, expires_at)
       VALUES ($1, $2, 'tickets', $3, $4, CURRENT_TIMESTAMP + INTERVAL '${EXPORT_EXPIRY_HOURS} hours')
       RETURNING id`,
      [req.user.id, agency_id, format, JSON.stringify(filters)]
    );

    const exportId = exportRows[0].id;

    // Récupérer les tickets
    let sql = `
      SELECT
        t.ticket_number,
        t.title,
        pt.name as problem_type,
        l.name as location,
        t.validated_urgency as urgency,
        t.validated_blocking as blocking,
        t.status,
        t.recurrence,
        t.created_at,
        t.validated_at,
        t.resolved_at,
        t.closed_at,
        u_created.first_name || ' ' || u_created.last_name as created_by,
        u_resp.first_name || ' ' || u_resp.last_name as responsible,
        CASE WHEN t.resolved_at <= t.sla_resolution_deadline THEN 'Oui' ELSE 'Non' END as sla_respected
      FROM tickets t
      LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
      LEFT JOIN locations l ON t.primary_location_id = l.id
      LEFT JOIN users u_created ON t.created_by = u_created.id
      LEFT JOIN users u_resp ON t.current_responsible = u_resp.id
      WHERE t.agency_id = $1
    `;
    const params = [agency_id];
    let paramIndex = 2;

    if (filters.status) {
      sql += ` AND t.status = $${paramIndex++}`;
      params.push(filters.status);
    }
    if (filters.urgency) {
      sql += ` AND t.validated_urgency = $${paramIndex++}`;
      params.push(filters.urgency);
    }
    if (filters.date_from) {
      sql += ` AND t.created_at >= $${paramIndex++}`;
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ` AND t.created_at <= $${paramIndex++}`;
      params.push(filters.date_to);
    }

    // Limiter le nombre de lignes
    const maxRecords = req.exportPermissions?.max_records || 1000;
    sql += ` ORDER BY t.created_at DESC LIMIT ${maxRecords}`;

    const { rows: tickets } = await query(sql, params);

    // Générer le fichier
    let filePath;
    let fileSize;

    if (format === 'excel' || format === 'csv') {
      const result = await generateExcel(tickets, exportId, format === 'csv');
      filePath = result.filePath;
      fileSize = result.fileSize;
    } else if (format === 'pdf') {
      const result = await generateTicketsPDF(tickets, exportId, agency_id);
      filePath = result.filePath;
      fileSize = result.fileSize;
    }

    // Mettre à jour l'export
    await query(
      `UPDATE export_requests
       SET status = 'completed', file_path = $1, file_size = $2, completed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [filePath, fileSize, exportId]
    );

    res.json({
      export_id: exportId,
      download_url: `/api/exports/${exportId}/download`,
      expires_at: new Date(Date.now() + EXPORT_EXPIRY_HOURS * 3600000)
    });
  } catch (err) {
    console.error('Erreur export tickets:', err);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// POST /api/exports/stats - Exporter des statistiques
router.post('/stats', checkExportPermission, async (req, res) => {
  try {
    const { agency_id, format, period = '30days' } = req.body;

    if (!agency_id || !format) {
      return res.status(400).json({ error: 'agency_id et format requis' });
    }

    // Créer l'entrée d'export
    const { rows: exportRows } = await query(
      `INSERT INTO export_requests (user_id, agency_id, export_type, format, filters, expires_at)
       VALUES ($1, $2, 'stats', $3, $4, CURRENT_TIMESTAMP + INTERVAL '${EXPORT_EXPIRY_HOURS} hours')
       RETURNING id`,
      [req.user.id, agency_id, format, JSON.stringify({ period })]
    );

    const exportId = exportRows[0].id;

    // Calculer les dates
    const periodDays = parseInt(period) || 30;
    const dateFrom = new Date(Date.now() - periodDays * 24 * 3600000);

    // Récupérer les statistiques
    const stats = await getAgencyStats(agency_id, dateFrom);

    // Générer le fichier
    let filePath, fileSize;

    if (format === 'pdf') {
      const result = await generateStatsPDF(stats, exportId, agency_id);
      filePath = result.filePath;
      fileSize = result.fileSize;
    } else {
      const result = await generateStatsExcel(stats, exportId);
      filePath = result.filePath;
      fileSize = result.fileSize;
    }

    // Mettre à jour l'export
    await query(
      `UPDATE export_requests
       SET status = 'completed', file_path = $1, file_size = $2, completed_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [filePath, fileSize, exportId]
    );

    res.json({
      export_id: exportId,
      download_url: `/api/exports/${exportId}/download`,
      expires_at: new Date(Date.now() + EXPORT_EXPIRY_HOURS * 3600000)
    });
  } catch (err) {
    console.error('Erreur export stats:', err);
    res.status(500).json({ error: 'Erreur lors de l\'export' });
  }
});

// GET /api/exports/:id/download - Télécharger un export
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await query(
      `SELECT * FROM export_requests
       WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
      [id, req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Export non trouvé' });
    }

    const exportData = rows[0];

    if (new Date(exportData.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Export expiré' });
    }

    const filePath = path.join(EXPORT_DIR, path.basename(exportData.file_path));

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Fichier non trouvé' });
    }

    const ext = path.extname(filePath).slice(1);
    const mimeTypes = {
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      pdf: 'application/pdf'
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="export-${id}.${ext}"`);

    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Erreur téléchargement export:', err);
    res.status(500).json({ error: 'Erreur lors du téléchargement' });
  }
});

// GET /api/exports - Liste des exports de l'utilisateur
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, export_type, format, status, created_at, completed_at, expires_at, file_size
       FROM export_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('Erreur liste exports:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération' });
  }
});

// ====================================
// FONCTIONS DE GÉNÉRATION
// ====================================

async function generateExcel(data, exportId, isCsv = false) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Tickets');

  // En-têtes
  worksheet.columns = [
    { header: 'N°', key: 'ticket_number', width: 10 },
    { header: 'Titre', key: 'title', width: 40 },
    { header: 'Type', key: 'problem_type', width: 20 },
    { header: 'Lieu', key: 'location', width: 20 },
    { header: 'Urgence', key: 'urgency', width: 12 },
    { header: 'Blocage', key: 'blocking', width: 15 },
    { header: 'Statut', key: 'status', width: 15 },
    { header: 'Récurrence', key: 'recurrence', width: 12 },
    { header: 'Créé le', key: 'created_at', width: 18 },
    { header: 'Créé par', key: 'created_by', width: 20 },
    { header: 'Responsable', key: 'responsible', width: 20 },
    { header: 'Résolu le', key: 'resolved_at', width: 18 },
    { header: 'SLA respecté', key: 'sla_respected', width: 12 }
  ];

  // Style des en-têtes
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF2196F3' }
  };
  worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Données
  data.forEach(row => {
    worksheet.addRow({
      ...row,
      created_at: row.created_at ? new Date(row.created_at).toLocaleString('fr-FR') : '',
      resolved_at: row.resolved_at ? new Date(row.resolved_at).toLocaleString('fr-FR') : ''
    });
  });

  const ext = isCsv ? 'csv' : 'xlsx';
  const fileName = `tickets-${exportId}.${ext}`;
  const filePath = path.join(EXPORT_DIR, fileName);

  if (isCsv) {
    await workbook.csv.writeFile(filePath);
  } else {
    await workbook.xlsx.writeFile(filePath);
  }

  const stats = await fs.stat(filePath);

  return { filePath: fileName, fileSize: stats.size };
}

async function generateTicketsPDF(tickets, exportId, agencyId) {
  return new Promise(async (resolve, reject) => {
    try {
      // Récupérer le nom de l'agence
      const { rows: agencyRows } = await query(
        'SELECT name FROM agencies WHERE id = $1',
        [agencyId]
      );
      const agencyName = agencyRows[0]?.name || 'Agence';

      const fileName = `tickets-${exportId}.pdf`;
      const filePath = path.join(EXPORT_DIR, fileName);

      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
      const writeStream = require('fs').createWriteStream(filePath);

      doc.pipe(writeStream);

      // En-tête
      doc.fontSize(20).text('SOS - Export Tickets', { align: 'center' });
      doc.fontSize(12).text(agencyName, { align: 'center' });
      doc.fontSize(10).text(`Généré le ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });
      doc.moveDown(2);

      // Tableau
      const tableTop = doc.y;
      const columns = [
        { header: 'N°', width: 40 },
        { header: 'Titre', width: 150 },
        { header: 'Type', width: 80 },
        { header: 'Urgence', width: 60 },
        { header: 'Statut', width: 70 },
        { header: 'Créé le', width: 80 },
        { header: 'Résolu le', width: 80 },
        { header: 'SLA', width: 40 }
      ];

      let xPos = 40;

      // En-têtes du tableau
      doc.fontSize(9).font('Helvetica-Bold');
      columns.forEach(col => {
        doc.text(col.header, xPos, tableTop, { width: col.width });
        xPos += col.width;
      });

      doc.moveTo(40, tableTop + 15).lineTo(760, tableTop + 15).stroke();

      // Lignes de données
      let yPos = tableTop + 20;
      doc.font('Helvetica').fontSize(8);

      tickets.slice(0, 50).forEach(ticket => { // Limiter à 50 pour le PDF
        if (yPos > 520) {
          doc.addPage();
          yPos = 40;
        }

        xPos = 40;
        const rowData = [
          ticket.ticket_number?.toString() || '',
          (ticket.title || '').substring(0, 30),
          (ticket.problem_type || '').substring(0, 15),
          ticket.urgency || '',
          ticket.status || '',
          ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('fr-FR') : '',
          ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleDateString('fr-FR') : '',
          ticket.sla_respected || ''
        ];

        columns.forEach((col, i) => {
          doc.text(rowData[i], xPos, yPos, { width: col.width });
          xPos += col.width;
        });

        yPos += 15;
      });

      // Pied de page
      doc.fontSize(8).text(
        `Total: ${tickets.length} tickets`,
        40, 560,
        { align: 'right' }
      );

      doc.end();

      writeStream.on('finish', async () => {
        const stats = await fs.stat(filePath);
        resolve({ filePath: fileName, fileSize: stats.size });
      });

      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function getAgencyStats(agencyId, dateFrom) {
  const { rows: general } = await query(
    `SELECT
       COUNT(*) as total,
       COUNT(CASE WHEN status IN ('resolu', 'cloture') THEN 1 END) as resolved,
       COUNT(CASE WHEN validated_urgency = 'critique' THEN 1 END) as critical,
       ROUND(AVG(CASE WHEN resolved_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400
       END)::numeric, 2) as avg_resolution_days
     FROM tickets
     WHERE agency_id = $1 AND created_at >= $2`,
    [agencyId, dateFrom]
  );

  const { rows: byType } = await query(
    `SELECT pt.name, COUNT(*) as count
     FROM tickets t
     JOIN problem_types pt ON t.problem_type_id = pt.id
     WHERE t.agency_id = $1 AND t.created_at >= $2
     GROUP BY pt.name ORDER BY count DESC`,
    [agencyId, dateFrom]
  );

  const { rows: byUrgency } = await query(
    `SELECT validated_urgency, COUNT(*) as count
     FROM tickets
     WHERE agency_id = $1 AND created_at >= $2 AND validated_urgency IS NOT NULL
     GROUP BY validated_urgency`,
    [agencyId, dateFrom]
  );

  const { rows: byStatus } = await query(
    `SELECT status, COUNT(*) as count
     FROM tickets
     WHERE agency_id = $1 AND created_at >= $2
     GROUP BY status`,
    [agencyId, dateFrom]
  );

  return {
    general: general[0],
    byType,
    byUrgency,
    byStatus
  };
}

async function generateStatsExcel(stats, exportId) {
  const workbook = new ExcelJS.Workbook();

  // Feuille résumé
  const summarySheet = workbook.addWorksheet('Résumé');
  summarySheet.addRow(['Statistiques générales']);
  summarySheet.addRow(['Total tickets', stats.general.total]);
  summarySheet.addRow(['Tickets résolus', stats.general.resolved]);
  summarySheet.addRow(['Tickets critiques', stats.general.critical]);
  summarySheet.addRow(['Temps moyen de résolution (jours)', stats.general.avg_resolution_days]);

  // Feuille par type
  const typeSheet = workbook.addWorksheet('Par type');
  typeSheet.addRow(['Type', 'Nombre']);
  stats.byType.forEach(row => typeSheet.addRow([row.name, row.count]));

  // Feuille par urgence
  const urgencySheet = workbook.addWorksheet('Par urgence');
  urgencySheet.addRow(['Urgence', 'Nombre']);
  stats.byUrgency.forEach(row => urgencySheet.addRow([row.validated_urgency, row.count]));

  const fileName = `stats-${exportId}.xlsx`;
  const filePath = path.join(EXPORT_DIR, fileName);
  await workbook.xlsx.writeFile(filePath);

  const fileStats = await fs.stat(filePath);
  return { filePath: fileName, fileSize: fileStats.size };
}

async function generateStatsPDF(stats, exportId, agencyId) {
  return new Promise(async (resolve, reject) => {
    try {
      const { rows: agencyRows } = await query(
        'SELECT name FROM agencies WHERE id = $1',
        [agencyId]
      );
      const agencyName = agencyRows[0]?.name || 'Agence';

      const fileName = `stats-${exportId}.pdf`;
      const filePath = path.join(EXPORT_DIR, fileName);

      const doc = new PDFDocument({ margin: 50 });
      const writeStream = require('fs').createWriteStream(filePath);

      doc.pipe(writeStream);

      // Titre
      doc.fontSize(24).text('SOS - Rapport Statistiques', { align: 'center' });
      doc.fontSize(14).text(agencyName, { align: 'center' });
      doc.fontSize(10).text(`Généré le ${new Date().toLocaleString('fr-FR')}`, { align: 'center' });
      doc.moveDown(2);

      // Résumé
      doc.fontSize(16).text('Résumé', { underline: true });
      doc.moveDown();
      doc.fontSize(12);
      doc.text(`Total tickets: ${stats.general.total}`);
      doc.text(`Tickets résolus: ${stats.general.resolved}`);
      doc.text(`Tickets critiques: ${stats.general.critical}`);
      doc.text(`Temps moyen de résolution: ${stats.general.avg_resolution_days || 'N/A'} jours`);
      doc.moveDown(2);

      // Par type
      doc.fontSize(16).text('Par type de problème', { underline: true });
      doc.moveDown();
      doc.fontSize(10);
      stats.byType.forEach(row => {
        doc.text(`• ${row.name}: ${row.count}`);
      });
      doc.moveDown(2);

      // Par urgence
      doc.fontSize(16).text('Par niveau d\'urgence', { underline: true });
      doc.moveDown();
      doc.fontSize(10);
      stats.byUrgency.forEach(row => {
        doc.text(`• ${row.validated_urgency}: ${row.count}`);
      });

      doc.end();

      writeStream.on('finish', async () => {
        const fileStats = await fs.stat(filePath);
        resolve({ filePath: fileName, fileSize: fileStats.size });
      });

      writeStream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = router;
