# SOS - Short Operational Summary

Systeme de gestion des incidents et tickets operationnels avec workflow de validation hierarchique - Architecture SaaS Multi-Tenant.

## Table des matieres

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture SaaS Multi-Tenant](#architecture-saas-multi-tenant)
3. [Roles et permissions](#roles-et-permissions)
4. [Interfaces Plateforme Admin](#interfaces-plateforme-admin)
5. [Interfaces Entreprise](#interfaces-entreprise)
6. [Workflow des tickets](#workflow-des-tickets)
7. [Fonctionnalites avancees](#fonctionnalites-avancees)
8. [Installation](#installation)
9. [Configuration](#configuration)
10. [API Reference](#api-reference)

---

## Vue d'ensemble

SOS est une plateforme SaaS de ticketing concue pour gerer les incidents operationnels dans un environnement multi-entreprises et multi-sites avec une hierarchie a plusieurs niveaux.

### Caracteristiques principales

- **Architecture SaaS** : Multi-tenant avec isolation des donnees par entreprise
- **Multi-agences** : Chaque entreprise peut gerer plusieurs sites
- **Double branche hierarchique** : Terrain et Administratif
- **Workflow de validation** : Les tickets remontent dans la hierarchie
- **Commentaires confidentiels** : Visibilite basee sur le niveau
- **SLA automatiques** : Calcul selon urgence et blocage
- **Vue syndicat** : Acces anonymise aux statistiques
- **PWA** : Application installable sur mobile
- **Notifications temps reel** : WebSocket pour alertes instantanees
- **Analytics avances** : Tableaux de bord et KPIs

---

## Architecture SaaS Multi-Tenant

### Hierarchie de la plateforme

```
┌─────────────────────────────────────────────────────────────────┐
│                    PLATEFORME SOS                               │
│  (Super Admins - Gestion globale)                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ ENTREPRISE 1│  │ ENTREPRISE 2│  │ ENTREPRISE 3│  ...        │
│  │  (Tenant)   │  │  (Tenant)   │  │  (Tenant)   │             │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤             │
│  │ - Site A    │  │ - Site X    │  │ - Site P    │             │
│  │ - Site B    │  │ - Site Y    │  │ - Site Q    │             │
│  │ - Site C    │  │             │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Systeme de codes d'invitation

| Type de code | Utilisation | Cree par |
|--------------|-------------|----------|
| `REG-XXXXXXXX` | Inscription nouvelle entreprise | Super Admin Plateforme |
| `ADM-XXXXXXXX` | Invitation administrateur entreprise | Super Admin ou Admin entreprise |
| `USR-XXXXXXXX` | Invitation utilisateur | Admin entreprise |

### Plans d'abonnement

| Plan | Sites max | Utilisateurs max | Admins max | Stockage |
|------|-----------|------------------|------------|----------|
| Starter | 5 | 50 | 3 | 5 Go |
| Professional | 15 | 200 | 10 | 20 Go |
| Enterprise | 50 | 1000 | 50 | 100 Go |
| Unlimited | Illimite | Illimite | Illimite | Illimite |

---

## Roles et permissions

### Niveaux de la plateforme

| Niveau | Role | Acces |
|--------|------|-------|
| Plateforme | Super Admin | Toutes les entreprises, configuration globale |
| Plateforme | Admin | Gestion entreprises, lecture seule |
| Plateforme | Viewer | Consultation statistiques globales |
| Entreprise | Admin | Configuration complete de l'entreprise |
| Entreprise | Admin Delegue | Gestion utilisateurs et sites |
| Site | Niveau 3 | Direction du site |
| Site | Niveau 2 | Responsable de zone |
| Site | Niveau 1 | Chef d'equipe |
| Site | Niveau 0 | Operateur |

### Matrice des permissions par niveau

| Permission | Niv 0 | Niv 1 | Niv 2 | Niv 3 | Admin |
|------------|-------|-------|-------|-------|-------|
| Creer ticket | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir ses tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir tickets equipe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Voir tous tickets site | ❌ | ❌ | ✅ | ✅ | ✅ |
| Valider tickets | ❌ | ✅ | ✅ | ✅ | ✅ |
| Escalader tickets | ❌ | ✅ | ✅ | ✅ | ✅ |
| Dashboard equipe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Dashboard site | ❌ | ❌ | ✅ | ✅ | ✅ |
| Analytics avances | ❌ | ❌ | ✅ | ✅ | ✅ |
| Dashboard direction | ❌ | ❌ | ❌ | ✅ | ✅ |
| Dashboard multi-sites | ❌ | ❌ | ❌ | ❌ | ✅ |
| Gestion utilisateurs | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Interfaces Plateforme Admin

### 1. Connexion Plateforme Admin

**URL:** `/platform/login`

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ┌──────────────┐                             │
│                    │    🛡️        │                             │
│                    └──────────────┘                             │
│                                                                 │
│                    SOS Platform                                 │
│                Administration de la plateforme                  │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  📧 Email                                               │  │
│   │  ┌───────────────────────────────────────────────────┐  │  │
│   │  │ platform@sos.local                                │  │  │
│   │  └───────────────────────────────────────────────────┘  │  │
│   │                                                         │  │
│   │  🔒 Mot de passe                                        │  │
│   │  ┌───────────────────────────────────────────────────┐  │  │
│   │  │ ••••••••••••                                      │  │  │
│   │  └───────────────────────────────────────────────────┘  │  │
│   │                                                         │  │
│   │         [🛡️ SE CONNECTER]                               │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│           Acces reserve aux administrateurs plateforme          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Identifiants par defaut:**
- Email: `platform@sos.local`
- Mot de passe: `PlatformAdmin123!`

### 2. Dashboard Plateforme

**URL:** `/platform/dashboard`

```
┌─────────────────────────────────────────────────────────────────┐
│ 🛡️ SOS Platform      │ Dashboard │ Entreprises │ Codes │ Admins │
├──────────────────────┴────────────────────────────────────────┤
│                                                                 │
│  Dashboard Plateforme                    [Systeme OK ✅ 2ms]    │
│  Vue d'ensemble de la plateforme SOS                            │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │     12     │  │     45     │  │    234     │  │   1,847    ││
│  │ Entreprises│  │   Sites    │  │Utilisateurs│  │  Tickets   ││
│  │ 10 actives │  │   actifs   │  │ 15 admins  │  │ 127 (24h)  ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                 │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ ⚠️ ALERTES                  │ │ 📈 ENTREPRISES RECENTES     ││
│  │                             │ │                             ││
│  │ 🟡 TechCorp - Trial expire  │ │ 🏢 LogiTrans      [actif]  ││
│  │    dans 3 jours             │ │    5 sites, 45 utilisateurs ││
│  │ 🔴 DataCo - Limite sites    │ │                             ││
│  │    atteinte (5/5)           │ │ 🏢 FreshFood      [trial]  ││
│  │                             │ │    2 sites, 12 utilisateurs ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │ 🔥 TOP ACTIVES (7j)         │ │ 📋 ACTIVITE RECENTE         ││
│  │                             │ │                             ││
│  │ 1. STEF Logistics  89 tkts  │ │ Admin P. - company_created  ││
│  │ 2. TransCold       67 tkts  │ │   LogiTrans - il y a 2h     ││
│  │ 3. FreshChain      45 tkts  │ │                             ││
│  │                             │ │ Admin P. - invitation_sent  ││
│  │                             │ │   ADM-X8K2P - il y a 3h     ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Gestion des Entreprises

**URL:** `/platform/companies`

```
┌─────────────────────────────────────────────────────────────────┐
│ 🛡️ SOS Platform                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Entreprises                        [+ Nouvelle entreprise]     │
│  12 entreprises au total                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔍 Rechercher...  │ Statut ▼ │ Plan ▼ │  [Rechercher]       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Entreprise      │ Plan    │ Statut │Sites│Users│Tkts│Actions││
│  ├─────────────────┼─────────┼────────┼─────┼─────┼────┼───────┤│
│  │ 🏢 STEF Logist. │ Enterpr.│ ✅actif│ 8/50│120/ │847 │ ⋮     ││
│  │    stef         │         │        │     │1000 │    │       ││
│  ├─────────────────┼─────────┼────────┼─────┼─────┼────┼───────┤│
│  │ 🏢 TransCold    │ Profes. │ ✅actif│ 5/15│ 45/ │234 │ ⋮     ││
│  │    transcold    │         │        │     │ 200 │    │       ││
│  ├─────────────────┼─────────┼────────┼─────┼─────┼────┼───────┤│
│  │ 🏢 FreshFood    │ Starter │ 🔵trial│ 2/5 │ 12/ │ 45 │ ⋮     ││
│  │    freshfood    │         │ 27j    │     │  50 │    │       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ◀ Page 1 sur 2 ▶                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Modal Creation Entreprise

```
┌─────────────────────────────────────────────────────────────────┐
│  Nouvelle entreprise                                      ✕     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Nom de l'entreprise *           Slug *                         │
│  ┌─────────────────────────┐     ┌─────────────────────────┐   │
│  │ Ma Nouvelle Entreprise  │     │ ma-nouvelle-entreprise  │   │
│  └─────────────────────────┘     └─────────────────────────┘   │
│                                                                 │
│  Email contact *                 Telephone                      │
│  ┌─────────────────────────┐     ┌─────────────────────────┐   │
│  │ contact@entreprise.com  │     │ +33 1 23 45 67 89       │   │
│  └─────────────────────────┘     └─────────────────────────┘   │
│                                                                 │
│  Nom du contact                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Jean Dupont                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Plan                            Jours d'essai                  │
│  ┌─────────────────────────┐     ┌─────────────────────────┐   │
│  │ Starter            ▼    │     │ 30                      │   │
│  └─────────────────────────┘     └─────────────────────────┘   │
│                                                                 │
│  Max sites    Max utilisateurs   Max admins                     │
│  ┌─────────┐  ┌─────────┐        ┌─────────┐                   │
│  │    5    │  │   50    │        │    3    │                   │
│  └─────────┘  └─────────┘        └─────────┘                   │
│                                                                 │
│                        [Annuler]  [Creer l'entreprise]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Gestion des Codes d'Invitation

**URL:** `/platform/invitations`

```
┌─────────────────────────────────────────────────────────────────┐
│ 🛡️ SOS Platform                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Codes d'invitation                        [+ Nouveau code]     │
│  48 codes au total                                              │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔍 Rechercher  │Entreprise ▼│ Type ▼ │Statut ▼│ [Filtrer]   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Code           │ Type       │ Entreprise │Util.│Stat│Actions││
│  ├────────────────┼────────────┼────────────┼─────┼────┼───────┤│
│  │ REG-A8K2P9X4   │ 🟣Entrep.  │ -          │ 0/1 │ ✅ │📋 👁 🗑││
│  │                │            │            │     │    │       ││
│  ├────────────────┼────────────┼────────────┼─────┼────┼───────┤│
│  │ ADM-B7J3M6N2   │ 🔵Admin    │ STEF Log.  │ 1/1 │ ✅ │📋 👁 🗑││
│  │                │            │            │     │    │       ││
│  ├────────────────┼────────────┼────────────┼─────┼────┼───────┤│
│  │ USR-C4K8P2Q5   │ 🟢User     │ TransCold  │ 3/10│ ✅ │📋 👁 🗑││
│  │                │            │            │     │    │       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Gestion des Administrateurs Plateforme

**URL:** `/platform/admins`

```
┌─────────────────────────────────────────────────────────────────┐
│ 🛡️ SOS Platform                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Administrateurs                           [+ Nouvel admin]     │
│  Gestion des administrateurs de la plateforme                   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Admin                  │ Role       │ Statut │ Connexion    ││
│  ├────────────────────────┼────────────┼────────┼──────────────┤│
│  │ 👤 Platform Admin      │ 🟣Super    │ ✅Actif│ il y a 5min  ││
│  │    platform@sos.local  │   Admin    │        │              ││
│  ├────────────────────────┼────────────┼────────┼──────────────┤│
│  │ 👤 Jean Martin         │ 🔵Admin    │ ✅Actif│ il y a 2h    ││
│  │    jean@sos.local      │            │        │   ✏️ 🔑 🗑   ││
│  ├────────────────────────┼────────────┼────────┼──────────────┤│
│  │ 👤 Marie Durand        │ ⚪Viewer   │ ✅Actif│ Jamais       ││
│  │    marie@sos.local     │            │        │   ✏️ 🔑 🗑   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interfaces Entreprise

### 1. Page d'Inscription Entreprise

**URL:** `/register`

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ┌──────────────┐                             │
│                    │    🏢        │                             │
│                    └──────────────┘                             │
│                                                                 │
│                  Code d'invitation                              │
│           Entrez votre code d'invitation                        │
│                                                                 │
│             ①━━━━━━━━━━━━━━━━━━○                                │
│           Code              Formulaire                          │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  🔑 Code d'invitation                                   │  │
│   │  ┌───────────────────────────────────────────────────┐  │  │
│   │  │ REG-A8K2P9X4                                      │  │  │
│   │  └───────────────────────────────────────────────────┘  │  │
│   │                                                         │  │
│   │              [Valider le code ➡️]                        │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│           Deja un compte ? Se connecter                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Formulaire Creation Entreprise (Etape 2)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                  Creer votre entreprise                         │
│       Configurez votre entreprise et compte administrateur      │
│                                                                 │
│             ●━━━━━━━━━━━━━━━━━━●                                │
│           Code              Formulaire                          │
│                                                                 │
│   ═══════════════ INFORMATIONS ENTREPRISE ═══════════════      │
│                                                                 │
│   Nom de l'entreprise *          Identifiant (slug) *           │
│   ┌─────────────────────────┐    ┌─────────────────────────┐   │
│   │ STEF Logistics          │    │ stef-logistics          │   │
│   └─────────────────────────┘    └─────────────────────────┘   │
│                                                                 │
│   Adresse                        Ville                          │
│   ┌─────────────────────────┐    ┌─────────────────────────┐   │
│   │ 123 rue du Froid        │    │ Paris                   │   │
│   └─────────────────────────┘    └─────────────────────────┘   │
│                                                                 │
│   ═══════════════ COMPTE ADMINISTRATEUR ═══════════════        │
│                                                                 │
│   Prenom *                       Nom *                          │
│   ┌─────────────────────────┐    ┌─────────────────────────┐   │
│   │ Jean                    │    │ Dupont                  │   │
│   └─────────────────────────┘    └─────────────────────────┘   │
│                                                                 │
│   Email *                        Telephone                      │
│   ┌─────────────────────────┐    ┌─────────────────────────┐   │
│   │ jean@stef.com           │    │ +33 6 12 34 56 78       │   │
│   └─────────────────────────┘    └─────────────────────────┘   │
│                                                                 │
│   Mot de passe *                 Confirmer *                    │
│   ┌─────────────────────────┐    ┌─────────────────────────┐   │
│   │ ••••••••••••            │    │ ••••••••••••            │   │
│   └─────────────────────────┘    └─────────────────────────┘   │
│                                                                 │
│         [⬅️ Retour]              [Creer mon compte ✅]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Connexion Utilisateur

**URL:** `/login`

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ┌──────────────┐                             │
│                    │    SOS       │                             │
│                    └──────────────┘                             │
│                Short Operational Summary                        │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │                                                         │  │
│   │  📧 Email                                               │  │
│   │  ┌───────────────────────────────────────────────────┐  │  │
│   │  │ jean.dupont@stef.com                              │  │  │
│   │  └───────────────────────────────────────────────────┘  │  │
│   │                                                         │  │
│   │  🔒 Mot de passe                                        │  │
│   │  ┌───────────────────────────────────────────────────┐  │  │
│   │  │ ••••••••••••                                      │  │  │
│   │  └───────────────────────────────────────────────────┘  │  │
│   │                                                         │  │
│   │         [SE CONNECTER]                                  │  │
│   │                                                         │  │
│   │  Mot de passe oublie ?         Creer un compte          │  │
│   │                                                         │  │
│   └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 4. Dashboard Personnel (Niveau 0)

**URL:** `/`

```
┌─────────────────────────────────────────────────────────────────┐
│  SOS   │ STEF Rungis ▼ │                    🔔(3)  Jean D. ▼   │
│  [Dashboard] [Tickets] [Notifications] [Profil]                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Bonjour Jean ! Voici vos tickets.       [+ Nouveau ticket]     │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │     3      │  │     1      │  │     2      │  │     5      ││
│  │  En cours  │  │ 🔴Critique │  │ ⚠️En retard│  │  Ce mois   ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                 │
│  MES TICKETS RECENTS                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚠️ #0042  Temperature chambre froide          [HAUTE]       ││
│  │           En attente validation • Cree il y a 2h            ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ 🔧 #0038  Chariot elevateur en panne          [MOYENNE]     ││
│  │           En cours • Assigne a M. Martin                    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ✅ #0035  Eclairage zone B defaillant         [BASSE]       ││
│  │           Resolu • Cloture le 25/01                         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                          Voir tous les tickets →                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Dashboard Equipe (Niveau 1+)

```
┌─────────────────────────────────────────────────────────────────┐
│  SOS   │ STEF Rungis ▼ │                    🔔(5)  Marie M. ▼  │
│  [Personnel] [Equipe] [Site] [Analytics]    Chef d'equipe       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dashboard Equipe - Terrain                                     │
│                                                                 │
│  ⚠️ 5 TICKETS EN ATTENTE DE VALIDATION                          │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │    12      │  │     3      │  │    89%     │  │   2.4h     ││
│  │  En cours  │  │ Critiques  │  │  SLA OK    │  │ Temps moy. ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                 │
│  A VALIDER                                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚠️ #0042  Jean Dupont (Operateur)                           ││
│  │           Temperature chambre froide • Propose: HAUTE       ││
│  │                              [Valider] [Modifier] [Voir]    ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ ⚠️ #0043  Paul Bernard (Cariste)                            ││
│  │           Transpalette defectueux • Propose: MOYENNE        ││
│  │                              [Valider] [Modifier] [Voir]    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  PERFORMANCE EQUIPE                                             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📊 [Graphique: Tickets resolus par jour - 7 derniers jours] ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Analytics Avances (Niveau 2+)

**URL:** `/analytics`

```
┌─────────────────────────────────────────────────────────────────┐
│  SOS   │ STEF Rungis ▼ │                        Pierre D. ▼    │
│  [Dashboard] [Tickets] [Analytics]              Resp. site      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Analytics                          Periode: [30 jours ▼]       │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │    127     │  │   4.2h     │  │    92%     │  │   +15%     ││
│  │  Tickets   │  │ Resolution │  │  SLA OK    │  │ vs periode ││
│  │  crees     │  │  moyenne   │  │            │  │ precedente ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ TENDANCE JOURNALIERE                                        ││
│  │                                                             ││
│  │     ^                                                       ││
│  │  15 │    ╱╲                                                 ││
│  │  10 │   ╱  ╲    ╱╲    ╱╲                                    ││
│  │   5 │  ╱    ╲──╱  ╲──╱  ╲──                                 ││
│  │     └─────────────────────────────────────>                 ││
│  │       L    M    M    J    V    S    D                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌────────────────────────────┐ ┌──────────────────────────────┐│
│  │ SLA PAR TYPE               │ │ DISTRIBUTION HORAIRE         ││
│  │                            │ │                              ││
│  │ Froid      ████████ 95%   │ │  [Heatmap 24h x 7j]          ││
│  │ Materiel   ██████   85%   │ │                              ││
│  │ Securite   ███████  90%   │ │  Pics: 8h-10h, 14h-16h       ││
│  │ Infra      █████    78%   │ │                              ││
│  └────────────────────────────┘ └──────────────────────────────┘│
│                                                                 │
│  TICKETS LES PLUS LENTS                                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ #0012 │ Renovation quai 3    │ 15 jours │ Infra     │ 🔴SLA ││
│  │ #0028 │ Remplacement groupe  │ 8 jours  │ Froid     │ ⚠️    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7. Liste des Tickets avec Recherche Avancee

**URL:** `/tickets`

```
┌─────────────────────────────────────────────────────────────────┐
│  SOS   │ STEF Rungis ▼ │                        Jean D. ▼      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tickets                                   [+ Nouveau ticket]   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 🔍 Recherche texte...                                       ││
│  │                                                             ││
│  │ Statut        Urgence       Blocage       Type              ││
│  │ [Tous ▼]      [Tous ▼]      [Tous ▼]      [Tous ▼]          ││
│  │                                                             ││
│  │ Lieu          Date debut    Date fin      ☐ SLA depasse     ││
│  │ [Tous ▼]      [📅        ]  [📅        ]                    ││
│  │                                                             ││
│  │                    [Reinitialiser]  [Rechercher]            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  127 tickets trouves                                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ # │ Titre                    │Statut    │Urgence│Responsable││
│  ├───┼──────────────────────────┼──────────┼───────┼───────────┤│
│  │042│ Temperature chambre      │🟡Attente │🔴Haute│ M.Martin  ││
│  │041│ Chariot panne            │🟢En cours│🟡Moy. │ P.Bernard ││
│  │040│ Eclairage zone B         │✅Resolu  │🟢Basse│ L.Petit   ││
│  │039│ Alarme incendie test     │✅Resolu  │🟡Moy. │ J.Dupont  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ◀ 1 2 3 4 5 ... 13 ▶                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8. Creation de Ticket avec Templates

**URL:** `/tickets/new`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Retour                            Nouveau ticket             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  📋 UTILISER UN TEMPLATE                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Selectionner un template (optionnel)                    ▼  ││
│  │ ├─ 🌡️ Probleme temperature chambre froide                  ││
│  │ ├─ 🔧 Panne equipement manutention                         ││
│  │ ├─ ⚡ Probleme electrique                                   ││
│  │ └─ 🚨 Incident securite                                     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  (Si double profil)                                             │
│  ┌────────────────────────┐  ┌────────────────────────┐        │
│  │ 🏭 TERRAIN             │  │ 🏢 ADMINISTRATIF       │        │
│  │ [Selectionne]          │  │                        │        │
│  └────────────────────────┘  └────────────────────────┘        │
│                                                                 │
│  INFORMATIONS DU PROBLEME                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Titre *                                                     ││
│  │ [Temperature anormale chambre froide 2                    ] ││
│  │                                                             ││
│  │ Description *                                               ││
│  │ [La temperature est montee a -12C au lieu de -18C requis. ]││
│  │ [Alarme declenchee a 6h30 ce matin.                       ]││
│  │                                                             ││
│  │ Type de probleme *             Lieu *                       ││
│  │ [Froid/Temperature    ▼]       [Chambre froide 2    ▼]     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  NIVEAU D'URGENCE PROPOSE                                       │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐       │
│  │ ○ Basse   │ │ ○ Moyenne │ │ ● Haute   │ │ ○ Critique│       │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘       │
│                                                                 │
│  IMPACT SUR L'ACTIVITE                                          │
│  ○ Non bloquant     ● Partiellement bloquant     ○ Bloquant    │
│                                                                 │
│  📎 Ajouter des pieces jointes                                  │
│                                                                 │
│                          [Annuler]  [Creer le ticket]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9. Detail Ticket avec Timeline

**URL:** `/tickets/:id`

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Retour    #0042                    [En attente] [🔴 Haute]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Temperature anormale chambre froide 2                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⚠️ Ce ticket attend validation par un niveau superieur      ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  [Details] [Historique] [Fichiers (2)]                          │
│                                                                 │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐│
│  │ INFORMATIONS            │  │ TIMELINE                       ││
│  │                         │  │                                ││
│  │ Type: Froid/Temperature │  │ 📝 Cree par Jean Dupont        ││
│  │ Lieu: Chambre froide 2  │  │    27/01 07:15                 ││
│  │ Urgence: Haute          │  │                                ││
│  │ Blocage: Partiel        │  │ 💬 Commentaire ajoute          ││
│  │                         │  │    J. Dupont - 07:30           ││
│  │ Cree par:               │  │    "Alarme sonnait deja"       ││
│  │ Jean Dupont             │  │                                ││
│  │ Operateur - Terrain     │  │ 📎 Photo ajoutee               ││
│  │                         │  │    J. Dupont - 07:32           ││
│  │ Cree le: 27/01 07:15    │  │                                ││
│  │ SLA: 28/01 19:15        │  │ ⏳ En attente validation       ││
│  │                         │  │    depuis 2h                   ││
│  └─────────────────────────┘  └────────────────────────────────┘│
│                                                                 │
│  DESCRIPTION                                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ La temperature de la chambre froide 2 est montee a -12C    ││
│  │ au lieu des -18C requis. L'alarme s'est declenchee a 6h30  ││
│  │ ce matin. Les produits risquent d'etre compromis.          ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  COMMENTAIRES (2)                      [+ Ajouter commentaire]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 👤 Jean Dupont • 27/01 07:30                                ││
│  │    L'alarme sonnait deja a mon arrivee a 6h.               ││
│  │                                                             ││
│  │ 👤 Marie Martin • 27/01 08:45                               ││
│  │    Technicien frigoriste contacte, intervention prevue.    ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10. Vue Syndicat

**URL:** `/union`

```
┌─────────────────────────────────────────────────────────────────┐
│  SOS - Vue Syndicat                        Rep. Syndical ▼      │
│  [Dashboard] [Tickets] [Statistiques]                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Statistiques Syndicales - STEF Rungis                          │
│                                                                 │
│  ⚠️ Cette vue anonymise les donnees personnelles                │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │    127     │  │    89%     │  │     8      │  │    4.2j    ││
│  │  Tickets   │  │  SLA OK    │  │ Critiques  │  │ Resolution ││
│  │  ce mois   │  │            │  │  ce mois   │  │  moyenne   ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                 │
│  REPARTITION PAR TYPE                                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Temperature/Froid  ████████████████████  35%               ││
│  │  Materiel           ████████████████      25%               ││
│  │  Securite           ████████████          18%               ││
│  │  Infrastructure     ████████              12%               ││
│  │  Autre              ██████                10%               ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  TICKETS VISIBLES (anonymises)                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ #0042 │ Temperature chambre froide │ En cours │ SLA: OK    ││
│  │ #0038 │ Equipement securite        │ Resolu   │ 1j         ││
│  │ #0035 │ Probleme eclairage         │ Resolu   │ 2j         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 11. Administration Entreprise

**URL:** `/admin`

```
┌─────────────────────────────────────────────────────────────────┐
│  SOS    [🛡️ Mode Admin]                        Admin ▼          │
│  [Vue d'ensemble] [Agences] [Utilisateurs] [Logs] [Multi-Sites] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Administration - STEF Logistics                                │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │     8      │  │    120     │  │    847     │  │    92%     ││
│  │   Sites    │  │Utilisateurs│  │  Tickets   │  │  SLA OK    ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                 │
│  SITES                                        [+ Nouveau site]  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Site           │ Utilisateurs │ Tickets │ SLA  │ Actions   ││
│  ├────────────────┼──────────────┼─────────┼──────┼───────────┤│
│  │ STEF Rungis    │      35      │   234   │ 94%  │ ⚙️ ✏️     ││
│  │ STEF Lyon      │      28      │   189   │ 91%  │ ⚙️ ✏️     ││
│  │ STEF Marseille │      22      │   156   │ 87%  │ ⚙️ ✏️     ││
│  │ STEF Bordeaux  │      18      │   134   │ 96%  │ ⚙️ ✏️     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  DEMANDES D'ACCES EN ATTENTE (3)                                │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Marie Durand │ marie@email.com │ Rungis │ [✅] [❌]         ││
│  │ Paul Martin  │ paul@email.com  │ Lyon   │ [✅] [❌]         ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 12. Notifications Temps Reel

**Dropdown dans le header**

```
┌─────────────────────────────────────────────────────────────────┐
│                                           🔔(3)  Jean D. ▼      │
│                                    ┌────────────────────────────┐
│                                    │ NOTIFICATIONS              │
│                                    │                            │
│                                    │ 🟢 Nouveau                 │
│                                    │ Ticket #0045 cree          │
│                                    │ il y a 2 min               │
│                                    │                            │
│                                    │ 🟡 Mis a jour              │
│                                    │ Ticket #0042 valide        │
│                                    │ il y a 15 min              │
│                                    │                            │
│                                    │ 🔴 Urgent                  │
│                                    │ SLA depasse #0038          │
│                                    │ il y a 1h                  │
│                                    │                            │
│                                    │ Voir toutes →              │
│                                    └────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow des tickets

### Cycle de vie

```
                    ┌─────────────┐
                    │   NOUVEAU   │
                    └──────┬──────┘
                           │ Creation
                           ▼
              ┌────────────────────────┐
              │  EN ATTENTE VALIDATION │
              └────────────┬───────────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │ RETOURNE │   │ EN COURS │   │ ESCALADE │
     └──────────┘   └────┬─────┘   └────┬─────┘
            │            │              │
            │            ▼              │
            │     ┌──────────┐          │
            │     │  RESOLU  │          │
            │     └────┬─────┘          │
            │          │                │
            │          ▼                │
            │     ┌──────────┐          │
            └────>│  CLOTURE │<─────────┘
                  └──────────┘
```

---

## Fonctionnalites avancees

### PWA (Progressive Web App)

- Installation sur l'ecran d'accueil (mobile/desktop)
- Fonctionnement hors-ligne (mode degrade)
- Notifications push
- Mise a jour automatique

### WebSocket (Temps reel)

- Notifications instantanees
- Mise a jour des listes en direct
- Indicateurs de connexion

### Templates de tickets

- Templates pre-configures par agence
- Remplissage automatique des champs
- Restriction par niveau hierarchique

### Recherche avancee

- Recherche full-text
- Filtres multiples combinables
- Sauvegarde des filtres

### Analytics

- KPIs avec comparaison de periodes
- Graphiques de tendances
- Heatmap de distribution horaire
- Export des donnees

---

## Installation

### Prerequis

- Docker et Docker Compose
- Git
- 2 Go RAM minimum
- 10 Go espace disque

### Installation rapide

```bash
# Cloner le repository
git clone <url-du-repo> sos
cd sos

# Configurer les variables d'environnement
cp .env.example .env
# Editer .env avec vos valeurs

# Lancer les services
docker-compose up -d

# L'application est accessible sur:
# - Frontend: http://localhost:3000
# - API: http://localhost:3001
# - Platform Admin: http://localhost:3000/platform/login
```

### Acces par defaut

| Interface | URL | Identifiants |
|-----------|-----|--------------|
| Platform Admin | `/platform/login` | `platform@sos.local` / `PlatformAdmin123!` |
| Application | `/login` | Creer via code d'invitation |

---

## Configuration

### Variables d'environnement

```env
# Base de donnees
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=sos
POSTGRES_PASSWORD=votre_mot_de_passe
POSTGRES_DB=sos

# JWT
JWT_SECRET=votre_secret_jwt_securise
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d

# Application
NODE_ENV=production
FRONTEND_URL=http://localhost:3000
PORT=3001
```

---

## API Reference

### Authentification

```
POST /api/auth/login              # Connexion utilisateur
POST /api/auth/logout             # Deconnexion
POST /api/auth/refresh            # Rafraichir token
GET  /api/auth/me                 # Profil utilisateur
```

### Platform Admin

```
POST /api/platform/auth/login     # Connexion admin plateforme
GET  /api/platform/dashboard      # Dashboard plateforme
GET  /api/platform/companies      # Liste entreprises
POST /api/platform/companies      # Creer entreprise
GET  /api/platform/invitations    # Liste codes invitation
POST /api/platform/invitations    # Creer code invitation
GET  /api/platform/admins         # Liste admins plateforme
```

### Registration

```
POST /api/register/validate-code  # Valider code invitation
POST /api/register/company        # Inscrire entreprise
POST /api/register/user           # Inscrire utilisateur
```

### Tickets

```
GET    /api/tickets               # Liste tickets
GET    /api/tickets/:id           # Detail ticket
POST   /api/tickets               # Creer ticket
PUT    /api/tickets/:id           # Modifier ticket
POST   /api/tickets/:id/comments  # Ajouter commentaire
```

### Dashboard

```
GET /api/dashboard/personal       # Dashboard personnel
GET /api/dashboard/team           # Dashboard equipe
GET /api/dashboard/site           # Dashboard site
GET /api/dashboard/analytics      # Analytics avances
```

### Templates

```
GET  /api/templates               # Liste templates
POST /api/templates               # Creer template
```

---

## Structure du projet

```
SOS/
├── backend/
│   ├── src/
│   │   ├── config/           # Configuration DB
│   │   ├── database/         # Schema SQL
│   │   ├── middlewares/      # Auth, permissions
│   │   ├── routes/
│   │   │   ├── platform/     # Routes admin plateforme
│   │   │   ├── auth.js
│   │   │   ├── tickets.js
│   │   │   ├── dashboard.js
│   │   │   └── ...
│   │   ├── services/         # WebSocket, Email
│   │   └── index.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── layouts/
│   │   │   ├── MainLayout.jsx
│   │   │   ├── AuthLayout.jsx
│   │   │   └── PlatformLayout.jsx
│   │   ├── pages/
│   │   │   ├── platform/     # Pages admin plateforme
│   │   │   ├── admin/        # Pages admin entreprise
│   │   │   ├── tickets/
│   │   │   ├── auth/
│   │   │   └── ...
│   │   ├── components/
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   ├── platformApi.js
│   │   │   └── websocket.js
│   │   ├── store/
│   │   │   ├── authStore.js
│   │   │   └── platformStore.js
│   │   └── App.jsx
│   └── package.json
│
├── docker-compose.yml
└── README.md
```

---

## Securite

- **Architecture multi-tenant** : Isolation complete des donnees par entreprise
- **Authentification** : JWT avec refresh tokens
- **Permissions** : RBAC base sur niveau hierarchique
- **Audit trail** : Historique complet des actions
- **Rate limiting** : Protection contre les abus
- **Codes invitation** : Controle des inscriptions

---

## Licence

Proprietaire - Tous droits reserves
