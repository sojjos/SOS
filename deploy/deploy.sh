#!/bin/bash

# ===========================================
# SOS - Script de Déploiement Complet
# Déploie l'application sur un serveur vierge
# ===========================================

set -e

# Configuration par défaut
export DEBIAN_FRONTEND=noninteractive
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Variables de configuration (peuvent être surchargées par variables d'environnement)
DOMAIN="${DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sos.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
PLATFORM_ADMIN_EMAIL="${PLATFORM_ADMIN_EMAIL:-platform@sos.local}"
PLATFORM_ADMIN_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-}"
ENABLE_SSL="${ENABLE_SSL:-false}"
SSL_EMAIL="${SSL_EMAIL:-}"
AUTO_MODE="${AUTO_MODE:-false}"

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${PURPLE}▶ $1${NC}"; echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# Banner
print_banner() {
    echo -e "${BLUE}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════════════════════════╗
    ║                                                               ║
    ║      ███████╗ ██████╗ ███████╗                               ║
    ║      ██╔════╝██╔═══██╗██╔════╝                               ║
    ║      ███████╗██║   ██║███████╗                               ║
    ║      ╚════██║██║   ██║╚════██║                               ║
    ║      ███████║╚██████╔╝███████║                               ║
    ║      ╚══════╝ ╚═════╝ ╚══════╝                               ║
    ║                                                               ║
    ║          Short Operational Summary                            ║
    ║          Automated Deployment Script v2.0                     ║
    ║                                                               ║
    ╚═══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Générer un mot de passe sécurisé
generate_password() {
    local length=${1:-24}
    openssl rand -base64 48 | tr -d '\n/+=O0lI1' | head -c "$length"
}

# Générer un secret JWT
generate_secret() {
    openssl rand -base64 64 | tr -d '\n'
}

# Vérifier si root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Ce script doit être exécuté en tant que root"
        echo "Utilisez: sudo $0"
        exit 1
    fi
}

# Détecter le système d'exploitation
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        OS_VERSION=$VERSION_ID
    else
        log_error "Système d'exploitation non supporté"
        exit 1
    fi

    log_info "Système détecté: $OS $OS_VERSION"

    case $OS in
        ubuntu|debian)
            PKG_MANAGER="apt-get"
            PKG_UPDATE="apt-get update -qq"
            PKG_INSTALL="apt-get install -y -qq"
            ;;
        centos|rhel|rocky|almalinux)
            PKG_MANAGER="dnf"
            PKG_UPDATE="dnf check-update || true"
            PKG_INSTALL="dnf install -y -q"
            ;;
        *)
            log_error "Distribution non supportée: $OS"
            exit 1
            ;;
    esac
}

# Installer les dépendances système
install_dependencies() {
    log_step "Installation des dépendances système"

    $PKG_UPDATE
    $PKG_INSTALL curl wget git openssl ca-certificates gnupg lsb-release

    log_success "Dépendances système installées"
}

# Installer Docker
install_docker() {
    log_step "Installation de Docker"

    if command -v docker &> /dev/null; then
        log_info "Docker est déjà installé"
        docker --version
    else
        log_info "Installation de Docker..."

        case $OS in
            ubuntu|debian)
                # Ajouter le dépôt Docker
                install -m 0755 -d /etc/apt/keyrings
                curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
                chmod a+r /etc/apt/keyrings/docker.gpg

                echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

                apt-get update -qq
                apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
            centos|rhel|rocky|almalinux)
                dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                dnf install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                ;;
        esac

        systemctl enable docker
        systemctl start docker

        log_success "Docker installé avec succès"
    fi

    # Vérifier Docker Compose
    if docker compose version &> /dev/null; then
        log_success "Docker Compose disponible"
    else
        log_error "Docker Compose n'est pas disponible"
        exit 1
    fi
}

# Configurer le firewall
configure_firewall() {
    log_step "Configuration du firewall"

    case $OS in
        ubuntu|debian)
            if command -v ufw &> /dev/null; then
                ufw --force enable
                ufw default deny incoming
                ufw default allow outgoing
                ufw allow ssh
                ufw allow 80/tcp
                ufw allow 443/tcp
                ufw reload
                log_success "UFW configuré"
            fi
            ;;
        centos|rhel|rocky|almalinux)
            if command -v firewall-cmd &> /dev/null; then
                systemctl enable firewalld
                systemctl start firewalld
                firewall-cmd --permanent --add-service=ssh
                firewall-cmd --permanent --add-service=http
                firewall-cmd --permanent --add-service=https
                firewall-cmd --reload
                log_success "Firewalld configuré"
            fi
            ;;
    esac
}

