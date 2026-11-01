# Modèles 3D des voitures

Les voitures que tu vois dans le jeu aujourd'hui sont **provisoires** : elles sont générées par le code (`js/cars/procedural.js`).
Dès qu'un vrai modèle est déposé ici et déclaré dans le catalogue, le jeu l'utilise à la place, sans autre changement.

## Fichiers attendus

| Voiture | Fichier à déposer |
|---|---|
| Golf 8 | `models/golf8.glb` |
| BMW X1 | `models/bmw-x1.glb` |
| Clio | `models/clio.glb` |
| T-Roc | `models/t-roc.glb` |
| BMW Cabriolet | `models/bmw-cabriolet.glb` |
| Audi A3 | `models/audi-a3.glb` |

Puis, dans `js/cars/catalog.js`, remplace `file: null` par le chemin du fichier (il est déjà écrit en commentaire à côté), et remplis `credit`.

## Format

- **GLB** (un seul fichier) de préférence, ou **glTF** avec textures intégrées.
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
