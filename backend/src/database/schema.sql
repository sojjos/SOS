-- ====================================
-- SOS - Schéma de Base de Données Unifié
-- Version: 1.0.0
-- ====================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================
-- TABLES PRINCIPALES
-- ====================================

-- Table des agences/sites
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    address TEXT,
    city VARCHAR(100),
    country VARCHAR(50) DEFAULT 'Belgique',
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des niveaux hiérarchiques (par agence)
CREATE TABLE IF NOT EXISTS hierarchy_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    level_number INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '{}',
    escalates_to_level INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id, level_number)
);

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('admin', 'admin_delegated', 'user')),
    account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected')),
    is_active BOOLEAN DEFAULT true,
    is_email_verified BOOLEAN DEFAULT false,
    must_change_password BOOLEAN DEFAULT false,
    notification_preferences JSONB DEFAULT '{}',
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP WITH TIME ZONE,
    password_reset_token VARCHAR(255),
    password_reset_expires TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des accès utilisateur par agence
CREATE TABLE IF NOT EXISTS user_agency_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    hierarchy_level_id UUID REFERENCES hierarchy_levels(id) ON DELETE SET NULL,
    access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('full', 'monitoring')),
    profile_types JSONB DEFAULT '["terrain"]',
    is_union_member BOOLEAN DEFAULT false,
    is_inter_site BOOLEAN DEFAULT false,
    union_view_only BOOLEAN DEFAULT false,
    can_see_confidential BOOLEAN DEFAULT false,
    allowed_locations UUID[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, agency_id)
);

-- Table des demandes d'accès
CREATE TABLE IF NOT EXISTS access_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    requested_agencies JSONB NOT NULL,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    processed_by UUID REFERENCES users(id),
    processed_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_access_requests_status ON access_requests(status);

-- Table des lieux (par agence)
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    location_type VARCHAR(50) NOT NULL CHECK (location_type IN ('terrain', 'administratif', 'commun', 'exterieur')),
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id, name)
);

-- Table des types de problèmes (par agence)
CREATE TABLE IF NOT EXISTS problem_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#6c757d',
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    -- Niveau minimum requis pour creer ce type de ticket (0 = tout le monde, 1+ = niveaux superieurs)
    min_level_required INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id, name)
);

-- Table des SLA (par agence)
CREATE TABLE IF NOT EXISTS sla_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    urgency VARCHAR(20) NOT NULL CHECK (urgency IN ('critique', 'haute', 'moyenne', 'basse')),
    blocking_level VARCHAR(20) NOT NULL CHECK (blocking_level IN ('bloquant', 'partiel', 'non_bloquant')),
    response_time_hours INTEGER NOT NULL,
    resolution_time_hours INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agency_id, urgency, blocking_level)
);

-- Table des tickets
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number SERIAL,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

    -- Informations de base
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    problem_type_id UUID REFERENCES problem_types(id),
    recurrence VARCHAR(20) CHECK (recurrence IN ('ponctuel', 'recurrent', 'routinier')),
    recurrence_details JSONB,

    -- Localisation
    primary_location_id UUID REFERENCES locations(id),
    location_details TEXT,
    impacted_locations JSONB DEFAULT '[]',

    -- Classification proposée (par créateur)
    proposed_urgency VARCHAR(20) CHECK (proposed_urgency IN ('critique', 'haute', 'moyenne', 'basse')),
    proposed_blocking VARCHAR(20) CHECK (proposed_blocking IN ('bloquant', 'partiel', 'non_bloquant')),

    -- Classification validée (par supérieur)
    validated_urgency VARCHAR(20) CHECK (validated_urgency IN ('critique', 'haute', 'moyenne', 'basse')),
    validated_blocking VARCHAR(20) CHECK (validated_blocking IN ('bloquant', 'partiel', 'non_bloquant')),
    urgency_justification TEXT,

    -- Impact
    impact_description TEXT,
    affected_processes JSONB DEFAULT '[]',
    workaround TEXT,
    has_workaround BOOLEAN DEFAULT false,

    -- Statut et suivi
    status VARCHAR(20) DEFAULT 'nouveau' CHECK (status IN ('nouveau', 'en_attente_validation', 'en_analyse', 'en_cours', 'resolu', 'cloture')),
    resolution_type VARCHAR(20) CHECK (resolution_type IN ('temporaire', 'permanente')),
    resolution_description TEXT,

    -- Personnes
    created_by UUID NOT NULL REFERENCES users(id),
    current_responsible UUID REFERENCES users(id),
    validated_by UUID REFERENCES users(id),
    resolved_by UUID REFERENCES users(id),

    -- Niveau de résolution
    created_at_level INTEGER,
    current_level INTEGER,
    resolved_at_level INTEGER,

    -- Branche hierarchique (terrain ou administratif)
    profile_type VARCHAR(20) DEFAULT 'terrain' CHECK (profile_type IN ('terrain', 'administratif')),

    -- Visibilité
    is_visible_union BOOLEAN DEFAULT false,

    -- Dates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    validated_at TIMESTAMP WITH TIME ZONE,
    sla_response_deadline TIMESTAMP WITH TIME ZONE,
    sla_resolution_deadline TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les recherches fréquentes sur tickets
