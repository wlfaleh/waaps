# WaForSpeed

Course de rue arcade en 3D, de nuit, dans le navigateur : solo contre la montre ou duel en ligne à deux.
Interface selon le skill `.claude/skills/design-street-racing`.

## Jouer en ligne

- **Sur claude.ai** (page publiée) : le duel passe par les salons de claude.ai ; les amis doivent être connectés à claude.ai et avoir accès au lien.
- **Sur GitHub Pages** : https://wlfaleh.github.io/waaps/ — ouvert à tous, sans compte. Le duel se fait en connexion directe entre navigateurs (WebRTC, service de mise en relation gratuit PeerJS) : l'un crée un salon et envoie le code à 4 lettres, l'autre le tape et clique sur Rejoindre. Le créateur du salon sert de relais : s'il quitte, le salon se ferme.
- La publication sur GitHub Pages est automatique à chaque mise à jour de `main` (`.github/workflows/pages.yml`). Il faut l'activer une fois : Settings → Pages → Source : « GitHub Actions ».

## Lancer en local

Les scripts sont des fichiers séparés : il faut un petit serveur (ouvrir `index.html` directement ne suffit pas).

```bash
cd waforspeed
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Le duel en ligne ne marche que sur la page publiée sur claude.ai (il utilise la capacité « room » des artifacts).

## Organisation du code

Les scripts sont chargés dans l'ordre de `index.html` et partagent leurs déclarations (pas de modules, pas de build).

| Dossier | Rôle |
|---|---|
| `css/style.css` | Tout le style (tokens du skill design, HUD, écrans, garage, radio) |
| `js/core/` | `config.js` constantes de jeu et d'échelle, `utils.js` petites fonctions |
| `js/cars/` | `catalog.js` voitures, stats, couleurs et **emplacement des vrais modèles**, `models.js` chargement des modèles GLB et construction de toutes les voitures, `procedural.js` voitures provisoires, `player.js` voiture du joueur |
| `js/world/` | `maps.js` les 4 terrains et les ambiances jour / nuit, `decor.js` bas-côtés et décors de chaque terrain, `track.js` tracé de la piste, `renderer.js` moteur 3D et ville, `scene.js` trafic, rivaux, caméra, rendu de la course, `garage.js` scène du garage, `fx.js` pluie et effets, `particles.js` étincelles et fumée des accidents |
| `js/game/` | `state.js` état de la partie, `traffic.js` trafic simulé (distances de sécurité, changements de file, voitures accidentées), `update.js` physique, chocs et accidents, checkpoints |
| `js/audio/` | `sfx.js` moteur et effets, `music.js` radio synthwave (Tone.js) et musiques du joueur |
| `js/ui/` | `hud.js` affichage en course, `screens.js` menus, garage, radio, commandes, `toasts.js` notifications |
| `js/net/duel.js` | Salons, synchronisation et résultats du duel |
| `js/net/p2p.js` | Duel hors de claude.ai : même interface que les salons claude.ai, en connexion directe (PeerJS) |
| `js/main.js` | Démarrage et boucle principale |
| `models/` | Vrais modèles 3D des voitures (voir `models/README.md`) |

## Ajouter un terrain

1. Ajoute une entrée dans `MAPS` (`js/world/maps.js`) : graine du tracé, virages, collines, trafic, couleurs de la vignette.
2. Ajoute son profil de bas-côtés dans `GROUND` et ses objets dans `generateDecor()` (`js/world/decor.js`).
3. Ajuste son ambiance jour / nuit dans `envFor()`.

## Ajouter une voiture

1. Ajoute une entrée dans `CARS` (`js/cars/catalog.js`) : dimensions réelles, stats sur 10, couleur par défaut, style de la version provisoire.
2. Ajoute son entrée dans `CAR_MODELS` avec le chemin de son fichier `.glb`.
