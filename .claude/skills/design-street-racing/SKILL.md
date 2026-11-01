---
name: design-street-racing
description: Direction artistique "street racing" pour l'UI du projet waaps — style jeu de course arcade nocturne (néons, vitesse, asphalte mouillé, HUD agressif). À utiliser dès qu'on crée ou modifie une page, un écran, un menu, un HUD, un composant, des couleurs, une typographie, des animations ou une mise en page.
---

# Design Street Racing — waaps

Ambiance : course urbaine de nuit, ville sous la pluie, néons qui se reflètent sur l'asphalte, sensation de vitesse permanente. L'interface doit donner l'impression d'un tableau de bord de voiture tunée et d'un menu de jeu de course arcade.

> Style original inspiré du genre « jeu de course de rue ». Ne jamais reprendre de logo, nom, police propriétaire, visuel ou élément de marque d'un jeu existant.

## Principes

1. **Vitesse** : formes inclinées (skew -8° à -12°), coupes en biseau, lignes de vitesse, flous de mouvement. Rien de mou ni de trop arrondi.
2. **Nuit + néon** : fonds très sombres, accents lumineux saturés avec halo (glow). Le néon sert à guider l'œil : un seul accent dominant par écran.
3. **Contraste fort** : texte clair sur fond sombre, chiffres énormes (vitesse, score, temps), libellés petits en capitales espacées.
4. **HUD lisible** : l'information clé se lit en moins d'une seconde. Hiérarchie : chiffre → unité → libellé.
5. **Énergie contrôlée** : animations rapides (120–250 ms), entrées latérales, jamais d'animation lente ou flottante.

## Palette (voir `tokens.md` pour les valeurs complètes)

| Rôle | Token | Valeur |
|---|---|---|
| Fond principal (asphalte nuit) | `--bg` | `#0A0B10` |
| Surface (carrosserie) | `--surface` | `#14161F` |
| Surface élevée | `--surface-2` | `#1E2130` |
| Accent principal (néon orange) | `--accent` | `#FF6A00` |
| Accent secondaire (néon cyan) | `--accent-2` | `#00E5FF` |
| Boost / danger (rouge feu arrière) | `--danger` | `#FF1F4B` |
| Succès / nitro (vert acide) | `--success` | `#B6FF00` |
| Texte principal | `--text` | `#F2F4F8` |
| Texte secondaire | `--text-muted` | `#8A90A6` |

Règles :
- Orange = action principale (bouton « Course », « Valider »). Cyan = information, sélection, focus.
- Rouge réservé au danger, au boost, à la zone rouge du compte-tours.
- Ne jamais mettre orange et cyan à égalité sur le même composant.

## Typographie

- **Titres / chiffres** : police condensée et grasse, en italique ou inclinée — `"Rajdhani"`, `"Orbitron"` (chiffres HUD) ou `"Saira Condensed"` (Google Fonts), poids 700–800, MAJUSCULES.
- **Texte courant** : `"Inter"` 400/500, 15–16 px, interligne 1.5.
- **Libellés** : 11–12 px, MAJUSCULES, `letter-spacing: 0.15em`, couleur `--text-muted`.
- **Chiffres** : `font-variant-numeric: tabular-nums` pour que la vitesse/le chrono ne « sautent » pas.

## Formes et composants

- **Boutons** : parallélogrammes (`clip-path` ou `transform: skewX(-10deg)` avec contenu contre-incliné), fond `--accent`, texte noir gras en capitales. Survol : glow + léger décalage de 2 px vers la droite. Focus : contour cyan 2 px.
- **Cartes** (voiture, niveau, profil) : coin supérieur droit coupé en biseau, bordure 1 px `rgba(255,255,255,0.08)`, liseré néon de 3 px sur le bord gauche pour l'élément sélectionné.
- **Barres de stats** (vitesse, accélération, maniabilité) : segments inclinés, remplissage dégradé `--accent-2 → --accent`, valeur numérique à droite.
- **Compteur / jauge** : arc de cercle 240°, graduations fines, zone rouge `--danger` sur les 15 % finaux, gros chiffre central.
- **Menus** : liste verticale à gauche, élément actif décalé vers la droite avec barre néon ; aperçu (voiture, carte) en grand à droite.
- **Notifications** : bandeau qui glisse depuis la droite, incliné, avec bordure gauche colorée selon le type.
- **Rayons** : 0–4 px maximum. Pas de pilules arrondies.

## Effets visuels

- Glow néon : `box-shadow: 0 0 12px rgba(255,106,0,.55), 0 0 32px rgba(255,106,0,.25)`.
- Fond : dégradé radial sombre + reflets flous colorés en bas d'écran (asphalte mouillé), éventuellement une fine texture de grain/bruit à 3–5 %.
- Lignes de vitesse : traits horizontaux fins semi-transparents en arrière-plan, animés vers la gauche.
- Verre teinté pour les panneaux superposés : `background: rgba(20,22,31,.72); backdrop-filter: blur(10px)`.

## Mouvement

- Durées : 120 ms (survol), 200 ms (transition d'état), 250–350 ms (changement d'écran).
- Courbe : `cubic-bezier(0.2, 0.9, 0.1, 1)` (départ explosif, arrivée nette).
- Entrées d'écran : glissement horizontal + léger flou de mouvement, éléments en cascade (décalage 40 ms).
- Chiffres qui changent (score, vitesse) : animation de comptage rapide.
- Respecter `prefers-reduced-motion` : supprimer les lignes de vitesse, flous et secousses ; garder seulement des fondus.

## Accessibilité

- Contraste texte ≥ 4.5:1 (le texte blanc sur `--bg` / `--surface` est OK ; le texte sur `--accent` doit être noir `#0A0B10`).
- Ne jamais transmettre une info uniquement par la couleur (ajouter icône ou libellé).
- Focus clavier toujours visible (contour cyan).
- Cibles tactiles ≥ 44 px ; sur mobile, marges latérales de 16 px.

## À éviter

- Fonds clairs, pastels, coins très arrondis, ombres douces « flat design ».
- Plus de deux couleurs néon visibles en même temps.
- Texte long en italique ou en police condensée.
- Logos, noms ou éléments visuels de jeux ou de marques automobiles existants.

## Checklist avant de livrer un écran

- [ ] Fond sombre, un accent dominant clair
- [ ] Au moins un élément incliné/biseauté qui donne le mouvement
- [ ] Chiffres clés en grand, libellés en petites capitales
- [ ] États survol / focus / actif / désactivé définis
- [ ] Animations ≤ 350 ms et `prefers-reduced-motion` géré
- [ ] Contrastes vérifiés, rendu correct à 375 px de large

Pour tout ce qui est rendu 3D (voitures, décors, lumière, caméra, performances, vrais modèles), suivre aussi le skill `waforspeed-3d`. Le style néon s'y traduit par : nuit = émissifs + bloom, un accent néon dominant par scène, reflets sur l'asphalte mouillé.

Les tokens CSS prêts à copier et des exemples de composants sont dans `tokens.md`.