CREATE INDEX idx_tickets_agency ON tickets(agency_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_created_by ON tickets(created_by);
CREATE INDEX idx_tickets_responsible ON tickets(current_responsible);
CREATE INDEX idx_tickets_created_at ON tickets(created_at);
CREATE INDEX idx_tickets_urgency ON tickets(validated_urgency);
CREATE INDEX idx_tickets_visible_union ON tickets(agency_id) WHERE is_visible_union = true;
CREATE INDEX idx_tickets_status_agency ON tickets(agency_id, status);

-- Table des escalades
CREATE TABLE IF NOT EXISTS ticket_escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    from_user_id UUID NOT NULL REFERENCES users(id),
    to_user_id UUID REFERENCES users(id),
    from_level INTEGER NOT NULL,
    to_level INTEGER NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des groupes de confidentialité
CREATE TABLE IF NOT EXISTS confidentiality_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    can_read_levels JSONB DEFAULT '[]',
    can_write_levels JSONB DEFAULT '[]',
    is_global BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des commentaires
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    content TEXT NOT NULL,
    is_public BOOLEAN DEFAULT true,
    confidentiality_group_id UUID REFERENCES confidentiality_groups(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_comments_ticket ON comments(ticket_id);

-- Table des pièces jointes
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,

    -- Informations fichier
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    file_path TEXT NOT NULL,

    -- Métadonnées
    uploaded_by UUID NOT NULL REFERENCES users(id),
    is_image BOOLEAN DEFAULT false,
    thumbnail_path TEXT,

    -- Sécurité
    is_scanned BOOLEAN DEFAULT false,
    scan_result VARCHAR(20) CHECK (scan_result IN ('clean', 'infected', 'error')),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Au moins un des deux doit être renseigné
    CONSTRAINT attachment_parent CHECK (ticket_id IS NOT NULL OR comment_id IS NOT NULL)
);

CREATE INDEX idx_attachments_ticket ON attachments(ticket_id);
CREATE INDEX idx_attachments_comment ON attachments(comment_id);

-- Table historique des tickets (audit trail)
CREATE TABLE IF NOT EXISTS ticket_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    field_name VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    is_email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Table des préférences de notification utilisateur
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, notification_type)
);

-- Table des tokens de vérification email
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(20) NOT NULL CHECK (token_type IN ('email_verification', 'password_reset')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_verification_tokens_user ON email_verification_tokens(user_id);
CREATE INDEX idx_verification_tokens_token ON email_verification_tokens(token);

-- Table des logs administrateur
CREATE TABLE IF NOT EXISTS admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_logs_user ON admin_logs(user_id);
CREATE INDEX idx_admin_logs_created ON admin_logs(created_at);

-- Table des sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);

-- Table configuration email
CREATE TABLE IF NOT EXISTS email_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    smtp_host VARCHAR(255),
    smtp_port INTEGER DEFAULT 587,
    smtp_secure BOOLEAN DEFAULT false,
    smtp_user VARCHAR(255),
    smtp_password_encrypted TEXT,
    from_name VARCHAR(100),
    from_email VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des emails envoyés (log)
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    to_email VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    template VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Table des questions dynamiques (par type de problème)
CREATE TABLE IF NOT EXISTS dynamic_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    problem_type_id UUID REFERENCES problem_types(id) ON DELETE CASCADE,
    trigger_condition JSONB NOT NULL,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) CHECK (question_type IN ('text', 'select', 'multiselect', 'boolean', 'number')),
    options JSONB,
    is_required BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    urgency_trigger VARCHAR(20)[] DEFAULT '{}',
    blocking_trigger VARCHAR(20)[] DEFAULT '{}',
    help_text TEXT,
    validation_rules JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des réponses aux questions dynamiques
