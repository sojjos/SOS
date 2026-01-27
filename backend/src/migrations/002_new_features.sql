-- ====================================
-- SOS - Migration 002: Nouvelles fonctionnalités
-- ====================================

-- ====================================
-- TABLE DES PIÈCES JOINTES
-- ====================================
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

-- ====================================
-- TABLE DES TOKENS DE VÉRIFICATION EMAIL
-- ====================================
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

-- ====================================
-- MISE À JOUR TABLE USERS
-- ====================================
-- Ajouter le statut du compte et les préférences de notification
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20)
    DEFAULT 'active' CHECK (account_status IN ('pending', 'active', 'suspended', 'rejected'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;

-- ====================================
-- TABLE DES RÉPONSES AUX QUESTIONS DYNAMIQUES
-- ====================================
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

-- ====================================
-- MISE À JOUR TABLE DYNAMIC_QUESTIONS
-- ====================================
ALTER TABLE dynamic_questions ADD COLUMN IF NOT EXISTS urgency_trigger VARCHAR(20)[] DEFAULT '{}';
ALTER TABLE dynamic_questions ADD COLUMN IF NOT EXISTS blocking_trigger VARCHAR(20)[] DEFAULT '{}';
ALTER TABLE dynamic_questions ADD COLUMN IF NOT EXISTS help_text TEXT;
ALTER TABLE dynamic_questions ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}';

-- ====================================
-- TABLE DES EXPORTS
-- ====================================
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

-- ====================================
-- TABLE DES PERMISSIONS D'EXPORT
-- ====================================
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

-- ====================================
-- MISE À JOUR TABLE USER_AGENCY_ACCESS POUR SYNDICAT
-- ====================================
ALTER TABLE user_agency_access ADD COLUMN IF NOT EXISTS union_view_only BOOLEAN DEFAULT false;
ALTER TABLE user_agency_access ADD COLUMN IF NOT EXISTS can_see_confidential BOOLEAN DEFAULT false;
ALTER TABLE user_agency_access ADD COLUMN IF NOT EXISTS allowed_locations UUID[] DEFAULT '{}';

-- ====================================
-- TABLE DES STATISTIQUES SYNDICAT
-- ====================================
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

-- ====================================
-- VUE POUR LES TICKETS VISIBLES AU SYNDICAT
-- ====================================
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

-- ====================================
-- VUE STATISTIQUES SYNDICAT PAR AGENCE
-- ====================================
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
-- FONCTION POUR GÉNÉRER LE NUMÉRO DE TICKET
-- ====================================
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

-- Trigger pour générer le numéro de ticket
DROP TRIGGER IF EXISTS generate_ticket_number ON tickets;
CREATE TRIGGER generate_ticket_number
    BEFORE INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION generate_ticket_reference();

-- ====================================
-- FONCTION POUR LOGGER L'HISTORIQUE DES TICKETS
-- ====================================
CREATE OR REPLACE FUNCTION log_ticket_changes()
RETURNS TRIGGER AS $$
DECLARE
    changed_fields TEXT[] := ARRAY[]::TEXT[];
    field_name TEXT;
    old_val TEXT;
    new_val TEXT;
BEGIN
    -- Liste des champs à surveiller
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'status_change', 'status', OLD.status, NEW.status);
    END IF;

    IF OLD.validated_urgency IS DISTINCT FROM NEW.validated_urgency THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.validated_by, NEW.created_by), 'urgency_change', 'validated_urgency', OLD.validated_urgency, NEW.validated_urgency);
    END IF;

    IF OLD.current_responsible IS DISTINCT FROM NEW.current_responsible THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'assignment_change', 'current_responsible', OLD.current_responsible::TEXT, NEW.current_responsible::TEXT);
    END IF;

    IF OLD.current_level IS DISTINCT FROM NEW.current_level THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'escalation', 'current_level', OLD.current_level::TEXT, NEW.current_level::TEXT);
    END IF;

    IF OLD.is_visible_union IS DISTINCT FROM NEW.is_visible_union THEN
        INSERT INTO ticket_history (ticket_id, user_id, action, field_name, old_value, new_value)
        VALUES (NEW.id, COALESCE(NEW.current_responsible, NEW.created_by), 'visibility_change', 'is_visible_union', OLD.is_visible_union::TEXT, NEW.is_visible_union::TEXT);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour l'historique
DROP TRIGGER IF EXISTS log_ticket_history ON tickets;
CREATE TRIGGER log_ticket_history
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION log_ticket_changes();

-- ====================================
-- TRIGGER POUR UPDATED_AT SUR NOUVELLES TABLES
-- ====================================
CREATE TRIGGER update_export_permissions_updated_at
    BEFORE UPDATE ON export_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dynamic_question_responses_updated_at
    BEFORE UPDATE ON dynamic_question_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================
-- INDEX SUPPLÉMENTAIRES POUR PERFORMANCES
-- ====================================
CREATE INDEX IF NOT EXISTS idx_tickets_visible_union ON tickets(agency_id) WHERE is_visible_union = true;
CREATE INDEX IF NOT EXISTS idx_tickets_status_agency ON tickets(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);
