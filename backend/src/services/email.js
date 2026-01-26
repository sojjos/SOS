const nodemailer = require('nodemailer');
const { query } = require('../config/database');

// Configuration du transporteur SMTP
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Adresse d'envoi noreply
const FROM_ADDRESS = process.env.EMAIL_FROM || 'noreply@sos.local';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'SOS - Short Operational Summary';

// Templates d'emails
const templates = {
  ticket_created: {
    subject: '[SOS] Nouveau ticket #{reference}',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2196F3; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Short Operational Summary</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>Nouveau ticket créé</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px;">
            <p><strong>Référence:</strong> ${data.reference}</p>
            <p><strong>Titre:</strong> ${data.title}</p>
            <p><strong>Type:</strong> ${data.problem_type}</p>
            <p><strong>Lieu:</strong> ${data.location}</p>
            <p><strong>Urgence proposée:</strong> ${data.proposed_urgency}</p>
            <p><strong>Créé par:</strong> ${data.creator_name}</p>
            <p><strong>Agence:</strong> ${data.agency_name}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/tickets/${data.ticket_id}"
               style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Voir le ticket
            </a>
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  },

  ticket_assigned: {
    subject: '[SOS] Ticket #{reference} vous a été assigné',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Ticket assigné</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>Un ticket vous a été assigné</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px;">
            <p><strong>Référence:</strong> ${data.reference}</p>
            <p><strong>Titre:</strong> ${data.title}</p>
            <p><strong>Urgence:</strong> <span style="color: ${getUrgencyColor(data.urgency)}; font-weight: bold;">${data.urgency.toUpperCase()}</span></p>
            <p><strong>SLA Réponse:</strong> ${data.response_deadline}</p>
            <p><strong>SLA Résolution:</strong> ${data.resolution_deadline}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/tickets/${data.ticket_id}"
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Prendre en charge
            </a>
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  },

  ticket_escalated: {
    subject: '[SOS] Ticket #{reference} escaladé - Action requise',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FF9800; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Escalade de ticket</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>⚠️ Ticket escaladé</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px;">
            <p><strong>Référence:</strong> ${data.reference}</p>
            <p><strong>Titre:</strong> ${data.title}</p>
            <p><strong>Escaladé de:</strong> Niveau ${data.from_level}</p>
            <p><strong>Vers:</strong> Niveau ${data.to_level}</p>
            <p><strong>Raison:</strong> ${data.reason || 'Non spécifiée'}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/tickets/${data.ticket_id}"
               style="background-color: #FF9800; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Voir le ticket
            </a>
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  },

  ticket_resolved: {
    subject: '[SOS] Ticket #{reference} résolu',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Ticket résolu</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>✅ Ticket résolu</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px;">
            <p><strong>Référence:</strong> ${data.reference}</p>
            <p><strong>Titre:</strong> ${data.title}</p>
            <p><strong>Résolu par:</strong> ${data.resolved_by}</p>
            <p><strong>Solution:</strong> ${data.resolution_notes || 'Voir le ticket pour plus de détails'}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/tickets/${data.ticket_id}"
               style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Voir le ticket
            </a>
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  },

  sla_warning: {
    subject: '[SOS] ⚠️ Attention SLA - Ticket #{reference}',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #FF5722; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Alerte SLA</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>⚠️ SLA bientôt dépassé</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px; border-left: 4px solid #FF5722;">
            <p><strong>Référence:</strong> ${data.reference}</p>
            <p><strong>Titre:</strong> ${data.title}</p>
            <p><strong>Type d'alerte:</strong> ${data.sla_type === 'response' ? 'Temps de réponse' : 'Temps de résolution'}</p>
            <p><strong>Échéance:</strong> <span style="color: #FF5722; font-weight: bold;">${data.deadline}</span></p>
            <p><strong>Temps restant:</strong> ${data.time_remaining}</p>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/tickets/${data.ticket_id}"
               style="background-color: #FF5722; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Traiter immédiatement
            </a>
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  },

  comment_added: {
    subject: '[SOS] Nouveau commentaire sur le ticket #{reference}',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2196F3; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Nouveau commentaire</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>💬 Nouveau commentaire</h2>
          <div style="background-color: white; padding: 15px; border-radius: 5px;">
            <p><strong>Ticket:</strong> ${data.reference} - ${data.title}</p>
            <p><strong>Par:</strong> ${data.author_name}</p>
            <div style="background-color: #f9f9f9; padding: 10px; margin-top: 10px; border-left: 3px solid #2196F3;">
              ${data.comment_preview}
            </div>
          </div>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/tickets/${data.ticket_id}"
               style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Voir le ticket
            </a>
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  },

  welcome: {
    subject: '[SOS] Bienvenue - Votre compte a été créé',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2196F3; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Short Operational Summary</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>Bienvenue ${data.first_name} !</h2>
          <p>Votre compte SOS a été créé avec succès.</p>
          <div style="background-color: white; padding: 15px; border-radius: 5px;">
            <p><strong>Email:</strong> ${data.email}</p>
            <p><strong>Mot de passe temporaire:</strong> ${data.temp_password}</p>
          </div>
          <p style="color: #FF5722; margin-top: 15px;">
            <strong>⚠️ Important:</strong> Vous devrez changer votre mot de passe lors de votre première connexion.
          </p>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/login"
               style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Se connecter
            </a>
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  },

  password_reset: {
    subject: '[SOS] Réinitialisation de votre mot de passe',
    html: (data) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2196F3; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">SOS</h1>
          <p style="margin: 5px 0 0;">Réinitialisation du mot de passe</p>
        </div>
        <div style="padding: 20px; background-color: #f5f5f5;">
          <h2>Réinitialisation demandée</h2>
          <p>Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.</p>
          <p style="margin-top: 20px;">
            <a href="${process.env.FRONTEND_URL}/reset-password?token=${data.reset_token}"
               style="background-color: #2196F3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Réinitialiser mon mot de passe
            </a>
          </p>
          <p style="color: #666; margin-top: 20px; font-size: 14px;">
            Ce lien expire dans 24 heures. Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
          </p>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>Cet email a été envoyé automatiquement. Merci de ne pas y répondre.</p>
        </div>
      </div>
    `
  }
};

// Fonction utilitaire pour les couleurs d'urgence
function getUrgencyColor(urgency) {
  const colors = {
    critique: '#dc3545',
    haute: '#fd7e14',
    moyenne: '#ffc107',
    basse: '#28a745'
  };
  return colors[urgency] || '#6c757d';
}

// Fonction principale d'envoi d'email
async function sendEmail(to, templateName, data) {
  try {
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template email inconnu: ${templateName}`);
    }

    // Préparer le sujet avec les variables
    let subject = template.subject;
    if (data.reference) {
      subject = subject.replace('{reference}', data.reference);
    }

    // Préparer les options d'email avec headers noreply
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_ADDRESS}>`,
      to: to,
      subject: subject,
      html: template.html(data),
      headers: {
        'X-Auto-Response-Suppress': 'All',
        'Auto-Submitted': 'auto-generated',
        'Precedence': 'bulk',
        'X-Mailer': 'SOS Notification System'
      },
      replyTo: FROM_ADDRESS
    };

    // Envoyer l'email
    const info = await transporter.sendMail(mailOptions);

    // Logger l'envoi dans la base de données
    await logEmailSent(to, templateName, subject, info.messageId, 'sent');

    console.log(`📧 Email envoyé: ${templateName} -> ${to}`);
    return { success: true, messageId: info.messageId };

  } catch (err) {
    console.error(`❌ Erreur envoi email ${templateName}:`, err);

    // Logger l'échec
    await logEmailSent(to, templateName, '', null, 'failed', err.message);

    return { success: false, error: err.message };
  }
}

// Logger les emails envoyés
async function logEmailSent(recipient, templateName, subject, messageId, status, errorMessage = null) {
  try {
    await query(
      `INSERT INTO email_logs (recipient, template, subject, message_id, status, error_message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [recipient, templateName, subject, messageId, status, errorMessage]
    );
  } catch (err) {
    console.error('Erreur log email:', err);
  }
}

