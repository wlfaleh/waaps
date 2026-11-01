# Shaders dans WaForSpeed (three.js r128, WebGL)

## Quand écrire un shader
Effets impossibles avec les matériaux standards : route mouillée, lignes de vitesse, ciel, flou de roue, brillance néon. Sinon, un matériau standard + texture suffit.

## Méthode : `onBeforeCompile` (pas de TSL ni WebGPU en r128)
```js
mat.onBeforeCompile = (sh) => {
  sh.uniforms.uTime = U.time;                       // uniform partagé, mis à jour une fois par image
  sh.fragmentShader = 'uniform float uTime;\n' + sh.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    '#include <emissivemap_fragment>\n totalEmissiveRadiance += vec3(0.0, 0.9, 1.0) * step(0.98, fract(vUv.y * 40.0 - uTime));');
};
mat.customProgramCacheKey = () => 'neonStripe';      // évite de recompiler pour chaque copie
```
- Injecter dans les « chunks » de three (`#include <…>`) plutôt que réécrire tout le shader : on garde lumière, brouillard, ombres.
- `customProgramCacheKey` obligatoire si plusieurs matériaux ont des modifications différentes.

## Performances (surtout mobile)
- `precision mediump float` suffit pour la couleur ; `highp` seulement pour les positions/UV de la route (grandes valeurs).
- Pas de `if` dans le fragment : `mix`, `step`, `smoothstep`.
- Calculer sur le CPU ou dans le vertex ce qui ne change pas par pixel ; ≤ 3 `varying` sur mobile.
- `alphaTest` plutôt que `discard` manuel ; regrouper les données dans les 4 canaux d'une texture.
- Un seul `uTime` global, mis à jour dans la boucle principale.

## Post-traitement
- Une seule chaîne : `RenderPass` → `UnrealBloomPass` (seuil haut le jour, bas la nuit). Pas d'autre passe sans interrupteur de qualité.
- Ce qui doit briller (feux, néons, phares) : couleur émissive > 1 après exposition ; le reste doit rester sous le seuil du bloom.
- Le composer rend dans une cible MSAA ; ne jamais échantillonner la cible en cours d'écriture (même règle que les reflets en ping-pong).