CREATE TABLE IF NOT EXISTS dynamic_question_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES dynamic_questions(id) ON DELETE CASCADE,
    response_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ticket_id, question_id)
);

CREATE INDEX idx_question_responses_ticket ON dynamic_question_responses(ticket_id);

-- Table des exports
CREATE TABLE IF NOT EXISTS export_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    agency_id UUID REFERENCES agencies(id),

    -- Configuration export
    export_type VARCHAR(20) NOT NULL CHECK (export_type IN ('tickets', 'stats', 'users', 'audit')),
    format VARCHAR(10) NOT NULL CHECK (format IN ('pdf', 'excel', 'csv')),
    filters JSONB DEFAULT '{}',

    -- Statut
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
    file_path TEXT,
    file_size INTEGER,
    error_message TEXT,

    -- Dates
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_exports_user ON export_requests(user_id);
CREATE INDEX idx_exports_status ON export_requests(status);

-- Table des permissions d'export
CREATE TABLE IF NOT EXISTS export_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
    hierarchy_level_id UUID REFERENCES hierarchy_levels(id) ON DELETE CASCADE,

    can_export_tickets BOOLEAN DEFAULT false,
    can_export_stats BOOLEAN DEFAULT false,
    can_export_users BOOLEAN DEFAULT false,
    can_export_audit BOOLEAN DEFAULT false,

    max_records INTEGER DEFAULT 1000,
    allowed_formats VARCHAR(10)[] DEFAULT ARRAY['pdf', 'excel'],

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table des statistiques syndicat (cache)
CREATE TABLE IF NOT EXISTS union_stats_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

    -- Statistiques agrégées (sans données personnelles)
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    total_tickets INTEGER DEFAULT 0,
    resolved_tickets INTEGER DEFAULT 0,
    avg_resolution_days NUMERIC(10,2),
    tickets_by_type JSONB DEFAULT '{}',
    tickets_by_location JSONB DEFAULT '{}',
    tickets_by_urgency JSONB DEFAULT '{}',
    sla_compliance_rate NUMERIC(5,2),

    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(agency_id, period_start, period_end)
);

-- Index utilisateurs
CREATE INDEX idx_users_account_status ON users(account_status);

-- ====================================
-- VUES UTILES
-- ====================================

-- Vue des tickets avec informations complètes
CREATE OR REPLACE VIEW v_tickets_full AS
SELECT
    t.*,
    a.name AS agency_name,
    a.code AS agency_code,
    pt.name AS problem_type_name,
    l.name AS location_name,
    u_created.first_name || ' ' || u_created.last_name AS created_by_name,
    u_resp.first_name || ' ' || u_resp.last_name AS responsible_name,
    CASE
        WHEN t.sla_resolution_deadline IS NOT NULL AND t.status NOT IN ('resolu', 'cloture')
        THEN t.sla_resolution_deadline < CURRENT_TIMESTAMP
        ELSE false
    END AS is_sla_exceeded,
    CASE
        WHEN t.sla_resolution_deadline IS NOT NULL AND t.status NOT IN ('resolu', 'cloture')
        THEN EXTRACT(EPOCH FROM (t.sla_resolution_deadline - CURRENT_TIMESTAMP)) / 3600
        ELSE NULL
    END AS hours_until_sla
FROM tickets t
LEFT JOIN agencies a ON t.agency_id = a.id
LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
LEFT JOIN locations l ON t.primary_location_id = l.id
LEFT JOIN users u_created ON t.created_by = u_created.id
LEFT JOIN users u_resp ON t.current_responsible = u_resp.id;

