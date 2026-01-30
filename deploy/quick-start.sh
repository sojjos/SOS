#!/bin/bash

# ===========================================
# SOS - Script de démarrage rapide
# Déploiement en une seule commande
# ===========================================
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/your-repo/SOS/main/deploy/quick-start.sh | sudo bash
#
# Ou avec configuration personnalisée:
#   curl -fsSL ... | DOMAIN=sos.example.com ENABLE_SSL=true SSL_EMAIL=admin@example.com sudo -E bash
#

set -e

# Configuration
REPO_URL="${REPO_URL:-https://github.com/your-repo/SOS.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/sos}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
cat << 'EOF'
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║     ███████╗ ██████╗ ███████╗                            ║
    ║     ██╔════╝██╔═══██╗██╔════╝                            ║
    ║     ███████╗██║   ██║███████╗                            ║
    ║     ╚════██║██║   ██║╚════██║                            ║
    ║     ███████║╚██████╔╝███████║                            ║
    ║     ╚══════╝ ╚═════╝ ╚══════╝                            ║
    ║                                                           ║
    ║         Quick Start Installation                          ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Vérifier si root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Ce script doit être exécuté en tant que root${NC}"
    echo "Utilisez: curl ... | sudo bash"
    exit 1
fi

echo -e "${BLUE}[INFO]${NC} Installation de Git..."
apt-get update -qq && apt-get install -y -qq git || dnf install -y -q git

echo -e "${BLUE}[INFO]${NC} Clonage du dépôt..."
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${BLUE}[INFO]${NC} Mise à jour du dépôt existant..."
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

echo -e "${BLUE}[INFO]${NC} Lancement de l'installation..."
export AUTO_MODE=true
bash deploy/deploy.sh --auto

echo -e "${GREEN}[OK]${NC} Installation terminée!"
echo ""
echo "Consultez les identifiants dans: $INSTALL_DIR/CREDENTIALS.txt"
