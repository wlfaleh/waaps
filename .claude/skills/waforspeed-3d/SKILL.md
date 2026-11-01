---
name: waforspeed-3d
description: Règles 3D du jeu WaForSpeed (three.js r128, voitures, décors, caméra, effets, performances). À utiliser dès qu'on touche au rendu 3D, aux voitures (modèles procéduraux ou vrais modèles glTF), aux cartes et décors, à la caméra, à la lumière, aux ombres, aux shaders, au post-traitement, à la physique de conduite, au trafic, ou quand on cherche, convertit ou intègre un modèle 3D.
---

# WaForSpeed 3D — règles du moteur

> « La 3D est une illusion : donner l'impression du détail, pas le détail lui-même. »

Ce skill complète `design-street-racing` (interface, couleurs, typo) pour tout ce qui est rendu 3D.
Inspiré de : *3d-games* (davila7), *three-best-practices* (emalorenzo, mrdoob/Utsubo), *game-developer* (Jeffallan),
équipe *3d-design* et *game-dev* (DavinciDreams), *blender-3d-modeling* (Andrew1326), et notre propre expérience sur ce jeu.

## Le socle technique (ne pas changer sans raison)

| Élément | Choix | Pourquoi |
|---|---|---|
| Moteur | three.js **r128** en scripts UMD (`THREE` global), sans build | marche tel quel sur claude.ai, githack et GitHub Pages |
| Scripts | classiques, ordre fixé dans `index.html` (core → cars → world → game → audio → ui → net → main) | les déclarations de haut niveau sont partagées |
| Post-traitement | `EffectComposer` + `UnrealBloomPass`, cible MSAA (`WebGLMultisampleRenderTarget`) | glow néon du style + anti-crénelage |
| Reflets | `CubeCamera` avec deux cibles en ping-pong (`cubeRTs`) | jamais lire et écrire la même texture (boucle de rétroaction) |
| Simulation | pas fixe `T_STEP = 1/60`, aléatoire graine `mulberry32` | trafic identique chez les deux joueurs du duel |
| Modèles | glTF intégré dans un `.json` (données et textures en `data:`) | claude.ai ne sert pas `.gltf/.bin/.glb` |

Avant d'ajouter une bibliothèque : version exacte **r128** sur cdnjs/jsdelivr (`examples/js/...`), jamais `examples/jsm`.

## Règles par priorité