-- Vue statistiques par agence
CREATE OR REPLACE VIEW v_agency_stats AS
SELECT
    a.id AS agency_id,
    a.name AS agency_name,
    COUNT(t.id) AS total_tickets,
    COUNT(CASE WHEN t.status IN ('nouveau', 'en_attente_validation', 'en_analyse', 'en_cours') THEN 1 END) AS open_tickets,
    COUNT(CASE WHEN t.status = 'resolu' THEN 1 END) AS resolved_tickets,
    COUNT(CASE WHEN t.validated_urgency = 'critique' AND t.status NOT IN ('resolu', 'cloture') THEN 1 END) AS critical_tickets,
    ROUND(AVG(CASE WHEN t.resolved_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 86400
        END)::numeric, 2) AS avg_resolution_days,
    ROUND((COUNT(CASE WHEN t.resolved_at <= t.sla_resolution_deadline THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END), 0) * 100)::numeric, 1) AS sla_compliance_percent
FROM agencies a
LEFT JOIN tickets t ON a.id = t.agency_id
GROUP BY a.id, a.name;

-- Vue pour les tickets visibles au syndicat
CREATE OR REPLACE VIEW v_union_visible_tickets AS
SELECT
    t.id,
    t.ticket_number,
    t.agency_id,
    a.name AS agency_name,
    t.title,
    -- Pas de description détaillée pour le syndicat
    pt.name AS problem_type_name,
    l.name AS location_name,
    t.validated_urgency,
    t.validated_blocking,
    t.status,
    t.created_at,
    t.resolved_at,
    t.closed_at,
    -- Pas de noms de personnes
    CASE
        WHEN t.sla_resolution_deadline IS NOT NULL AND t.resolved_at IS NOT NULL
        THEN t.resolved_at <= t.sla_resolution_deadline
        ELSE NULL
    END AS sla_respected
FROM tickets t
JOIN agencies a ON t.agency_id = a.id
LEFT JOIN problem_types pt ON t.problem_type_id = pt.id
LEFT JOIN locations l ON t.primary_location_id = l.id
WHERE t.is_visible_union = true
AND t.status NOT IN ('nouveau', 'en_attente_validation');

-- Vue statistiques syndicat par agence
CREATE OR REPLACE VIEW v_union_agency_stats AS
SELECT
    a.id AS agency_id,
    a.name AS agency_name,
    COUNT(t.id) AS total_visible_tickets,
    COUNT(CASE WHEN t.status IN ('resolu', 'cloture') THEN 1 END) AS resolved_tickets,
    COUNT(CASE WHEN t.validated_urgency = 'critique' THEN 1 END) AS critical_tickets,
    COUNT(CASE WHEN t.validated_urgency = 'haute' THEN 1 END) AS high_tickets,
    ROUND(AVG(CASE WHEN t.resolved_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 86400
        END)::numeric, 2) AS avg_resolution_days,
    ROUND((COUNT(CASE WHEN t.resolved_at <= t.sla_resolution_deadline THEN 1 END)::numeric /
        NULLIF(COUNT(CASE WHEN t.resolved_at IS NOT NULL THEN 1 END), 0) * 100)::numeric, 1) AS sla_compliance_percent,
    -- Répartition par type (top 5)
    (SELECT jsonb_agg(row_to_json(sub)) FROM (
        SELECT pt2.name, COUNT(*) as count
        FROM tickets t2
        JOIN problem_types pt2 ON t2.problem_type_id = pt2.id
        WHERE t2.agency_id = a.id AND t2.is_visible_union = true
        GROUP BY pt2.name ORDER BY count DESC LIMIT 5
    ) sub) AS top_problem_types,
    -- Répartition par lieu (top 5)
    (SELECT jsonb_agg(row_to_json(sub)) FROM (
        SELECT l2.name, COUNT(*) as count
        FROM tickets t2
        JOIN locations l2 ON t2.primary_location_id = l2.id
        WHERE t2.agency_id = a.id AND t2.is_visible_union = true
        GROUP BY l2.name ORDER BY count DESC LIMIT 5
    ) sub) AS top_locations
FROM agencies a
LEFT JOIN tickets t ON a.id = t.agency_id AND t.is_visible_union = true
GROUP BY a.id, a.name;

-- ====================================
-- FONCTIONS
-- ====================================

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Fonction pour générer le numéro de ticket
CREATE OR REPLACE FUNCTION generate_ticket_reference()
RETURNS TRIGGER AS $$
DECLARE
    agency_code VARCHAR(20);
    year_suffix VARCHAR(2);
    next_num INTEGER;
