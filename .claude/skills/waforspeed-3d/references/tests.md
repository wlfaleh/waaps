# Tester le rendu 3D sans écran

Chromium et Playwright sont déjà installés (`require('playwright')`, ne pas réinstaller).

## Servir une copie de test
Copier `waforspeed/` dans le dossier de travail temporaire, remplacer les scripts CDN par des copies locales (`lib/` : three r128, shaders, postprocessing, GLTFLoader) si le réseau est limité, puis `python3 -m http.server 8768`.

## Lancer le navigateur avec WebGL logiciel
```js
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
p.on('pageerror', (e) => errs.push(e.message));        // toute erreur JS fait échouer le test
```

## Recettes utiles (dans `page.evaluate`)
- Charger un modèle : `requestModel(id)` puis attendre `modelStatus.get(id) === 'ok'`.
- Vérifier les roues : `realBody(carById(id), '#f00', {}).wheels.length === 4`.
- Garage : clic `.car-card[data-id=…]`, puis `gYaw = 2.4 / 1.57 / -0.6` pour avant / profil / arrière.
- Course directe : `myCar = carById(id); PERF = carPerf(myCar); buildPlayer(); pickMap('ville','jour'); resetRace('play', 5); state = 'play'; show(null); speed = MAX_SPEED * 0.3;`
- Accident : `playerAccident(0.7, 1)` puis `update(1/60)` × 600, et vérifier l'écart caméra/route.
- Coût : `renderer.info.render.calls` et `.triangles` après quelques images, à comparer avant/après.
- Duel : remplacer la capacité `room` par le faux salon (`mock.js`) et PeerJS par `mockpeer.js`.

## Lire les captures
Assembler les captures en planche (sharp) et les regarder : sens de la voiture, roues, couleur, pièces anormalement claires (matériau mal repéré comme phare), transparence, ombres.
SwiftShader est lent : mesurer les performances relatives (appels, triangles), pas les images/s.
