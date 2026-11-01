# Trouver et intégrer un vrai modèle de voiture

Méthode utilisée pour la Golf 8, le X5, le T-Cross, le M4 et l'Audi A3 (voir `waforspeed/models/README.md`).

## 1. Chercher (sans sonder de sites)

Les modèles Sketchfab téléchargés sont souvent dans des dépôts GitHub publics, avec un `license.txt` écrit par Sketchfab.
Recherche de code GitHub (`gh api -X GET search/code -f q='…'`) :

- par titre dans la licence : `"BMW X1" filename:license.txt`, `"Audi A3" filename:license.txt`
- par marque : `"Renault" sketchfab filename:license.txt`, `"Volkswagen" filename:license.txt`
- par dossier Sketchfab : `bmw_x1`, `renault_clio`, `audi_a3` (noms en minuscules avec `_`)
- par fichiers de crédits : `CREDITS.md`, `ATTRIBUTION.md`, `MODEL_SOURCES.md` contenant le nom de la voiture
- un glTF exporté par three.js (`asset.generator: THREE.GLTFExporter`) a perdu son crédit : comparer les noms de textures avec un modèle connu

Si le modèle exact n'existe pas : prendre le **plus proche** (même marque, même gabarit) et **le dire** (nom de la voiture dans le jeu = modèle réellement affiché).

## 2. Récupérer juste le dossier utile

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone -q --depth 1 --filter=blob:none --sparse https://github.com/<owner>/<repo> /home/user/ext/<owner>_<repo>
cd /home/user/ext/<owner>_<repo>
git ls-tree -r --name-only HEAD | grep -i <voiture>     # lister sans télécharger
git sparse-checkout set --no-cone <dossier/du/modele>    # télécharger seulement ce dossier
```
Ne jamais faire `git ls-tree -l` sur un clone `blob:none` (télécharge tout pour donner les tailles).

## 3. Vérifier

`python3 -I scripts/inspect.py modele.glb` donne : triangles, extensions requises, crédit (`asset.extras`), noms des roues.

| Critère | Accepté |
|---|---|
| Licence | CC BY, CC BY-SA, CC BY-NC(-SA) (jeu gratuit), CC0. Refuser « Standard/Editorial » sans droit clair, ou pas de licence. |
| Triangles | idéal ≤ 120 000 après conversion (au-delà : pas dans le trafic) |
| Poids final | ≤ 10 Mo par voiture |
| Contenu | carrosserie complète, roues présentes ; pas de carrosserie « widebody », de version course ou de modèle accidenté si une version de série existe |

Exports SketchUp : supprimer les lignes (primitives `mode ≠ 4`), sinon la simplification ne fait rien.

## 4. Convertir

```bash
node scripts/convert.mjs entree.glb waforspeed/models/<voiture>/<voiture>.json 110000 1024
```
Le script : décode meshopt/quantization, remplace la transmission (vitres) par une transparence simple, soude et simplifie
(meshoptimizer), passe les textures en WebP 1024 px, puis intègre tout en `data:` dans un seul `.json`.
Si la simplification ne descend pas assez : `SERR=0.003` (et `NOLOCK=1` en dernier recours, vérifier visuellement).

Ajouter `waforspeed/models/<voiture>/license.txt` (texte d'origine + ligne « Modifications for WaForSpeed… »).

## 5. Déclarer dans `CAR_MODELS` (`js/cars/catalog.js`)

```js
x1: { file: 'models/bmw-x5/bmw-x5.json', rotateY: 180, paint: '^CARPAINT$', credit: '« 2024 BMW X5 xDrive40i » par Ddiaz Design (Sketchfab), licence CC BY-NC-SA 4.0' },
```
- `paint` : expression du **nom du matériau** de carrosserie (lister les matériaux avec leur couleur et leur surface : le plus grand matériau à vernis/clearcoat est en général la peinture). Toujours ancrer (`^…$`) pour ne pas repeindre d'autres pièces.
- `rotateY` : 180 si la voiture se présente de face en course.
- `tail` / `wheel` : seulement si la détection automatique échoue.
- Ajuster `d.L` / `d.W` aux vraies dimensions (le modèle est mis à l'échelle sur `d.L`).

## 6. Ce que le jeu fait tout seul (`models.js`)
- échelle, centrage, pose au sol ; roues : nœuds `wheel/tire/tyre/rim/roue/pneu`, sinon **découpe par coin** des maillages qui regroupent les 4 roues, sinon détection par la forme (rond, posé au sol, taille d'une roue) ;
- feux et phares repérés par matériau, uniquement si toutes les pièces du matériau sont des feux (sinon un plastique partagé s'allume partout) ;
- chargement en file : voiture du joueur d'abord (`requestModel`).

## Pièges rencontrés
- **Boîte englobante fausse** : `Box3.setFromObject` de three r128 transforme la boîte locale de chaque pièce ; pour une pièce tournée (Porsche, Abarth) elle est 2 à 3 fois trop grande → voiture qui flotte et trop petite. Toujours utiliser `preciseBox()` (sommet par sommet) de `models.js`.
- **Pièces à squelette** (`SkinnedMesh`, ex. soufflet de levier de vitesse) : mal placées hors animation, supprimées au chargement et par `convert.mjs`.
- **Plans d'ombre** plats sous la voiture : supprimés (sinon ils fixent la longueur et le sol).
- **Roues fusionnées avec d'autres pièces** (Jeep) : découpe par coin puis on ne garde que les triangles autour du centre de la roue.
- **Peinture** : chaque modèle a ses réglages (mat, brillant…) ; la peinture repeinte est uniformisée (vernis métallisé) pour un rendu cohérent.

## 7. Vérifier en jeu
Captures garage (avant, profil, arrière) + course vue de derrière ; `realBody(car).wheels.length === 4` ; aucune pièce blanche lumineuse ; aucune erreur console. Voir `tests.md`.

## Créer un modèle soi-même (Blender, si installé)
Blender en ligne de commande (`blender -b -P script.py`) : modéliser par `bpy`/`bmesh` (boîte → biseaux → subdivision), UV automatiques (`smart_project`), un matériau par zone (carrosserie nommée `carpaint`, `glass`, `tire`, `rim`, `tail_light`, `head_light`), une roue = un objet nommé `Wheel_FL`…, export `bpy.ops.export_scene.gltf(export_format='GLB')`, avant de la voiture vers +Y dans Blender (l’export glTF le place vers −Z, le sens du jeu ; sinon `rotateY: 180`). Puis étapes 3 à 7.
Règles de modélisation « hard surface » : quads, arêtes de soutien sur les bords vifs, pas de n-gones sur les surfaces courbes, normales vers l'extérieur, échelle 1 unité = 1 m.