### 1. Boucle de rendu (CRITIQUE)
- Une seule boucle `requestAnimationFrame` ; tout mouvement multiplié par `dt` (borné, ex. `Math.min(dt, 0.05)`).
- **Aucune allocation dans la boucle** : réutiliser des `Vector3`/`Matrix4` temporaires (`tmpA`, `tmpB`…), pas de `new`, pas de `.clone()`, pas de tableaux créés à chaque image.
- Ne jamais modifier les réglages du renderer (taille d'ombre, pixel ratio) à chaque image : seulement au changement de qualité.

### 2. Appels de dessin (CRITIQUE) — viser < 150 par image en course
- Décors statiques **fusionnés par matériau** (`addGeo` → une géométrie par tronçon et par matériau).
- Objets identiques et nombreux → `InstancedMesh` ou fusion.
- **LOD par distance** (déjà en place, à respecter pour tout nouvel objet) :
  - trafic : voiture complète < `LOD_CAR_M` (70 m), sinon `makeCarLow` (1 seul maillage, couleurs par sommet) ;
  - décors : petits objets (`SMALL_DECOR`) non dessinés au-delà de `LOD_FAR_M` (200 m) ;
  - vrais modèles dans le trafic seulement si qualité haute, ordinateur et < 120 000 triangles.
- Cacher (`visible = false`) plutôt que retirer/ajouter à la scène ; réutiliser les maillages (pool) au lieu de les recréer.

### 3. Mémoire (CRITIQUE)
- Tout ce qu'on crée à la volée se libère : `geometry.dispose()`, `material.dispose()`, `texture.dispose()`, `renderTarget.dispose()` (changement de carte, tronçon qui sort, voiture remplacée).
- Ne jamais libérer une ressource partagée (`TEXS.*`, `MAT.*`, `boardGeo`…).
- Partager géométries et matériaux entre voitures identiques (caches `lowGeoCache`, `repaintCache`).

### 4. Lumière, ombres, ambiance (ÉLEVÉ)
- 1 soleil/lune directionnel + 1 hémisphère + carte d'environnement (PMREM). Pas plus de 3 lumières actives ; les lampadaires sont des matériaux émissifs + bloom, pas des `PointLight`.
- Ombres temps réel **sur ordinateur seulement**, caméra d'ombre serrée qui suit la voiture ; sur mobile, ombre simulée (plan dégradé sous la voiture).
- Jour/nuit via `envFor(map, tod)` : brouillard, ciel, intensités. Nuit = émissifs forts + bloom ; jour = bloom faible (seuil haut).

### 5. Matériaux et textures (ÉLEVÉ)
- Le plus simple qui suffit : `MeshBasicMaterial` pour le lointain/décor plat, `MeshStandardMaterial` pour les voitures et le sol proche. Pas de `MeshPhysicalMaterial` hors voiture du joueur.
- Textures ≤ 1024 px (2048 pour la route), puissances de 2, mipmaps, anisotropie sur la route seulement.
- Peu de transparence : vitres et verres seulement ; `alphaTest` plutôt que `transparent` pour les feuillages.

### 6. Caméra (MOYEN)
- Suivi lissé (lerp dépendant de `dt`), angle **toujours ramené dans [-π, π]** (`atan2(sin, cos)`) — sinon la caméra part de travers après un tête-à-queue.
- FOV qui s'ouvre avec la vitesse et la nitro, petite secousse aux chocs (désactivée si `prefers-reduced-motion`).
- 3 vues (`CAM_MODES` : proche, loin, capot) ; `near`/`far` serrés (0.1 / brouillard + marge).

### 7. Physique et collisions (MOYEN)
- Conduite (`update.js`, constantes `PHYS`) : volant progressif, cap de la voiture (`heading`) qui la fait avancer en biais, angle des roues réduit avec la vitesse, limite d'adhérence, réalignement doux sans volant, angle max serré à haute vitesse. Performances tirées de la vraie fiche (`spec` : ch, 0-100, vmax, kg).
- Symétrie : même calcul à gauche et à droite (vérifié : écart nul), rebonds sur les bordures identiques des deux côtés.
- Formes simples : rectangle orienté (longueur/largeur réelles tournées du cap) sur la route, jamais de collision au maillage. Masse réelle : la plus lourde gagne le choc.
- Arcade et lisible avant tout : pas d'accélération sans la pédale Gaz, marche arrière bornée (`REV_MAX`), accidents = tête-à-queue + perte de vitesse puis remise dans l'axe.
- Le trafic ne s'interpénètre jamais : contrôle de voie libre (`laneFree`) + clignotant avant changement de voie.

### 8. Mobile (ÉLEVÉ)
- `pixelRatio ≤ 1.5` sur mobile (`onResize`), pas d'ombres temps réel, vrais modèles réservés au joueur et à l'adversaire (le trafic garde les voitures procédurales).
- `watchPerf` mesure les 5 premières secondes de course et passe en qualité « rapide » sous 30 images/s ; tout nouvel effet doit dépendre de `quality`.
- Ne charger que les modèles affichés (`requestModel`).

### 9. Robustesse (ÉLEVÉ)
- Toujours une solution de repli : modèle absent ou en erreur → voiture procédurale ; WebGL absent → message clair.
- Perte de contexte WebGL gérée dans `setupThree` (`webglcontextlost` : `preventDefault()` + pause ; `webglcontextrestored` : rechargement en solo).
- Aucune erreur console en jeu (vérifiée par les tests).

## Voitures

Deux sources, même interface (`makeCarMesh(car, paint, opts)` → groupe avec `animWheels`, `setBrake`, `setIndicators`) :
1. **Procédurale** (`procedural.js`, `loftBody`) : silhouette par sections, toujours disponible, sert de repli et de chargement.
2. **Vrai modèle** (`models.js`, `CAR_MODELS` dans `catalog.js`) : mise à l'échelle sur `car.d.L`, posé au sol, avant vers −Z, roues détectées (ou découpées par coin si fusionnées), carrosserie repeinte, feux repérés **par matériau** (un matériau partagé n'est marqué phare/feu que si toutes ses pièces le sont).

Pour trouver, vérifier, convertir et intégrer un nouveau modèle : **`references/modeles-voitures.md`** (méthode complète + scripts dans `scripts/`).

## Shaders

GLSL via `onBeforeCompile` (r128, pas de TSL/WebGPU). Règles et exemples : `references/shaders.md`.

## Tester avant de livrer

Chromium + Playwright (SwiftShader) — détails dans `references/tests.md` :
- [ ] le jeu démarre sans erreur console, en garage, en course et en duel (mock)
- [ ] captures garage (avant/profil/arrière) et course (vue de derrière) pour chaque voiture touchée
- [ ] voiture dans le bon sens, 4 roues qui tournent et braquent, couleur appliquée
- [ ] nombre d'appels de dessin et de triangles relevé (`renderer.info.render`) — pas de régression
- [ ] test mobile (viewport 390×844, `isTouch`) : qualité réduite, pas d'ombres
- [ ] après un accident, la caméra revient derrière la voiture

## À éviter
- Collisions au maillage, lumières ponctuelles en nombre, ombres sur mobile, un seul niveau de détail pour toutes les distances.
- Allouer dans la boucle, oublier `dispose()`, lire et écrire la même cible de rendu.
- Modèles > 150 000 triangles ou > 10 Mo par voiture ; Draco/KTX2 (non branchés en r128 ici).
- Modèles sans licence claire, ou logos/marques reproduits hors des modèles crédités.
