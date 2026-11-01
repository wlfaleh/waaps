# Modèles 3D des voitures

Les voitures que tu vois dans le jeu aujourd'hui sont **provisoires** : elles sont générées par le code (`js/cars/procedural.js`).
Dès qu'un vrai modèle est déposé ici et déclaré dans le catalogue, le jeu l'utilise à la place, sans autre changement.

## Modèles en place

Tous trouvés dans des dépôts GitHub publics, avec leur licence d'origine (Sketchfab). Chaque dossier contient le modèle (`.json` = glTF avec données et textures intégrées) et son `license.txt`.

| Voiture du jeu | Modèle réel | Auteur | Licence |
|---|---|---|---|
| Golf 8 GTI | `golf-8/` — Volkswagen Golf 8 GTI (A8) | GT Cars: Hyperspeed | CC BY 4.0 |
| BMW X5 | `bmw-x5/` — 2024 BMW X5 xDrive40i | Ddiaz Design | CC BY-NC-SA 4.0 |
| VW T-Cross | `vw-t-cross/` — 2021 Volkswagen T-Cross 280 TSI | Ddiaz Design | CC BY-NC-SA 4.0 |
| BMW M4 | `bmw-m4/` — 2021 BMW M4 Competition | Ricy | CC BY 4.0 |
| Audi A3 berline | `audi-a3/` — 2014 Audi S3 Limousine (A3 8V) | tonielpro520 | CC BY 4.0 |
| Clio | aucun modèle libre trouvé : voiture générée par le code | — | — |

Pas de BMW X1, de T-Roc, de BMW cabriolet ni de Clio sous licence libre trouvés : les modèles les plus proches ont été pris (X5, T-Cross, M4 coupé).
Les modèles ont été allégés (≈ 100 000 à 140 000 triangles, textures WebP 1024 px) avec glTF-Transform.
Les licences CC BY-NC-SA interdisent l'usage commercial : le jeu doit rester gratuit.

## Ajouter ou remplacer un modèle

Dépose le fichier (`.glb`, `.gltf` avec textures intégrées, ou `.json` comme ci-dessus) dans `models/`,
puis, dans `js/cars/catalog.js`, mets son chemin dans `file` et remplis `credit`.

## Format

- **GLB** (un seul fichier) de préférence, ou **glTF** avec textures intégrées.
- **Collada (.dae)** marche aussi : dépose le `.dae` et ses textures (images) dans `models/`, avec les mêmes noms de fichiers que ceux écrits dans le `.dae`. Le GLB reste conseillé : plus léger et plus rapide à charger.
- **Pas de compression Draco** (non prise en charge pour l'instant).
- **Poids** : idéalement moins de 5 Mo et moins de 100 000 triangles par voiture. Au-delà, le jeu reste jouable mais le trafic garde les voitures provisoires pour ne pas ramer.
- **Taille et orientation** : pas besoin de les corriger. Le jeu met automatiquement la voiture à sa longueur réelle, la pose au sol et la couche dans le sens de la route. Si elle roule à l'envers, ajoute `rotateY: 180` dans le catalogue.

## Couleurs et feux

- Le jeu repeint la carrosserie avec la couleur choisie au garage s'il trouve un matériau dont le nom contient `paint`, `body`, `carpaint`… Si le nom est différent, indique-le avec `paint: 'NomDuMateriau'`. Pour garder la couleur d'origine du modèle : `repaint: false`.
- Les roues braquent et tournent si chaque roue est un objet séparé dont le nom contient `wheel`, `roue` ou `tire` (ex. `Wheel_FL`). Si les noms sont différents, indique le motif avec `wheel: '...'` dans le catalogue.
- Les feux arrière s'allument au freinage si leur matériau contient `tail`, `brake` ou `rear_light`, ou le nom donné avec `tail: '...'`.

## Licence

Vérifie que la licence du modèle autorise son usage dans un jeu. Pour une licence **CC-BY**, il faut citer l'auteur : écris-le dans `credit` (par exemple `'Golf 8 par NomAuteur, CC-BY 4.0'`), il s'affiche dans le garage.
Les noms et logos des marques sont des marques déposées : pour un jeu privé entre amis ce n'est pas un problème, pour un jeu public mieux vaut les retirer.
