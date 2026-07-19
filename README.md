# Petit Pavé — signaler les problèmes de rue à Marseille

Site gratuit, sans inscription, où les habitants signalent en quelques secondes un problème dans leur rue (voirie, éclairage, déchets, mobilier urbain, espaces verts, eau, signalisation, accessibilité...) avec une photo et un commentaire. **Tous les signalements sont visibles par tout le monde**, sur une carte commune.

## Comment c'est construit

- `index.html`, `css/style.css`, `js/app.js` — le site (ce que les visiteurs voient)
- `functions/api/reports.js` et `functions/api/reports/[id].js` — le "serveur" (reçoit les signalements, les stocke, les renvoie à tout le monde)
- `schema.sql` — la structure de la base de données à créer une seule fois

Tout tourne sur **Cloudflare** (hébergement + base de données), dans la limite gratuite, avec HTTPS automatique et la protection anti-attaques de Cloudflare incluse.

## Publier le site (une seule fois, ~15-20 minutes, aucune ligne de commande)

### 1. Mettre les fichiers sur GitHub

1. Crée un compte gratuit sur [github.com](https://github.com) si tu n'en as pas
2. Crée un nouveau dépôt (bouton vert "New"), nomme-le par exemple `petit-pave`, laisse-le public ou privé, ne coche aucune case d'initialisation
3. Sur la page du dépôt vide, clique sur "uploading an existing file" et glisse-dépose tous les fichiers et dossiers de ce projet (en gardant bien la structure des dossiers `css/`, `js/`, `functions/`)
4. Valide ("Commit changes")

### 2. Créer la base de données (Cloudflare D1)

1. Crée un compte gratuit sur [dash.cloudflare.com](https://dash.cloudflare.com)
2. Dans le menu de gauche : **Workers & Pages** → onglet **Storage & Databases** → **D1** → **Create database**
3. Donne-lui un nom, par exemple `petit-pave-db`, et crée-la
4. Ouvre cette base, va dans l'onglet **Console**, colle tout le contenu du fichier `schema.sql` de ce projet, et clique sur "Execute" — ça crée la table qui va stocker les signalements

### 3. Publier le site (Cloudflare Pages)

1. Toujours dans **Workers & Pages**, onglet **Overview** → **Create** → **Pages** → **Connect to Git**
2. Autorise Cloudflare à accéder à ton compte GitHub, puis choisis le dépôt `petit-pave`
3. Dans les réglages de build : laisse la commande de build vide et le dossier de sortie sur `/` (racine) — c'est un site statique, il n'y a rien à compiler
4. Clique sur **Save and Deploy** — Cloudflare te donne une adresse du type `petit-pave.pages.dev`

### 4. Relier le site à la base de données

1. Dans ton projet Pages fraîchement créé : **Settings** → **Functions** → section **D1 database bindings** → **Add binding**
2. Variable name : `DB` (exactement ce nom, en majuscules)
3. D1 database : choisis `petit-pave-db`
4. Sauvegarde, puis retourne dans l'onglet **Deployments** et relance un déploiement (bouton "Retry deployment" sur le dernier) pour que le lien avec la base soit pris en compte

C'est fait : le site est en ligne, et tous les visiteurs voient les mêmes signalements sur la carte.

## Comment faire des modifications ensuite

À chaque fois que tu veux changer un texte, une couleur, ajouter une catégorie, etc. : dis-moi ce que tu veux changer, je modifie les fichiers, et il te suffit de les re-glisser sur GitHub (même écran "Add file" → "Upload files", ça remplace les anciens). Cloudflare republie automatiquement le site en moins d'une minute, sans rien recréer.

Tu peux aussi éditer un petit texte directement sur GitHub (bouton crayon ✏️ sur un fichier) sans repasser par moi.

## Sécurité et anti-abus déjà en place

- Aucune base ni fichier n'est accessible directement : tout passe par les fonctions `functions/api/*`, qui valident chaque envoi (catégorie autorisée, position dans la région de Marseille, taille de photo limitée, commentaire limité à 140 caractères)
- Une limite de 8 signalements par heure et par visiteur (identifié de façon anonyme, sans stocker son IP en clair) pour éviter le spam
- Un champ invisible ("piège à robots") pour bloquer les robots qui remplissent les formulaires automatiquement
- HTTPS et protection réseau assurés par Cloudflare

## Prochaines étapes possibles

- Nom de domaine personnalisé (ex. `petitpave.fr`) au lieu de `*.pages.dev`
- Modération : un espace pour supprimer un signalement abusif
- Filtrage par arrondissement, statistiques, export pour la mairie
