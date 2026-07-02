# Refonte du portail OLDA en Bento Grid premium

## Contexte

Le portail (`index.html`, page unique statique servie par GitHub Pages) liste 8
outils publics (Planning, Site B2C, Site B2B, DTF, Devis Flash, Bon à Tirer,
Logo Client, Fiverr) en une rangée de tuiles, plus 5 accès protégés discrets
(icône noire, sans nom, URL chiffrée AES-GCM déverrouillée par mot de passe).

Objectif : un rendu "Standard Premium" — Bento Grid, glassmorphism subtil,
spring physics, squircles colorés — validé via le companion visuel
(voir décisions ci-dessous).

## Décisions validées avec l'utilisateur

- **Layout : Bento Grid**, pas de Dock macOS (rangée unique jugée trop proche
  de l'existant, moins de gain visuel).
- **Pas de hiérarchie de taille par fréquence d'usage** — l'usage varie trop
  d'un jour à l'autre. Grille régulière à 2 paliers seulement : cartes
  normales (8 outils publics) + rangée discrète plus petite (5 accès
  protégés), comme le traitement actuel des tuiles secrètes.
- **Palette : Duck Blue conservée** (`#4A6274` et dérivés) comme accent —
  cohérence avec l'identité OLDA existante (favicon, autres outils internes),
  pas de bascule vers un anthracite neutre générique.
- Icônes colorées existantes (SVG stroke, dégradés par outil) **conservées
  telles quelles**, seulement re-conteneurisées en squircles un peu plus
  prononcés.

## Design retenu

**Grille** : `grid-template-columns: repeat(4, 1fr)` desktop, cartes de même
taille (pas de `grid-row`/`grid-column` span variable). Responsive : 2
colonnes tablette/mobile large, 1 colonne très petit écran. Plus de scroll
horizontal forcé (contrairement à la version actuelle en rangée unique sur
petit écran).

**Cartes** : fond verre dépoli (`background: rgba(255,255,255,.62)` +
`backdrop-filter: blur(14px) saturate(160%)`), bordure translucide, ombre
diffuse douce, `border-radius: 22px`. Fond de page conservé (dégradés radiaux
Duck Blue existants sur blanc cassé).

**Icônes** : squircle `border-radius: 15px` (contre 17px actuellement —
légèrement plus resserré pour coller au look visionOS), dégradés couleur par
outil inchangés.

**Micro-interactions** : au survol, `transform: translateY(-5px) scale(1.02)`
avec easing à léger overshoot (`cubic-bezier(.34,1.56,.64,1)`, physique à
ressort) au lieu de l'easing actuel `cubic-bezier(.22,1,.36,1)` sans overshoot.
Ombre qui s'intensifie en cohérence.

**Rangée discrète (accès protégés)** : inchangée dans son principe (icône
noire sans nom, opacité réduite au repos, se révèle légèrement au survol),
repositionnée sous la grille principale plutôt qu'intégrée à la même rangée
que les tuiles publiques — pour marquer visuellement la séparation
public/protégé.

**Modale mot de passe** : même mécanique JS (AES-GCM/PBKDF2, rien ne change
côté chiffrement/déchiffrement), habillage visuel aligné sur le nouveau style
verre dépoli des cartes (au lieu du fond blanc opaque actuel).

**Odomètre / compteurs** : aucun compteur n'existe aujourd'hui sur cette page
(le convertisseur EUR/USD + horloge avait été ajouté puis retiré dans
l'historique git). On ne réintroduit rien de neuf — `font-variant-numeric:
tabular-nums` déjà présent sur `body` suffit à préparer le terrain si des
compteurs sont ajoutés plus tard. Pas de scope ajouté ici.

**Nomenclature** : labels existants déjà conformes au brief ("Planning",
"Site B2C", etc.) — aucun changement de vocabulaire nécessaire.

## Hors scope

- Pas de refonte du mécanisme de chiffrement des tuiles protégées.
- Pas de nouveau contenu (compteurs, stats, horloge) — uniquement la
  refonte visuelle/layout de l'existant.
- Pas de changement des URLs de destination des tuiles.

## Implémentation

Fichier unique (`index.html`, HTML+CSS+JS inline, ~290 lignes) — édition
directe, pas de découpage en plan multi-phases nécessaire vu la taille et
l'absence de logique serveur/état à faire évoluer.