BEGIN
    -- Récupérer le code agence
    SELECT code INTO agency_code FROM agencies WHERE id = NEW.agency_id;

    -- Année sur 2 chiffres
    year_suffix := to_char(CURRENT_DATE, 'YY');

    -- Prochain numéro pour cette agence cette année
    SELECT COALESCE(MAX(ticket_number), 0) + 1 INTO next_num
    FROM tickets
    WHERE agency_id = NEW.agency_id
    AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

    NEW.ticket_number := next_num;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer les deadlines SLA
CREATE OR REPLACE FUNCTION calculate_sla_deadlines()
RETURNS TRIGGER AS $$
DECLARE
    sla_record RECORD;
BEGIN
    -- Seulement si le ticket vient d'être validé
    IF NEW.validated_urgency IS NOT NULL AND OLD.validated_urgency IS NULL THEN
        SELECT * INTO sla_record FROM sla_configs
        WHERE agency_id = NEW.agency_id
        AND urgency = NEW.validated_urgency
        AND blocking_level = COALESCE(NEW.validated_blocking, 'non_bloquant');

        IF FOUND THEN
            NEW.sla_response_deadline = NEW.validated_at + (sla_record.response_time_hours || ' hours')::INTERVAL;
            NEW.sla_resolution_deadline = NEW.validated_at + (sla_record.resolution_time_hours || ' hours')::INTERVAL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Fonction pour logger l'historique des tickets
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Changement de statut
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'status_change', 'status', OLD.status, NEW.status);
    END IF;

    -- Changement d'urgence
    IF OLD.validated_urgency IS DISTINCT FROM NEW.validated_urgency THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.validated_by, NEW.created_by), 'urgency_change', 'validated_urgency', OLD.validated_urgency, NEW.validated_urgency);
    END IF;

    -- Changement de responsable
    IF OLD.current_responsible IS DISTINCT FROM NEW.current_responsible THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'assignment_change', 'current_responsible', OLD.current_responsible::TEXT, NEW.current_responsible::TEXT);
    END IF;

    -- Escalade
    IF OLD.current_level IS DISTINCT FROM NEW.current_level THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'escalation', 'current_level', OLD.current_level::TEXT, NEW.current_level::TEXT);
    END IF;

    -- Changement de visibilité syndicat
    IF OLD.is_visible_union IS DISTINCT FROM NEW.is_visible_union THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'visibility_change', 'is_visible_union', OLD.is_visible_union::TEXT, NEW.is_visible_union::TEXT);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ====================================
-- TRIGGERS
-- ====================================

-- Triggers pour updated_at
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hierarchy_levels_updated_at BEFORE UPDATE ON hierarchy_levels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_export_permissions_updated_at BEFORE UPDATE ON export_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynamic_question_responses_updated_at BEFORE UPDATE ON dynamic_question_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour générer le numéro de ticket
CREATE TRIGGER generate_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_reference();

-- Trigger pour calculer les SLA
CREATE TRIGGER calculate_ticket_sla BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION calculate_sla_deadlines();

-- Trigger pour l'historique des tickets
CREATE TRIGGER log_ticket_history
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION log_ticket_changes();

-- Table des templates de tickets
CREATE TABLE IF NOT EXISTS ticket_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,

    -- Informations du template
    name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Contenu pre-rempli
    title_template VARCHAR(255),
    description_template TEXT,
    problem_type_id UUID REFERENCES problem_types(id),
    default_urgency VARCHAR(20) CHECK (default_urgency IN ('critique', 'haute', 'moyenne', 'basse')),
    default_blocking VARCHAR(20) CHECK (default_blocking IN ('bloquant', 'partiel', 'non_bloquant')),
    default_location_id UUID REFERENCES locations(id),
    profile_type VARCHAR(20) DEFAULT 'terrain' CHECK (profile_type IN ('terrain', 'administratif')),

    -- Restrictions d'acces
    min_level_required INTEGER DEFAULT 0,

    -- Metadonnees
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(agency_id, name)
);

CREATE INDEX idx_templates_agency ON ticket_templates(agency_id);
CREATE INDEX idx_templates_active ON ticket_templates(agency_id, is_active);

-- ====================================
-- FIN DU SCHÉMA UNIFIÉ
-- ====================================