// Fonction pour envoyer à plusieurs destinataires
async function sendEmailToMany(recipients, templateName, data) {
  const results = [];
  for (const recipient of recipients) {
    const result = await sendEmail(recipient, templateName, data);
    results.push({ recipient, ...result });
  }
  return results;
}

// Fonction pour vérifier les préférences utilisateur avant envoi
async function sendEmailWithPreferences(userId, templateName, data) {
  try {
    const { rows } = await query(
      'SELECT email, notification_preferences FROM users WHERE id = $1 AND is_active = true',
      [userId]
    );

    if (rows.length === 0) return null;

    const user = rows[0];
    const prefs = user.notification_preferences || {};

    // Mapper les templates aux préférences
    const prefMapping = {
      ticket_created: 'email_new_ticket',
      ticket_assigned: 'email_ticket_assigned',
      ticket_escalated: 'email_ticket_escalated',
      ticket_resolved: 'email_ticket_resolved',
      comment_added: 'email_comment_added',
      sla_warning: 'email_sla_warning'
    };

    const prefKey = prefMapping[templateName];

    // Vérifier si l'utilisateur a activé ce type de notification (par défaut: oui)
    if (prefKey && prefs[prefKey] === false) {
      console.log(`📧 Email ${templateName} ignoré pour ${user.email} (préférence désactivée)`);
      return null;
    }

    return await sendEmail(user.email, templateName, data);

  } catch (err) {
    console.error('Erreur envoi email avec préférences:', err);
    return null;
  }
}

// Vérifier la connexion SMTP au démarrage
async function verifyConnection() {
  try {
    await transporter.verify();
    console.log('✅ Connexion SMTP vérifiée');
    return true;
  } catch (err) {
    console.error('❌ Erreur connexion SMTP:', err);
    return false;
  }
}

module.exports = {
  sendEmail,
  sendEmailToMany,
  sendEmailWithPreferences,
  verifyConnection,
  templates
};
