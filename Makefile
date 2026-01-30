# ===========================================
# SOS - Makefile
# Commandes simplifiées pour le déploiement
# ===========================================

.PHONY: help install deploy start stop restart logs status build clean backup restore seed shell-backend shell-db test lint

# Couleurs
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
RED := \033[0;31m
NC := \033[0m

# Variables
COMPOSE := docker compose
PROJECT := sos

# Aide par défaut
help:
	@echo ""
	@echo "$(BLUE)╔═══════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║           SOS - Commandes disponibles                     ║$(NC)"
	@echo "$(BLUE)╚═══════════════════════════════════════════════════════════╝$(NC)"
	@echo ""
	@echo "$(GREEN)Installation & Déploiement:$(NC)"
	@echo "  make install       Installer sur serveur vierge (interactif)"
	@echo "  make install-auto  Installer en mode automatique"
	@echo "  make deploy        Alias pour install"
	@echo "  make setup-dev     Configuration développement local"
	@echo ""
	@echo "$(GREEN)Gestion des services:$(NC)"
	@echo "  make start         Démarrer tous les services"
	@echo "  make stop          Arrêter tous les services"
	@echo "  make restart       Redémarrer tous les services"
	@echo "  make status        Voir le statut des services"
	@echo "  make logs          Voir les logs (Ctrl+C pour quitter)"
	@echo "  make logs-backend  Logs du backend uniquement"
	@echo "  make logs-frontend Logs du frontend uniquement"
	@echo ""
	@echo "$(GREEN)Base de données:$(NC)"
	@echo "  make seed          Exécuter les seeds"
	@echo "  make seed-platform Seed de l'admin plateforme"
	@echo "  make backup        Effectuer un backup"
	@echo "  make restore       Restaurer un backup (BACKUP=<file>)"
	@echo "  make shell-db      Console PostgreSQL"
	@echo ""
	@echo "$(GREEN)Développement:$(NC)"
	@echo "  make build         Construire les images Docker"
	@echo "  make rebuild       Reconstruire sans cache"
	@echo "  make shell-backend Console bash backend"
	@echo "  make test          Lancer les tests"
	@echo "  make lint          Vérifier le code"
	@echo ""
	@echo "$(GREEN)Maintenance:$(NC)"
	@echo "  make clean         Nettoyer images et volumes non utilisés"
	@echo "  make clean-all     Tout nettoyer (ATTENTION: perte de données)"
	@echo "  make update        Mettre à jour l'application"
	@echo "  make health        Vérifier la santé des services"
	@echo ""

# ============================================
# INSTALLATION
# ============================================

install:
	@echo "$(BLUE)Démarrage de l'installation...$(NC)"
	@sudo bash deploy/deploy.sh

install-auto:
	@echo "$(BLUE)Installation automatique...$(NC)"
	@sudo bash deploy/deploy.sh --auto

deploy: install

setup-dev:
	@echo "$(BLUE)Configuration développement...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(GREEN)Fichier .env créé$(NC)"; \
	fi
	@$(COMPOSE) build
	@$(COMPOSE) up -d
	@echo "$(YELLOW)Attente des services...$(NC)"
	@sleep 10
	@$(COMPOSE) exec -T backend node src/seeds/run.js || true
	@$(COMPOSE) exec -T backend node src/seeds/platform_admin.js || true
	@echo ""
	@echo "$(GREEN)✓ Environnement de développement prêt!$(NC)"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:3001"
	@echo "  Platform: http://localhost:3000/platform/login"

# ============================================
# GESTION DES SERVICES
# ============================================

start:
	@echo "$(BLUE)Démarrage des services...$(NC)"
	@$(COMPOSE) up -d
	@echo "$(GREEN)✓ Services démarrés$(NC)"

stop:
	@echo "$(BLUE)Arrêt des services...$(NC)"
	@$(COMPOSE) down
	@echo "$(GREEN)✓ Services arrêtés$(NC)"

restart:
	@echo "$(BLUE)Redémarrage des services...$(NC)"
	@$(COMPOSE) restart
	@echo "$(GREEN)✓ Services redémarrés$(NC)"

status:
	@echo "$(BLUE)Statut des services:$(NC)"
	@$(COMPOSE) ps

logs:
	@$(COMPOSE) logs -f

logs-backend:
	@$(COMPOSE) logs -f backend

logs-frontend:
	@$(COMPOSE) logs -f frontend

logs-db:
	@$(COMPOSE) logs -f postgres

# ============================================
# BASE DE DONNÉES
# ============================================

seed:
	@echo "$(BLUE)Exécution des seeds...$(NC)"
	@$(COMPOSE) exec -T backend node src/seeds/run.js
	@echo "$(GREEN)✓ Seeds exécutés$(NC)"

seed-platform:
	@echo "$(BLUE)Création de l'admin plateforme...$(NC)"
	@$(COMPOSE) exec -T backend node src/seeds/platform_admin.js
	@echo "$(GREEN)✓ Admin plateforme créé$(NC)"

seed-all: seed seed-platform

backup:
	@echo "$(BLUE)Création du backup...$(NC)"
	@bash deploy/backup.sh
	@echo "$(GREEN)✓ Backup terminé$(NC)"

restore:
	@if [ -z "$(BACKUP)" ]; then \
		echo "$(RED)Erreur: Spécifiez le fichier avec BACKUP=<fichier>$(NC)"; \
		echo "Exemple: make restore BACKUP=backups/sos_backup_20240101_120000.sql.gz"; \
		exit 1; \
	fi
	@bash deploy/restore.sh $(BACKUP)

shell-db:
	@echo "$(BLUE)Connexion à PostgreSQL...$(NC)"
	@$(COMPOSE) exec postgres psql -U sos_user -d sos_db

# ============================================
# DÉVELOPPEMENT
# ============================================

build:
	@echo "$(BLUE)Construction des images...$(NC)"
	@$(COMPOSE) build
	@echo "$(GREEN)✓ Images construites$(NC)"

rebuild:
	@echo "$(BLUE)Reconstruction complète...$(NC)"
	@$(COMPOSE) build --no-cache
	@echo "$(GREEN)✓ Images reconstruites$(NC)"

shell-backend:
	@echo "$(BLUE)Console backend...$(NC)"
	@$(COMPOSE) exec backend sh

test:
	@echo "$(BLUE)Exécution des tests...$(NC)"
	@$(COMPOSE) exec -T backend npm test || true
	@$(COMPOSE) exec -T frontend npm test || true

lint:
	@echo "$(BLUE)Vérification du code...$(NC)"
	@$(COMPOSE) exec -T backend npm run lint || true
	@$(COMPOSE) exec -T frontend npm run lint || true

# ============================================
# MAINTENANCE
# ============================================

clean:
	@echo "$(BLUE)Nettoyage des ressources non utilisées...$(NC)"
	@docker system prune -f
	@echo "$(GREEN)✓ Nettoyage terminé$(NC)"

clean-all:
	@echo "$(RED)ATTENTION: Cette action supprimera TOUTES les données!$(NC)"
	@read -p "Êtes-vous sûr? (yes/no): " confirm; \
	if [ "$$confirm" = "yes" ]; then \
		$(COMPOSE) down -v --remove-orphans; \
		docker system prune -af; \
		echo "$(GREEN)✓ Nettoyage complet terminé$(NC)"; \
	else \
		echo "Annulé"; \
	fi

update:
	@echo "$(BLUE)Mise à jour de l'application...$(NC)"
	@git pull
	@$(COMPOSE) build
	@$(COMPOSE) up -d
	@echo "$(GREEN)✓ Mise à jour terminée$(NC)"

health:
	@echo "$(BLUE)Vérification de la santé des services...$(NC)"
	@echo ""
	@echo "PostgreSQL:"
	@$(COMPOSE) exec -T postgres pg_isready -U sos_user -d sos_db && echo "  $(GREEN)✓ OK$(NC)" || echo "  $(RED)✗ Erreur$(NC)"
	@echo ""
	@echo "Backend:"
	@curl -sf http://localhost:3001/api/health > /dev/null && echo "  $(GREEN)✓ OK$(NC)" || echo "  $(RED)✗ Erreur$(NC)"
	@echo ""
	@echo "Frontend:"
	@curl -sf http://localhost:3000 > /dev/null && echo "  $(GREEN)✓ OK$(NC)" || echo "  $(RED)✗ Erreur$(NC)"
	@echo ""

# ============================================
# PRODUCTION
# ============================================

production:
	@echo "$(BLUE)Démarrage en mode production avec Nginx...$(NC)"
	@$(COMPOSE) --profile production up -d
	@echo "$(GREEN)✓ Mode production activé$(NC)"

ssl-renew:
	@echo "$(BLUE)Renouvellement du certificat SSL...$(NC)"
	@docker run --rm \
		-v $(PWD)/certbot/conf:/etc/letsencrypt \
		-v $(PWD)/certbot/www:/var/www/certbot \
		certbot/certbot renew
	@$(COMPOSE) exec nginx nginx -s reload
	@echo "$(GREEN)✓ Certificat renouvelé$(NC)"
