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
NC='\033[0m' # No Color

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
    echo "║         Installation Script v1.0                          ║"
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

    if [ -f .env ]; then
        log_warning "Un fichier .env existe déjà"
        read -p "Voulez-vous le remplacer? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Conservation du fichier .env existant"
            return
        fi
    fi

    # Générer les secrets
    JWT_SECRET=$(generate_secret)
    JWT_REFRESH_SECRET=$(generate_secret)
    DB_PASSWORD=$(generate_secret | head -c 32)

    # Demander les informations
    echo ""
    echo -e "${YELLOW}Configuration de l'installation${NC}"
    echo "================================"
    echo ""

    read -p "Email administrateur [admin@sos.local]: " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-admin@sos.local}

    read -p "Mot de passe administrateur [généré aléatoirement]: " ADMIN_PASSWORD
    if [ -z "$ADMIN_PASSWORD" ]; then
        ADMIN_PASSWORD=$(generate_secret | head -c 16)
        echo "Mot de passe généré: $ADMIN_PASSWORD"
    fi

    read -p "URL du frontend [http://localhost:3000]: " FRONTEND_URL
    FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000}

    read -p "Port frontend [3000]: " FRONTEND_PORT
    FRONTEND_PORT=${FRONTEND_PORT:-3000}

    read -p "Port backend [3001]: " BACKEND_PORT
    BACKEND_PORT=${BACKEND_PORT:-3001}

    # Créer le fichier .env
    cat > .env << EOF
# Configuration générée automatiquement le $(date)

# Environnement
NODE_ENV=production

# Ports
FRONTEND_PORT=${FRONTEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
DB_PORT=5432

# Base de données
DB_NAME=sos_db
DB_USER=sos_user
DB_PASSWORD=${DB_PASSWORD}

# JWT
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}

# Admin
DEFAULT_ADMIN_EMAIL=${ADMIN_EMAIL}
DEFAULT_ADMIN_PASSWORD=${ADMIN_PASSWORD}

# URLs
FRONTEND_URL=${FRONTEND_URL}

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
EOF

    log_success "Fichier .env créé"
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
    $COMPOSE_CMD build --no-cache

    # Démarrer les services
    log_info "Démarrage des services..."
    $COMPOSE_CMD up -d

    # Attendre que les services soient prêts
    log_info "Attente du démarrage des services..."
    sleep 10

    # Vérifier la santé des services
    local max_attempts=30
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        if curl -s http://localhost:${BACKEND_PORT:-3001}/api/health | grep -q "healthy"; then
            log_success "Backend opérationnel"
            break
        fi
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_warning "Le backend n'a pas répondu dans le délai imparti"
        log_info "Vérifiez les logs avec: docker-compose logs backend"
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

    # Exécuter le seeding
    $COMPOSE_CMD exec -T backend node src/seeds/run.js || {
        log_warning "Le seeding a peut-être déjà été exécuté"
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
    echo -e "${BLUE}Accès à l'application:${NC}"
    echo "  URL Frontend: http://localhost:${FRONTEND_PORT:-3000}"
    echo "  URL API:      http://localhost:${BACKEND_PORT:-3001}/api"
    echo ""
    echo -e "${BLUE}Identifiants administrateur:${NC}"
    echo "  Email:        ${DEFAULT_ADMIN_EMAIL:-admin@sos.local}"
    echo "  Mot de passe: ${DEFAULT_ADMIN_PASSWORD:-voir fichier .env}"
    echo ""
    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo "  - Changez le mot de passe administrateur après la première connexion"
    echo "  - Configurez les paramètres SMTP dans .env pour les notifications email"
    echo "  - Sauvegardez le fichier .env en lieu sûr"
    echo ""
    echo -e "${BLUE}Commandes utiles:${NC}"
    echo "  Voir les logs:     docker-compose logs -f"
    echo "  Arrêter:           docker-compose down"
    echo "  Redémarrer:        docker-compose restart"
    echo "  Mise à jour:       git pull && docker-compose up -d --build"
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
            start_services
            ;;
        stop)
            log_info "Arrêt des services..."
            docker-compose down
            log_success "Services arrêtés"
            ;;
        restart)
            log_info "Redémarrage des services..."
            docker-compose restart
            log_success "Services redémarrés"
            ;;
        logs)
            docker-compose logs -f
            ;;
        status)
            docker-compose ps
            ;;
        update)
            log_info "Mise à jour de l'application..."
            git pull
            docker-compose up -d --build
            log_success "Mise à jour terminée"
            ;;
        *)
            echo "Usage: $0 {install|start|stop|restart|logs|status|update}"
            exit 1
            ;;
    esac
}

# Exécuter
main "$@"
