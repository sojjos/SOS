# SOS - Short Operational Summary

Système de gestion des incidents et tickets opérationnels avec workflow de validation hiérarchique.

## Fonctionnalités

### Gestion des tickets
- Création de tickets avec classification par type de problème
- Workflow de validation hiérarchique (niveau supérieur valide)
- Niveaux d'urgence : Critique, Haute, Moyenne, Basse
- Niveaux de blocage : Bloquant, Partiel, Non bloquant
- Calcul automatique des SLA selon urgence et niveau de blocage
- Escalade automatique vers le niveau supérieur

### Système multi-agences
- Configuration indépendante par agence
- Niveaux hiérarchiques personnalisables
- Types de problèmes configurables
- Lieux configurables
- SLA configurables

### Dashboards
- **Personnel** : Mes tickets, statuts, SLA
- **Équipe** : Performance de l'équipe, tickets à valider
- **Site** : Vue globale du site, analyse par type/urgence
- **Direction** : Tendances, Pareto, performance par responsable
- **Multi-sites** : Comparaison entre agences (admin)

### Gestion des utilisateurs
- Authentification JWT avec refresh tokens
- Niveaux hiérarchiques (0-3 + Admin)
- Accès multi-agences avec niveau différent par site
- Types de profils (Terrain, Administratif, Manager)
- Mode Admin vs Mode Agence pour les administrateurs

### Commentaires confidentiels
- Groupes de confidentialité configurables
- Visibilité basée sur le niveau hiérarchique
- Pas de modification/suppression (audit trail)

### Notifications
- Notifications in-app
- Emails automatiques (configurable)
- Alertes SLA

## Installation rapide

### Prérequis
- Docker et Docker Compose
- Git

### Installation

```bash
# Cloner le repository
git clone <url-du-repo> sos
cd sos

# Lancer l'installation
./install.sh
```

Le script va :
1. Vérifier les prérequis
2. Configurer les variables d'environnement
3. Construire les images Docker
4. Démarrer les services
5. Initialiser la base de données

### Accès

- **Frontend** : http://localhost:3000
- **API** : http://localhost:3001/api
- **Health check** : http://localhost:3001/api/health

## Installation manuelle

### 1. Configuration

```bash
# Copier le fichier d'exemple
cp .env.example .env

# Éditer avec vos valeurs
nano .env
```

### 2. Démarrage

```bash
# Construire et démarrer
docker-compose up -d --build

# Voir les logs
docker-compose logs -f

# Initialiser les données
docker-compose exec backend node src/seeds/run.js
```

## Structure du projet

```
SOS/
├── backend/                 # API Node.js/Express
│   ├── src/
│   │   ├── config/         # Configuration (base de données)
│   │   ├── middlewares/    # Middlewares (auth, permissions)
│   │   ├── migrations/     # Schéma SQL
│   │   ├── routes/         # Routes API
│   │   ├── seeds/          # Données initiales
│   │   ├── services/       # Services (email)
│   │   └── index.js        # Point d'entrée
│   ├── Dockerfile
│   └── package.json
│
├── frontend/               # App React/Vite
│   ├── src/
│   │   ├── layouts/       # Layouts (Auth, Main)
│   │   ├── pages/         # Pages
│   │   ├── services/      # API client
│   │   ├── store/         # État global (Zustand)
│   │   └── App.jsx        # Router principal
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml      # Orchestration Docker
├── install.sh              # Script d'installation
├── .env.example            # Variables d'environnement
└── README.md
```

## API Endpoints

### Authentification
- `POST /api/auth/login` - Connexion
- `POST /api/auth/register` - Inscription (si activé)
- `POST /api/auth/refresh` - Rafraîchir le token
- `GET /api/auth/me` - Profil utilisateur

### Tickets
- `GET /api/tickets` - Liste des tickets
- `GET /api/tickets/:id` - Détail d'un ticket
- `POST /api/tickets` - Créer un ticket
- `PUT /api/tickets/:id/validate` - Valider un ticket
- `PUT /api/tickets/:id/status` - Changer le statut
- `POST /api/tickets/:id/comments` - Ajouter un commentaire

### Dashboard
- `GET /api/dashboard/personal` - Dashboard personnel
- `GET /api/dashboard/team` - Dashboard équipe
- `GET /api/dashboard/site` - Dashboard site
- `GET /api/dashboard/direction` - Dashboard direction
- `GET /api/dashboard/multi-sites` - Multi-sites (admin)

### Administration
- `POST /api/admin/agencies` - Créer une agence
- `GET /api/admin/agencies/:id/hierarchy-levels` - Niveaux hiérarchiques
- `GET /api/admin/agencies/:id/problem-types` - Types de problèmes
- `GET /api/admin/agencies/:id/locations` - Lieux
- `GET /api/admin/agencies/:id/sla-configs` - Configuration SLA
- `GET /api/admin/users` - Liste des utilisateurs
- `GET /api/admin/logs` - Logs administrateur

## Commandes utiles

```bash
# Démarrer les services
./install.sh start

# Arrêter les services
./install.sh stop

# Redémarrer
./install.sh restart

# Voir les logs
./install.sh logs

# Statut des services
./install.sh status

# Mise à jour
./install.sh update
```

## Configuration SMTP

Pour activer les notifications email, configurez dans `.env` :

```env
SMTP_HOST=smtp.votredomaine.com
SMTP_PORT=587
SMTP_USER=noreply@votredomaine.com
SMTP_PASS=votre_mot_de_passe
EMAIL_FROM=noreply@votredomaine.com
```

## Sécurité

- Authentification JWT avec expiration
- Refresh tokens pour renouvellement automatique
- Rate limiting sur l'API
- Permissions basées sur le niveau hiérarchique
- Audit trail (pas de suppression des tickets/commentaires)
- Headers de sécurité (Helmet)
- CORS configuré

## Développement

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Licence

Propriétaire - Tous droits réservés
