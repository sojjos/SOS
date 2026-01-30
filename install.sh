#!/bin/bash

# ===========================================
# Script d'installation SOS
# Short Operational Summary
# ===========================================

set -e

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Mode automatique
AUTO_MODE="${AUTO_MODE:-false}"

# Fonctions d'affichage
print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║     ███████╗ ██████╗ ███████╗                            ║"
    echo "║     ██╔════╝██╔═══██╗██╔════╝                            ║"
    echo "║     ███████╗██║   ██║███████╗                            ║"
    echo "║     ╚════██║██║   ██║╚════██║                            ║"
    echo "║     ███████║╚██████╔╝███████║                            ║"
    echo "║     ╚══════╝ ╚═════╝ ╚══════╝                            ║"
    echo "║                                                           ║"
    echo "║         Short Operational Summary                         ║"
    echo "║         Installation Script v2.0                          ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifier si une commande existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Générer une chaîne aléatoire
generate_secret() {
    openssl rand -base64 48 | tr -d '\n/+=' | head -c 64
}

generate_password() {
    openssl rand -base64 32 | tr -d '\n/+=O0lI1' | head -c "${1:-16}"
}

# Vérifier les prérequis
check_prerequisites() {
    log_info "Vérification des prérequis..."

    local missing_deps=()

    if ! command_exists docker; then
        missing_deps+=("docker")
    fi

    if ! command_exists docker-compose && ! docker compose version >/dev/null 2>&1; then
        missing_deps+=("docker-compose")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Les dépendances suivantes sont manquantes: ${missing_deps[*]}"
        echo ""
        echo "Pour installer Docker:"
        echo "  curl -fsSL https://get.docker.com | sh"
        echo "  sudo usermod -aG docker \$USER"
        echo ""
        echo "Ou utilisez le script de déploiement complet:"
        echo "  sudo bash deploy/deploy.sh"
        echo ""
        exit 1
    fi

    # Vérifier que Docker daemon est en cours d'exécution
    if ! docker info >/dev/null 2>&1; then
        log_error "Le daemon Docker n'est pas en cours d'exécution"
        echo "Démarrez Docker avec: sudo systemctl start docker"
        exit 1
    fi

    log_success "Tous les prérequis sont satisfaits"
}

# Créer le fichier .env
setup_environment() {
    log_info "Configuration de l'environnement..."

    # Si .env existe et mode non-auto, demander
    if [ -f .env ] && [ "$AUTO_MODE" != "true" ]; then
        log_warning "Un fichier .env existe déjà"
        read -p "Voulez-vous le remplacer? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Conservation du fichier .env existant"
            return
        fi
    elif [ -f .env ] && [ "$AUTO_MODE" = "true" ]; then
        log_info "Mode automatique: conservation du fichier .env existant"
        return
    fi

    # Générer les secrets
    JWT_SECRET=$(generate_secret)
    JWT_REFRESH_SECRET=$(generate_secret)
    PLATFORM_JWT_SECRET=$(generate_secret)
    DB_PASSWORD=$(generate_password 32)

    # Valeurs par défaut
    DEFAULT_ADMIN_EMAIL="${ADMIN_EMAIL:-admin@sos.local}"
    DEFAULT_ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(generate_password 16)}"
    DEFAULT_PLATFORM_EMAIL="${PLATFORM_ADMIN_EMAIL:-platform@sos.local}"
    DEFAULT_PLATFORM_PASSWORD="${PLATFORM_ADMIN_PASSWORD:-$(generate_password 16)}"
    DEFAULT_FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
    DEFAULT_FRONTEND_PORT="${FRONTEND_PORT:-3000}"
    DEFAULT_BACKEND_PORT="${BACKEND_PORT:-3001}"

    if [ "$AUTO_MODE" = "true" ]; then
        # Mode automatique - utiliser les valeurs par défaut ou environnement
        ADMIN_EMAIL="$DEFAULT_ADMIN_EMAIL"
        ADMIN_PASSWORD="$DEFAULT_ADMIN_PASSWORD"
        PLATFORM_EMAIL="$DEFAULT_PLATFORM_EMAIL"
        PLATFORM_PASSWORD="$DEFAULT_PLATFORM_PASSWORD"
        FRONTEND_URL="$DEFAULT_FRONTEND_URL"
        FRONTEND_PORT="$DEFAULT_FRONTEND_PORT"
        BACKEND_PORT="$DEFAULT_BACKEND_PORT"

        log_info "Mode automatique - configuration générée"
    else
        # Mode interactif
        echo ""
        echo -e "${YELLOW}Configuration de l'installation${NC}"
        echo "================================"
        echo ""

        read -p "Email administrateur entreprise [$DEFAULT_ADMIN_EMAIL]: " ADMIN_EMAIL
        ADMIN_EMAIL=${ADMIN_EMAIL:-$DEFAULT_ADMIN_EMAIL}

        read -p "Mot de passe administrateur entreprise [généré]: " ADMIN_PASSWORD
        if [ -z "$ADMIN_PASSWORD" ]; then
            ADMIN_PASSWORD="$DEFAULT_ADMIN_PASSWORD"
            echo "Mot de passe généré: $ADMIN_PASSWORD"
        fi

        read -p "Email administrateur plateforme [$DEFAULT_PLATFORM_EMAIL]: " PLATFORM_EMAIL
        PLATFORM_EMAIL=${PLATFORM_EMAIL:-$DEFAULT_PLATFORM_EMAIL}

        read -p "Mot de passe administrateur plateforme [généré]: " PLATFORM_PASSWORD
        if [ -z "$PLATFORM_PASSWORD" ]; then
            PLATFORM_PASSWORD="$DEFAULT_PLATFORM_PASSWORD"
            echo "Mot de passe généré: $PLATFORM_PASSWORD"
        fi

        read -p "URL du frontend [$DEFAULT_FRONTEND_URL]: " FRONTEND_URL
        FRONTEND_URL=${FRONTEND_URL:-$DEFAULT_FRONTEND_URL}

        read -p "Port frontend [$DEFAULT_FRONTEND_PORT]: " FRONTEND_PORT
        FRONTEND_PORT=${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}

        read -p "Port backend [$DEFAULT_BACKEND_PORT]: " BACKEND_PORT
        BACKEND_PORT=${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}
    fi

    # Créer le fichier .env
    cat > .env << EOF