# Configuration interactive ou automatique
configure_installation() {
    log_step "Configuration de l'installation"

    # Générer les mots de passe si non fournis
    if [ -z "$ADMIN_PASSWORD" ]; then
        ADMIN_PASSWORD=$(generate_password 16)
    fi

    if [ -z "$PLATFORM_ADMIN_PASSWORD" ]; then
        PLATFORM_ADMIN_PASSWORD=$(generate_password 16)
    fi

    DB_PASSWORD=$(generate_password 32)
    JWT_SECRET=$(generate_secret)
    JWT_REFRESH_SECRET=$(generate_secret)
    PLATFORM_JWT_SECRET=$(generate_secret)

    if [ "$AUTO_MODE" = "true" ]; then
        # Mode automatique - utiliser les valeurs par défaut
        DOMAIN=${DOMAIN:-localhost}
        log_info "Mode automatique - Utilisation des valeurs par défaut"
    else
        # Mode interactif
        echo ""
        echo -e "${YELLOW}Configuration de l'installation${NC}"
        echo "================================"
        echo ""

        read -p "Domaine (ex: sos.example.com) [localhost]: " input_domain
        DOMAIN=${input_domain:-localhost}

        read -p "Email admin entreprise [$ADMIN_EMAIL]: " input_admin_email
        ADMIN_EMAIL=${input_admin_email:-$ADMIN_EMAIL}

        read -p "Mot de passe admin entreprise [généré]: " input_admin_password
        ADMIN_PASSWORD=${input_admin_password:-$ADMIN_PASSWORD}

        read -p "Email admin plateforme [$PLATFORM_ADMIN_EMAIL]: " input_platform_email
        PLATFORM_ADMIN_EMAIL=${input_platform_email:-$PLATFORM_ADMIN_EMAIL}

        read -p "Mot de passe admin plateforme [généré]: " input_platform_password
        PLATFORM_ADMIN_PASSWORD=${input_platform_password:-$PLATFORM_ADMIN_PASSWORD}

        if [ "$DOMAIN" != "localhost" ]; then
            read -p "Activer SSL avec Let's Encrypt? (y/N): " input_ssl
            if [[ "$input_ssl" =~ ^[Yy]$ ]]; then
                ENABLE_SSL="true"
                read -p "Email pour Let's Encrypt: " SSL_EMAIL
            fi
        fi
    fi

    # Déterminer les URLs
    if [ "$ENABLE_SSL" = "true" ]; then
        FRONTEND_URL="https://$DOMAIN"
        VITE_API_URL="https://$DOMAIN/api"
    elif [ "$DOMAIN" = "localhost" ]; then
        FRONTEND_URL="http://localhost:3000"
        VITE_API_URL="http://localhost:3001/api"
    else
        FRONTEND_URL="http://$DOMAIN"
        VITE_API_URL="http://$DOMAIN/api"
    fi

    log_success "Configuration terminée"
}

# Créer le fichier .env
create_env_file() {
    log_step "Création du fichier .env"

    cat > "$PROJECT_DIR/.env" << EOF
# ===========================================
# Configuration SOS - Générée automatiquement
# Date: $(date)
# ===========================================

# Environnement
NODE_ENV=production

# Domaine
DOMAIN=$DOMAIN

# Ports
FRONTEND_PORT=3000
BACKEND_PORT=3001
DB_PORT=5432

# Base de données PostgreSQL
DB_HOST=postgres
DB_NAME=sos_db
DB_USER=sos_user
DB_PASSWORD=$DB_PASSWORD

# JWT - Secrets
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# JWT Platform Admin
PLATFORM_JWT_SECRET=$PLATFORM_JWT_SECRET

# Compte admin entreprise par défaut
DEFAULT_ADMIN_EMAIL=$ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD=$ADMIN_PASSWORD

# Compte admin plateforme par défaut
DEFAULT_PLATFORM_ADMIN_EMAIL=$PLATFORM_ADMIN_EMAIL
DEFAULT_PLATFORM_ADMIN_PASSWORD=$PLATFORM_ADMIN_PASSWORD

# URLs
FRONTEND_URL=$FRONTEND_URL
VITE_API_URL=$VITE_API_URL

# SSL
ENABLE_SSL=$ENABLE_SSL
SSL_EMAIL=$SSL_EMAIL

# SMTP (à configurer)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@$DOMAIN
EMAIL_FROM_NAME=SOS - Short Operational Summary

# Sécurité
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket
WS_ENABLED=true
WS_HEARTBEAT_INTERVAL=30000
EOF

    chmod 600 "$PROJECT_DIR/.env"
    log_success "Fichier .env créé"
}

