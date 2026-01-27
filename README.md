# SOS - Short Operational Summary

Systeme de gestion des incidents et tickets operationnels avec workflow de validation hierarchique pour STEF.

## Table des matieres

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture hierarchique](#architecture-hierarchique)
3. [Roles et permissions](#roles-et-permissions)
4. [Interfaces par role](#interfaces-par-role)
5. [Workflow des tickets](#workflow-des-tickets)
6. [Installation](#installation)
7. [Configuration](#configuration)
8. [API Reference](#api-reference)

---

## Vue d'ensemble

SOS est un systeme de ticketing concu pour gerer les incidents operationnels dans un environnement multi-sites avec une hierarchie a plusieurs niveaux.

### Caracteristiques principales

- **Multi-agences** : Chaque site a sa propre configuration
- **Double branche hierarchique** : Terrain et Administratif
- **Workflow de validation** : Les tickets remontent dans la hierarchie
- **Commentaires confidentiels** : Visibilite basee sur le niveau
- **SLA automatiques** : Calcul selon urgence et blocage
- **Vue syndicat** : Acces anonymise aux statistiques

---

## Architecture hierarchique

### Les deux branches

```
                     DIRECTION
                         |
        +----------------+----------------+
        |                                 |
    TERRAIN                          ADMINISTRATIF
        |                                 |
   +----+----+                      +-----+-----+
   |         |                      |           |
 Niv 2    Niv 2                   Niv 2      Niv 2
   |         |                      |           |
 Niv 1    Niv 1                   Niv 1      Niv 1
   |         |                      |           |
 Niv 0    Niv 0                   Niv 0      Niv 0
```

### Niveaux hierarchiques types

| Niveau | Terrain | Administratif |
|--------|---------|---------------|
| 0 | Operateur, Cariste, Manutentionnaire | Employe bureau, Secretaire |
| 1 | Chef d'equipe, Team Leader | Responsable RH, Comptable senior |
| 2 | Responsable de quai, Chef de secteur | Directeur administratif |
| 3 | Directeur de site | Directeur de site |

### Separation des branches

- Un ticket cree par un **Niveau 0 Terrain** n'est visible que par les **Niveaux 1+ Terrain**
- Un ticket cree par un **Niveau 0 Administratif** n'est visible que par les **Niveaux 1+ Administratif**
- Les utilisateurs avec **les deux profils** voient les deux branches

---

## Roles et permissions

### Matrice des permissions

| Permission | Niv 0 | Niv 1 | Niv 2 | Niv 3 | Admin |
|------------|-------|-------|-------|-------|-------|
| Creer ticket | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir ses tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir tickets equipe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Voir tous tickets site | ❌ | ❌ | ✅ | ✅ | ✅ |
| Valider tickets | ❌ | ✅ | ✅ | ✅ | ✅ |
| Escalader tickets | ❌ | ✅ | ✅ | ✅ | ✅ |
| Resoudre tickets | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modifier urgence | ❌ | ✅ | ✅ | ✅ | ✅ |
| Commentaires confidentiels | ❌ | Selon groupe | Selon groupe | ✅ | ✅ |
| Visibilite syndicat | ❌ | ❌ | ✅ | ✅ | ✅ |
| Dashboard equipe | ❌ | ✅ | ✅ | ✅ | ✅ |
| Dashboard site | ❌ | ❌ | ✅ | ✅ | ✅ |
| Dashboard direction | ❌ | ❌ | ❌ | ✅ | ✅ |
| Dashboard multi-sites | ❌ | ❌ | ❌ | ❌ | ✅ |
| Gestion utilisateurs | ❌ | ❌ | ❌ | ❌ | ✅ |
| Configuration agence | ❌ | ❌ | ❌ | ❌ | ✅ |

### Types de profils

| Profil | Description | Acces |
|--------|-------------|-------|
| `terrain` | Operations, production, logistique | Tickets terrain uniquement |
| `administratif` | Bureau, RH, comptabilite | Tickets admin uniquement |
| `terrain + administratif` | Managers transverses | Les deux branches |

---

## Interfaces par role

### 1. Connexion (tous)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                         SOS                                 │
│                Short Operational Summary                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Email                                              │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │ jean.dupont@stef.com                          │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  Mot de passe                                       │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │ ••••••••••••                                  │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                                                     │   │
│  │  [        SE CONNECTER        ]                     │   │
│  │                                                     │   │
│  │  Mot de passe oublie ?    Demander un compte        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Selection du site (multi-sites)

```
┌─────────────────────────────────────────────────────────────┐
│  SOS           [Menu]                    Jean D. ▼          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Selectionnez votre site de travail                         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🏭 STEF Rungis                                     │   │
│  │     Chef d'equipe - Terrain                         │   │
│  │     12 tickets en attente                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🏭 STEF Lyon                                       │   │
│  │     Operateur - Terrain                             │   │
│  │     2 tickets en attente                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Dashboard Personnel (Niveau 0)

```
┌─────────────────────────────────────────────────────────────┐
│  SOS    STEF Rungis                      Jean Dupont ▼      │
│  [Dashboard] [Tickets] [+ Nouveau]       Operateur          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Bonjour Jean ! Voici vos tickets.                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │    3     │  │    1     │  │    2     │  │    5     │    │
│  │ En cours │  │ Critique │  │ En retard│  │ Ce mois  │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                             │
│  MES TICKETS RECENTS                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠️ TKT-0042  Temperature chambre froide    [HAUTE]  │   │
│  │    En attente validation • Cree il y a 2h           │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ 🔧 TKT-0038  Chariot en panne             [MOYENNE] │   │
│  │    En cours • Assigne a M. Martin                   │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ✅ TKT-0035  Eclairage zone B             [BASSE]   │   │
│  │    Resolu • Cloture le 25/01                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4. Dashboard Equipe (Niveau 1+)

```
┌─────────────────────────────────────────────────────────────┐
│  SOS    STEF Rungis                      Marie Martin ▼     │
│  [Dashboard] [Equipe] [Tickets] [+ Nouveau]  Chef d'equipe  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Dashboard Equipe - Terrain                                 │
│                                                             │
│  ⚠️ 5 TICKETS EN ATTENTE DE VALIDATION                      │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   12     │  │    3     │  │   89%    │  │   2.4h   │    │
│  │ En cours │  │Critiques │  │ SLA OK   │  │Temps moy.│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                             │
│  A VALIDER                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠️ TKT-0042  Jean Dupont (Operateur)                │   │
│  │    Temperature chambre froide • Propose: HAUTE      │   │
│  │    [Valider] [Voir]                                 │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ ⚠️ TKT-0043  Paul Bernard (Cariste)                 │   │
│  │    Transpalette defectueux • Propose: MOYENNE       │   │
│  │    [Valider] [Voir]                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  PERFORMANCE EQUIPE                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Graphique: tickets resolus par jour]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5. Dashboard Site (Niveau 2+)

```
┌─────────────────────────────────────────────────────────────┐
│  SOS    STEF Rungis                    Pierre Durand ▼      │
│  [Dashboard] [Site] [Equipes] [Tickets]  Resp. de site      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Vue Site - STEF Rungis                                     │
│                                                             │
│  ┌───────────────────┐  ┌───────────────────┐              │
│  │ TERRAIN           │  │ ADMINISTRATIF     │              │
│  │ 45 tickets actifs │  │ 12 tickets actifs │              │
│  │ 92% SLA OK        │  │ 98% SLA OK        │              │
│  └───────────────────┘  └───────────────────┘              │
│                                                             │
│  REPARTITION PAR TYPE                                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Froid/Temperature  ████████████████  35%           │   │
│  │  Materiel           ████████████      25%           │   │
│  │  Infrastructure     ████████          18%           │   │
│  │  Securite           ██████            12%           │   │
│  │  Autre              ████              10%           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TICKETS CRITIQUES                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 TKT-0042  Chambre froide - SLA dans 2h           │   │
│  │ 🔴 TKT-0044  Quai 3 inaccessible - SLA depasse      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6. Dashboard Direction (Niveau 3)

```
┌─────────────────────────────────────────────────────────────┐
│  SOS    STEF Rungis                    Dir. Site ▼          │
│  [Dashboard] [Direction] [Rapports] [Export]                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Vue Direction - STEF Rungis                                │
│                                                             │
│  TENDANCES (30 derniers jours)                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     ^                                               │   │
│  │  30 │    ╱╲                                         │   │
│  │  20 │   ╱  ╲    ╱╲                                  │   │
│  │  10 │  ╱    ╲──╱  ╲──                               │   │
│  │     └─────────────────────────────────────>         │   │
│  │       Sem1   Sem2   Sem3   Sem4                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TOP 5 PROBLEMES (Pareto)                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. Temperature        ████████████████████  42%     │   │
│  │ 2. Materiel           ██████████████       28%      │   │
│  │ 3. Infrastructure     ████████             15%      │   │
│  │ 4. RH                 ████                  8%      │   │
│  │ 5. Autre              ██                    7%      │   │
│  │                                     Total: 100%     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  PERFORMANCE PAR RESPONSABLE                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ M. Martin    ████████████ 95% SLA  │ 45 resolus    │   │
│  │ P. Bernard   ██████████   88% SLA  │ 32 resolus    │   │
│  │ L. Petit     █████████    85% SLA  │ 28 resolus    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7. Dashboard Multi-Sites (Admin)

```
┌─────────────────────────────────────────────────────────────┐
│  SOS    Mode Admin                       Admin ▼            │
│  [Sites] [Utilisateurs] [Configuration] [Logs]              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Comparaison Multi-Sites                                    │
│                                                             │
│  ┌──────────────────┬────────┬─────────┬─────────┬───────┐ │
│  │ Site             │Tickets │ SLA OK  │ Critiq. │ Trend │ │
│  ├──────────────────┼────────┼─────────┼─────────┼───────┤ │
│  │ STEF Rungis      │   127  │   92%   │    3    │  ↗️   │ │
│  │ STEF Lyon        │    89  │   95%   │    1    │  →    │ │
│  │ STEF Marseille   │   103  │   87%   │    5    │  ↘️   │ │
│  │ STEF Bordeaux    │    65  │   98%   │    0    │  ↗️   │ │
│  └──────────────────┴────────┴─────────┴─────────┴───────┘ │
│                                                             │
│  ALERTES                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔴 STEF Marseille: 5 tickets critiques non traites  │   │
│  │ ⚠️ STEF Rungis: SLA en baisse (-3% cette semaine)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8. Creation de Ticket

```
┌─────────────────────────────────────────────────────────────┐
│  ← Retour                        Nouveau ticket             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  (Si double profil)                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 🏭 TERRAIN          │  │ 🏢 ADMINISTRATIF    │          │
│  │ Operations, prod.   │  │ Bureau, RH          │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  INFORMATIONS DU PROBLEME                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Titre *                                             │   │
│  │ [Temperature anormale chambre froide 2            ] │   │
│  │                                                     │   │
│  │ Description *                                       │   │
│  │ [La temperature est montee a -12°C au lieu de     ]│   │
│  │ [-18°C. Alarme declenchee a 6h30.                 ]│   │
│  │                                                     │   │
│  │ Type de probleme *         Lieu                     │   │
│  │ [Froid/Temperature ▼]      [Chambre froide 2 ▼]    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  NIVEAU D'URGENCE PROPOSE                                   │
│  ┌───────────────┐ ┌───────────────┐                       │
│  │ ○ Basse      │ │ ○ Moyenne     │                       │
│  │   Impact min. │ │   Delais norm.│                       │
│  └───────────────┘ └───────────────┘                       │
│  ┌───────────────┐ ┌───────────────┐                       │
│  │ ● Haute      │ │ ○ Critique    │                       │
│  │   Prioritaire │ │   Urgent      │                       │
│  └───────────────┘ └───────────────┘                       │
│                                                             │
│  IMPACT SUR L'ACTIVITE                                      │
│  ○ Non bloquant   ● Partiel   ○ Bloquant                   │
│                                                             │
│                    [Annuler]  [Creer le ticket]            │
└─────────────────────────────────────────────────────────────┘
```

### 9. Detail Ticket (Vue Validateur)

```
┌─────────────────────────────────────────────────────────────┐
│  ← Retour   TKT-0042                    [En attente] [Haute]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠️ Ce ticket attend votre validation                │   │
│  │    (En charge: Chef d'equipe)                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠️ ACTION REQUISE                        [Traiter]  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Details] [Historique (3)]                                 │
│                                                             │
│  DESCRIPTION                                                │
│  Temperature chambre froide montee a -12°C au lieu de      │
│  -18°C requis. Alarme declenchee a 6h30.                   │
│                                                             │
│  ┌────────────────────┐  ┌──────────────────────────────┐  │
│  │ INFORMATIONS       │  │ COMMENTAIRES (2)             │  │
│  │                    │  │                              │  │
│  │ Type: Froid        │  │ 👤 Jean Dupont (Operateur)   │  │
│  │ Lieu: CF 2         │  │    07:15 - Alarme sonnait    │  │
│  │                    │  │    deja a mon arrivee.       │  │
│  │ Cree par:          │  │                              │  │
│  │ Jean Dupont        │  │ 👤 Moi (Chef d'equipe)       │  │
│  │ Operateur          │  │    08:30 - Technicien        │  │
│  │                    │  │    contacte.                 │  │
│  │ Cree le:           │  │                              │  │
│  │ 27/01 07:15        │  │ 🔒 [Note confidentielle]     │  │
│  └────────────────────┘  │    Direction uniquement      │  │
│                          └──────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 10. Panel de Validation

```
┌─────────────────────────────────────────────────────────────┐
│  ACTIONS SUR LE TICKET                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  EVALUER L'URGENCE                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Niveau d'urgence      Niveau de blocage            │   │
│  │  [Haute ▼]             [Partiel ▼]                  │   │
│  │  ⚠️ Propose: Haute                                   │   │
│  │                                                     │   │
│  │  Justification (si modifie):                        │   │
│  │  [                                                ] │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  CHOISIR UNE ACTION                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ● ▶️ Prendre en charge                              │   │
│  │       Je m'occupe de ce ticket                      │   │
│  │                                                     │   │
│  │  ○ ⬆️ Escalader                                      │   │
│  │       Remonter au niveau superieur                  │   │
│  │       [Raison de l'escalade...]                     │   │
│  │                                                     │   │
│  │  ○ ⬇️ Retourner                                      │   │
│  │       Renvoyer au createur pour plus d'infos        │   │
│  │       [Information manquante...]                    │   │
│  │                                                     │   │
│  │  ○ ✅ Resoudre                                       │   │
│  │       Marquer comme resolu                          │   │
│  │       [Type: Resolu ▼]                              │   │
│  │       [Description de la resolution...]             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                         [Annuler]  [Confirmer]             │
└─────────────────────────────────────────────────────────────┘
```

### 11. Vue Syndicat

```
┌─────────────────────────────────────────────────────────────┐
│  SOS - Vue Syndicat                    Rep. Syndical ▼      │
│  [Dashboard] [Tickets] [Statistiques]                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Statistiques Syndicales - STEF Rungis                      │
│                                                             │
│  ⚠️ Cette vue anonymise les donnees personnelles            │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   127    │  │   89%    │  │    8     │  │   4.2    │    │
│  │ Tickets  │  │ SLA OK   │  │Critiques │  │ Jours moy│    │
│  │ ce mois  │  │          │  │ ce mois  │  │resolution│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                             │
│  TYPES DE PROBLEMES LES PLUS FREQUENTS                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Temperature/Froid  ████████████████  35%           │   │
│  │  Materiel           ████████████      25%           │   │
│  │  Securite           ████████          18%           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TICKETS VISIBLES (donnees anonymisees)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TKT-0042  Temperature chambre froide    [En cours]  │   │
│  │           Type: Froid • SLA: OK • Anciennete: 2j    │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ TKT-0038  Equipement de securite        [Resolu]    │   │
│  │           Type: Securite • SLA: OK • Resolu en 1j   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 12. Administration (Admin)

```
┌─────────────────────────────────────────────────────────────┐
│  SOS - Administration                    Admin ▼            │
│  [Agences] [Utilisateurs] [Demandes] [Logs]                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Configuration - STEF Rungis                                │
│                                                             │
│  [Niveaux] [Types] [Lieux] [SLA] [Groupes confidentiels]   │
│                                                             │
│  NIVEAUX HIERARCHIQUES                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Niv │ Terrain           │ Administratif             │   │
│  ├─────┼───────────────────┼───────────────────────────┤   │
│  │  0  │ Operateur         │ Employe bureau            │   │
│  │  1  │ Chef d'equipe     │ Responsable RH            │   │
│  │  2  │ Resp. de quai     │ Directeur admin           │   │
│  │  3  │ Directeur site    │ Directeur site            │   │
│  └─────────────────────────────────────────────────────┘   │
│  [+ Ajouter niveau]                                        │
│                                                             │
│  TYPES DE PROBLEMES                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Nom                  │ Niveau min │ Actif │ Actions │   │
│  ├──────────────────────┼────────────┼───────┼─────────┤   │
│  │ Temperature/Froid    │     0      │  ✅   │ [Edit]  │   │
│  │ Materiel             │     0      │  ✅   │ [Edit]  │   │
│  │ Demande RH           │     1      │  ✅   │ [Edit]  │   │
│  │ Audit qualite        │     2      │  ✅   │ [Edit]  │   │
│  └─────────────────────────────────────────────────────┘   │
│  [+ Ajouter type]                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Workflow des tickets

### Cycle de vie d'un ticket

```
                    ┌─────────────┐
                    │   NOUVEAU   │
                    └──────┬──────┘
                           │ Creation par Niv 0
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

### Actions par statut

| Statut | Qui peut agir | Actions disponibles |
|--------|---------------|---------------------|
| Nouveau | Createur | Modifier, Annuler |
| En attente validation | Niveau N+1 | Valider, Escalader, Retourner |
| En cours | Responsable | Resoudre, Escalader, Commenter |
| Resolu | Createur/Responsable | Cloturer, Reouvrir |
| Cloture | - | Consultation seule |

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

# Lancer l'installation
./install.sh
```

### Acces

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Application web |
| API | http://localhost:3001/api | API REST |
| Health | http://localhost:3001/api/health | Verification sante |

---

## Configuration

### Variables d'environnement

```env
# Base de donnees
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=sos
POSTGRES_PASSWORD=votre_mot_de_passe_securise
POSTGRES_DB=sos

# JWT
JWT_SECRET=votre_secret_jwt_tres_long
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# SMTP (optionnel)
SMTP_HOST=smtp.votredomaine.com
SMTP_PORT=587
SMTP_USER=noreply@votredomaine.com
SMTP_PASS=votre_mot_de_passe
EMAIL_FROM=SOS <noreply@votredomaine.com>

# Application
NODE_ENV=production
FRONTEND_URL=http://localhost:3000
```

### Configuration par agence

Chaque agence peut configurer :

- **Niveaux hierarchiques** : Noms et permissions par niveau
- **Types de problemes** : Categories avec niveau minimum requis
- **Lieux** : Zones du site (terrain, administratif, commun)
- **SLA** : Delais selon urgence et niveau de blocage
- **Groupes de confidentialite** : Qui peut lire/ecrire

---

## API Reference

### Authentification

```
POST /api/auth/login          # Connexion
POST /api/auth/logout         # Deconnexion
POST /api/auth/refresh        # Rafraichir token
GET  /api/auth/me             # Profil utilisateur
```

### Tickets

```
GET    /api/tickets           # Liste (filtree par permissions)
GET    /api/tickets/:id       # Detail
POST   /api/tickets           # Creer
PUT    /api/tickets/:id/validate  # Valider/Escalader/Retourner
PUT    /api/tickets/:id/status    # Changer statut
POST   /api/tickets/:id/comments  # Ajouter commentaire
GET    /api/tickets/:id/history   # Historique
```

### Dashboard

```
GET /api/dashboard/personal   # Personnel (tous)
GET /api/dashboard/team       # Equipe (Niv 1+)
GET /api/dashboard/site       # Site (Niv 2+)
GET /api/dashboard/direction  # Direction (Niv 3)
GET /api/dashboard/multi-sites # Multi-sites (Admin)
```

### Administration

```
GET/POST   /api/admin/agencies              # Agences
GET/POST   /api/admin/agencies/:id/levels   # Niveaux
GET/POST   /api/admin/agencies/:id/problem-types  # Types
GET/POST   /api/admin/agencies/:id/locations      # Lieux
GET/PUT    /api/admin/agencies/:id/sla            # SLA
GET/POST   /api/admin/users                 # Utilisateurs
```

---

## Structure du projet

```
SOS/
├── backend/                    # API Node.js/Express
│   ├── src/
│   │   ├── config/            # Configuration DB
│   │   ├── database/          # Schema SQL
│   │   ├── middlewares/       # Auth, permissions
│   │   ├── routes/            # Endpoints API
│   │   ├── services/          # Email, etc.
│   │   └── index.js           # Point d'entree
│   ├── Dockerfile
│   └── package.json
│
├── frontend/                   # App React/Vite
│   ├── src/
│   │   ├── layouts/           # Auth, Main
│   │   ├── pages/             # Toutes les pages
│   │   │   ├── admin/         # Administration
│   │   │   ├── dashboard/     # Tableaux de bord
│   │   │   ├── tickets/       # Gestion tickets
│   │   │   └── union/         # Vue syndicat
│   │   ├── services/          # API client
│   │   ├── store/             # Etat global (Zustand)
│   │   └── App.jsx            # Router
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml          # Orchestration
├── install.sh                  # Installation
├── .env.example               # Variables env
└── README.md                  # Documentation
```

---

## Securite

- **Authentification** : JWT avec refresh tokens
- **Permissions** : Basees sur niveau hierarchique et profile_type
- **Audit trail** : Historique complet, pas de suppression
- **Confidentialite** : Commentaires visibles selon groupe
- **Rate limiting** : Protection contre les abus
- **Headers** : Helmet pour securite HTTP

---

## Support

Pour signaler un bug ou demander une fonctionnalite :
1. Verifier les issues existantes
2. Creer une nouvelle issue avec description detaillee
3. Inclure les logs si erreur

---

## Licence

Proprietaire - STEF - Tous droits reserves