# ===========================================
# Configuration SOS - Générée le $(date)
# ===========================================

# Environnement
NODE_ENV=production

# Ports
FRONTEND_PORT=${FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
DB_PORT=5432

# Base de données
DB_HOST=postgres
DB_NAME=sos_db
DB_USER=sos_user
DB_PASSWORD=${DB_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# JWT Platform Admin
PLATFORM_JWT_SECRET=${PLATFORM_JWT_SECRET}

# Admin Entreprise
DEFAULT_ADMIN_EMAIL=${ADMIN_EMAIL}
DEFAULT_ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Admin Plateforme
DEFAULT_PLATFORM_ADMIN_EMAIL=${PLATFORM_EMAIL}
DEFAULT_PLATFORM_ADMIN_PASSWORD=${PLATFORM_PASSWORD}

# URLs
FRONTEND_URL=${FRONTEND_URL}
VITE_API_URL=/api

# SMTP (à configurer)
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=noreply@sos.local
EMAIL_FROM_NAME=SOS - Short Operational Summary

# Sécurité
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# WebSocket
WS_ENABLED=true
WS_HEARTBEAT_INTERVAL=30000
EOF

    chmod 600 .env
    log_success "Fichier .env créé"

    # Sauvegarder les credentials
    SAVED_ADMIN_PASSWORD="$ADMIN_PASSWORD"
    SAVED_PLATFORM_PASSWORD="$PLATFORM_PASSWORD"
}

# Construire et démarrer les conteneurs
start_services() {
    log_info "Construction et démarrage des services..."

    # Déterminer la commande docker-compose
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Construire les images
    log_info "Construction des images Docker..."
    $COMPOSE_CMD build

    # Démarrer les services
    log_info "Démarrage des services..."
    $COMPOSE_CMD up -d postgres backend frontend

    # Attendre que les services soient prêts
    log_info "Attente du démarrage des services..."

    # Attendre PostgreSQL
    local max_attempts=30
    local attempt=1
    while [ $attempt -le $max_attempts ]; do
        if $COMPOSE_CMD exec -T postgres pg_isready -U sos_user -d sos_db >/dev/null 2>&1; then
            log_success "Base de données prête"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""

    if [ $attempt -gt $max_attempts ]; then
        log_warning "La base de données n'a pas démarré dans le délai imparti"
    fi

    # Attendre le backend
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:${BACKEND_PORT:-3001}/api/health 2>/dev/null | grep -q "healthy"; then
            log_success "Backend opérationnel"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    echo ""

    if [ $attempt -gt $max_attempts ]; then
        log_warning "Le backend n'a pas répondu dans le délai imparti"
        log_info "Vérifiez les logs avec: docker compose logs backend"
    fi
}

# Initialiser la base de données
init_database() {
    log_info "Initialisation de la base de données..."

    # Déterminer la commande docker-compose
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi

    # Exécuter le seeding principal
    $COMPOSE_CMD exec -T backend node src/seeds/run.js || {
        log_warning "Le seeding principal a peut-être déjà été exécuté"
    }

    # Exécuter le seeding de l'admin plateforme
    $COMPOSE_CMD exec -T backend node src/seeds/platform_admin.js || {
        log_warning "Le seeding admin plateforme a peut-être déjà été exécuté"
    }

    log_success "Base de données initialisée"
}

# Afficher les informations de connexion
print_summary() {
    source .env 2>/dev/null || true

    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           Installation terminée avec succès!              ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Accès à l'application${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  Frontend:       http://localhost:${FRONTEND_PORT:-3000}"
    echo "  API:            http://localhost:${BACKEND_PORT:-3001}/api"
    echo "  Platform Admin: http://localhost:${FRONTEND_PORT:-3000}/platform/login"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Identifiants Admin Entreprise${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  Email:          ${DEFAULT_ADMIN_EMAIL:-admin@sos.local}"
    echo "  Mot de passe:   ${SAVED_ADMIN_PASSWORD:-voir fichier .env}"
    echo ""
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  Identifiants Admin Plateforme (Super Admin)${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  Email:          ${DEFAULT_PLATFORM_ADMIN_EMAIL:-platform@sos.local}"
    echo "  Mot de passe:   ${SAVED_PLATFORM_PASSWORD:-voir fichier .env}"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  IMPORTANT${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  - Changez les mots de passe après la première connexion"
    echo "  - Configurez les paramètres SMTP dans .env pour les emails"
    echo "  - Sauvegardez le fichier .env en lieu sûr"
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  Commandes utiles${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo "  Voir les logs:     docker compose logs -f"
    echo "  Arrêter:           docker compose down"
    echo "  Redémarrer:        docker compose restart"
    echo "  Mise à jour:       git pull && docker compose up -d --build"
    echo "  Backup:            bash deploy/backup.sh"
    echo ""
    echo "  Ou utilisez le Makefile: make help"
    echo ""
}

# Menu principal
main() {
    print_banner

    case "${1:-install}" in
        install)
            check_prerequisites
            setup_environment
            start_services
            init_database
            print_summary
            ;;
        start)
            log_info "Démarrage des services..."
            if docker compose version >/dev/null 2>&1; then
                docker compose up -d
            else
                docker-compose up -d
            fi
            log_success "Services démarrés"
            ;;
        stop)
            log_info "Arrêt des services..."
            if docker compose version >/dev/null 2>&1; then
                docker compose down
            else
                docker-compose down
            fi
            log_success "Services arrêtés"
            ;;
        restart)
            log_info "Redémarrage des services..."
            if docker compose version >/dev/null 2>&1; then
                docker compose restart
            else
                docker-compose restart
            fi
            log_success "Services redémarrés"
            ;;
        logs)
            if docker compose version >/dev/null 2>&1; then
                docker compose logs -f
            else
                docker-compose logs -f
            fi
            ;;
        status)
            if docker compose version >/dev/null 2>&1; then
                docker compose ps
            else
                docker-compose ps
            fi
            ;;
        update)
            log_info "Mise à jour de l'application..."
            git pull
            if docker compose version >/dev/null 2>&1; then
                docker compose up -d --build
            else
                docker-compose up -d --build
            fi
            log_success "Mise à jour terminée"
            ;;
        --auto)
            AUTO_MODE="true"
            check_prerequisites
            setup_environment
            start_services
            init_database
            print_summary
            ;;
        --help|-h)
            echo "Usage: $0 [COMMAND] [OPTIONS]"
            echo ""
            echo "Commandes:"
            echo "  install     Installation complète (défaut)"
            echo "  start       Démarrer les services"
            echo "  stop        Arrêter les services"
            echo "  restart     Redémarrer les services"
            echo "  logs        Voir les logs"
            echo "  status      Statut des services"
            echo "  update      Mettre à jour l'application"
            echo ""
            echo "Options:"
            echo "  --auto      Mode automatique (sans prompts)"
            echo "  --help      Afficher cette aide"
            echo ""
            echo "Variables d'environnement (mode auto):"
            echo "  ADMIN_EMAIL              Email admin entreprise"
            echo "  ADMIN_PASSWORD           Mot de passe admin entreprise"
            echo "  PLATFORM_ADMIN_EMAIL     Email admin plateforme"
            echo "  PLATFORM_ADMIN_PASSWORD  Mot de passe admin plateforme"
            echo "  FRONTEND_URL             URL du frontend"
            echo "  FRONTEND_PORT            Port du frontend"
            echo "  BACKEND_PORT             Port du backend"
            echo ""
            echo "Exemple mode automatique:"
            echo "  AUTO_MODE=true ADMIN_EMAIL=admin@example.com ./install.sh"
            ;;
        *)
            echo "Usage: $0 {install|start|stop|restart|logs|status|update|--auto|--help}"
            exit 1
            ;;
    esac
}

# Exécuter
main "$@"