# Créer la configuration nginx
create_nginx_config() {
    log_step "Configuration de Nginx"

    mkdir -p "$PROJECT_DIR/nginx/ssl"

    if [ "$ENABLE_SSL" = "true" ]; then
        # Configuration avec SSL
        cat > "$PROJECT_DIR/nginx/nginx.conf" << 'NGINXCONF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Optimisations
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 50M;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS Server
    server {
        listen 443 ssl http2;
        server_name DOMAIN_PLACEHOLDER;

        # SSL Configuration
        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_session_tickets off;

        # Modern SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # HSTS
        add_header Strict-Transport-Security "max-age=63072000" always;

        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;

        # API Backend
        location /api {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            proxy_read_timeout 300s;
            proxy_connect_timeout 75s;
        }

        # WebSocket
        location /ws {
            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_read_timeout 86400;
        }

        # Login rate limiting
        location /api/auth/login {
            limit_req zone=login burst=5 nodelay;

            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static files (Frontend)
        location / {
            proxy_pass http://frontend:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Let's Encrypt challenge
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
    }
}
NGINXCONF
        sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$PROJECT_DIR/nginx/nginx.conf"
    else
        # Configuration sans SSL
        cat > "$PROJECT_DIR/nginx/nginx.conf" << 'NGINXCONF'
events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    client_max_body_size 50M;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    server {
        listen 80;
        server_name DOMAIN_PLACEHOLDER;

        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;

        location /api {
            limit_req zone=api burst=20 nodelay;

            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        location /ws {
            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400;
        }

        location / {
            proxy_pass http://frontend:80;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
NGINXCONF
        sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" "$PROJECT_DIR/nginx/nginx.conf"
    fi

    log_success "Configuration Nginx créée"
}

# Construire et démarrer les services
start_services() {
    log_step "Construction et démarrage des services"

    cd "$PROJECT_DIR"

    # Build des images
    log_info "Construction des images Docker (cela peut prendre quelques minutes)..."
    docker compose build --no-cache

    # Démarrer les services de base
    log_info "Démarrage des services..."
    if [ "$ENABLE_SSL" = "true" ]; then
        docker compose --profile production up -d
    else
        docker compose up -d postgres backend frontend
    fi

    # Attendre que la base de données soit prête
    log_info "Attente de la base de données..."
    local max_attempts=30
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        if docker compose exec -T postgres pg_isready -U sos_user -d sos_db &> /dev/null; then
            log_success "Base de données prête"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "La base de données n'a pas démarré dans le délai imparti"
        docker compose logs postgres
        exit 1
    fi

    # Attendre le backend
    log_info "Attente du backend..."
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:3001/api/health 2>/dev/null | grep -q "healthy"; then
            log_success "Backend opérationnel"
            break
        fi
        echo -n "."
        sleep 3
        attempt=$((attempt + 1))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_warning "Le backend n'a pas répondu - vérification des logs"
        docker compose logs backend | tail -50
    fi

    log_success "Services démarrés"
}

# Initialiser la base de données
init_database() {
    log_step "Initialisation de la base de données"

    cd "$PROJECT_DIR"

    # Exécuter les seeds
    log_info "Exécution des seeds..."
    docker compose exec -T backend node src/seeds/run.js || {
        log_warning "Le seeding principal a peut-être déjà été exécuté"
    }

    # Seed de l'admin plateforme
    log_info "Création de l'administrateur plateforme..."
    docker compose exec -T backend node src/seeds/platform_admin.js || {
        log_warning "L'admin plateforme existe peut-être déjà"
    }

    log_success "Base de données initialisée"
}

# Configurer SSL avec Let's Encrypt
setup_ssl() {
    if [ "$ENABLE_SSL" != "true" ]; then
        return
    fi

    log_step "Configuration SSL avec Let's Encrypt"

    cd "$PROJECT_DIR"

    # Créer le répertoire pour certbot
    mkdir -p "$PROJECT_DIR/certbot/www" "$PROJECT_DIR/certbot/conf"

    # Démarrer nginx temporairement pour le challenge
    docker compose up -d nginx

    # Obtenir le certificat
    docker run --rm \
        -v "$PROJECT_DIR/certbot/conf:/etc/letsencrypt" \
        -v "$PROJECT_DIR/certbot/www:/var/www/certbot" \
        certbot/certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$SSL_EMAIL" \
        --agree-tos \
        --no-eff-email \
        -d "$DOMAIN"

    # Copier les certificats
    cp "$PROJECT_DIR/certbot/conf/live/$DOMAIN/fullchain.pem" "$PROJECT_DIR/nginx/ssl/"
    cp "$PROJECT_DIR/certbot/conf/live/$DOMAIN/privkey.pem" "$PROJECT_DIR/nginx/ssl/"

    # Redémarrer nginx avec SSL
    docker compose restart nginx

    log_success "SSL configuré avec Let's Encrypt"
}

# Créer le service systemd
create_systemd_service() {
    log_step "Création du service systemd"

    cat > /etc/systemd/system/sos.service << EOF
[Unit]
Description=SOS - Short Operational Summary
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_DIR
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
ExecReload=/usr/bin/docker compose restart
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable sos.service

    log_success "Service systemd créé et activé"
}

# Configurer les backups automatiques
setup_backups() {
    log_step "Configuration des backups automatiques"

    # Créer le script de backup
    cat > "$PROJECT_DIR/deploy/backup.sh" << 'BACKUPSCRIPT'
#!/bin/bash
# SOS - Script de backup automatique

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Charger la configuration
source "$PROJECT_DIR/.env"

# Créer le répertoire de backup
mkdir -p "$BACKUP_DIR"

# Nom du fichier
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sos_backup_$TIMESTAMP.sql.gz"

# Effectuer le backup
echo "[$(date)] Démarrage du backup..."

docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$BACKUP_FILE"

# Vérifier le backup
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] Backup créé: $BACKUP_FILE ($SIZE)"
else
    echo "[$(date)] ERREUR: Échec du backup"
    exit 1
fi

# Supprimer les anciens backups
find "$BACKUP_DIR" -name "sos_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete
echo "[$(date)] Anciens backups nettoyés (rétention: $RETENTION_DAYS jours)"

echo "[$(date)] Backup terminé avec succès"
BACKUPSCRIPT

    chmod +x "$PROJECT_DIR/deploy/backup.sh"

    # Ajouter le cron job
    (crontab -l 2>/dev/null | grep -v "sos.*backup"; echo "0 2 * * * $PROJECT_DIR/deploy/backup.sh >> $PROJECT_DIR/logs/backup.log 2>&1") | crontab -

    mkdir -p "$PROJECT_DIR/logs"
    mkdir -p "$PROJECT_DIR/backups"

    log_success "Backups automatiques configurés (tous les jours à 2h)"
}

# Créer le script de restauration
create_restore_script() {
    cat > "$PROJECT_DIR/deploy/restore.sh" << 'RESTORESCRIPT'
#!/bin/bash
# SOS - Script de restauration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

source "$PROJECT_DIR/.env"

if [ -z "$1" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    echo ""
    echo "Backups disponibles:"
    ls -lh "$PROJECT_DIR/backups/"*.sql.gz 2>/dev/null || echo "Aucun backup trouvé"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Fichier non trouvé: $BACKUP_FILE"
    exit 1
fi

echo "ATTENTION: Cette opération va remplacer toutes les données actuelles!"
read -p "Êtes-vous sûr? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Annulé"
    exit 0
fi

echo "Restauration en cours..."

gunzip -c "$BACKUP_FILE" | docker compose -f "$PROJECT_DIR/docker-compose.yml" exec -T postgres \
    psql -U "$DB_USER" -d "$DB_NAME"

echo "Restauration terminée!"
RESTORESCRIPT

    chmod +x "$PROJECT_DIR/deploy/restore.sh"
}

# Afficher le résumé
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        INSTALLATION TERMINÉE AVEC SUCCÈS!                     ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  ACCÈS À L'APPLICATION${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    if [ "$ENABLE_SSL" = "true" ]; then
        echo -e "  Application:          ${GREEN}https://$DOMAIN${NC}"
        echo -e "  Platform Admin:       ${GREEN}https://$DOMAIN/platform/login${NC}"
    else
        echo -e "  Application:          ${GREEN}http://$DOMAIN:3000${NC}"
        echo -e "  Platform Admin:       ${GREEN}http://$DOMAIN:3000/platform/login${NC}"
    fi
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  IDENTIFIANTS${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${YELLOW}Admin Entreprise:${NC}"
    echo -e "    Email:              $ADMIN_EMAIL"
    echo -e "    Mot de passe:       $ADMIN_PASSWORD"
    echo ""
    echo -e "  ${PURPLE}Admin Plateforme (Super Admin):${NC}"
    echo -e "    Email:              $PLATFORM_ADMIN_EMAIL"
    echo -e "    Mot de passe:       $PLATFORM_ADMIN_PASSWORD"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  COMMANDES UTILES${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  Statut:               ${GREEN}systemctl status sos${NC}"
    echo -e "  Logs:                 ${GREEN}docker compose logs -f${NC}"
    echo -e "  Redémarrer:           ${GREEN}systemctl restart sos${NC}"
    echo -e "  Backup manuel:        ${GREEN}$PROJECT_DIR/deploy/backup.sh${NC}"
    echo -e "  Restauration:         ${GREEN}$PROJECT_DIR/deploy/restore.sh <fichier>${NC}"
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  IMPORTANT - SÉCURITÉ${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  1. Changez les mots de passe après la première connexion"
    echo -e "  2. Sauvegardez le fichier .env en lieu sûr"
    echo -e "  3. Configurez le SMTP pour les notifications"
    echo -e "  4. Vérifiez les backups régulièrement"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Sauvegarder les credentials dans un fichier
    cat > "$PROJECT_DIR/CREDENTIALS.txt" << EOF
===========================================
SOS - Identifiants de connexion
Généré le: $(date)
===========================================

ADMIN ENTREPRISE
  Email: $ADMIN_EMAIL
  Mot de passe: $ADMIN_PASSWORD

ADMIN PLATEFORME (Super Admin)
  Email: $PLATFORM_ADMIN_EMAIL
  Mot de passe: $PLATFORM_ADMIN_PASSWORD

ATTENTION: Supprimez ce fichier après avoir noté les identifiants!
===========================================
EOF
    chmod 600 "$PROJECT_DIR/CREDENTIALS.txt"
    echo -e "\n  ${YELLOW}Identifiants sauvegardés dans: $PROJECT_DIR/CREDENTIALS.txt${NC}"
    echo -e "  ${YELLOW}SUPPRIMEZ CE FICHIER après avoir noté les identifiants!${NC}\n"
}

# Fonction principale
main() {
    print_banner

    check_root
    detect_os
    install_dependencies
    install_docker
    configure_firewall
    configure_installation
    create_env_file
    create_nginx_config
    start_services
    init_database
    setup_ssl
    create_systemd_service
    setup_backups
    create_restore_script
    print_summary
}

# Gestion des arguments
case "${1:-}" in
    --auto)
        AUTO_MODE="true"
        main
        ;;
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --auto          Mode automatique (sans prompts)"
        echo "  --help          Afficher cette aide"
        echo ""
        echo "Variables d'environnement:"
        echo "  DOMAIN          Domaine (défaut: localhost)"
        echo "  ADMIN_EMAIL     Email admin entreprise"
        echo "  ADMIN_PASSWORD  Mot de passe admin entreprise"
        echo "  PLATFORM_ADMIN_EMAIL    Email admin plateforme"
        echo "  PLATFORM_ADMIN_PASSWORD Mot de passe admin plateforme"
        echo "  ENABLE_SSL      Activer SSL (true/false)"
        echo "  SSL_EMAIL       Email pour Let's Encrypt"
        echo ""
        echo "Exemple mode automatique:"
        echo "  DOMAIN=sos.example.com ENABLE_SSL=true SSL_EMAIL=admin@example.com sudo -E $0 --auto"
        ;;
    *)
        main
        ;;
esac
