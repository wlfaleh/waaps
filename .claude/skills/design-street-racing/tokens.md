# Tokens et composants — Street Racing

## Polices (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&family=Orbitron:wght@700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
```

## Variables CSS

```css
:root {
  /* Couleurs */
  --bg: #0A0B10;
  --surface: #14161F;
  --surface-2: #1E2130;
  --border: rgba(255, 255, 255, 0.08);
  --accent: #FF6A00;        /* néon orange : action principale */
  --accent-2: #00E5FF;      /* néon cyan : info, sélection, focus */
  --danger: #FF1F4B;        /* boost, zone rouge, erreur */
  --success: #B6FF00;       /* nitro, réussite */
  --text: #F2F4F8;
  --text-muted: #8A90A6;
  --on-accent: #0A0B10;

  /* Glows */
  --glow-accent: 0 0 12px rgba(255, 106, 0, .55), 0 0 32px rgba(255, 106, 0, .25);
  --glow-accent-2: 0 0 12px rgba(0, 229, 255, .55), 0 0 32px rgba(0, 229, 255, .25);
  --glow-danger: 0 0 12px rgba(255, 31, 75, .6), 0 0 32px rgba(255, 31, 75, .3);

  /* Typographie */
  --font-display: "Rajdhani", "Saira Condensed", system-ui, sans-serif;
  --font-hud: "Orbitron", "Rajdhani", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --fs-label: 12px;
  --fs-body: 16px;
  --fs-h2: 28px;
  --fs-h1: 48px;
  --fs-hud: 72px;

  /* Formes */
  --skew: -10deg;
  --radius: 2px;
  --bevel: 14px;            /* taille du coin coupé */

  /* Espacements (grille 8px) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 48px;

  /* Mouvement */
  --ease-race: cubic-bezier(0.2, 0.9, 0.1, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-screen: 300ms;
}

body {
  background:
    radial-gradient(120% 60% at 50% 110%, rgba(255, 106, 0, .14), transparent 60%),
    radial-gradient(80% 50% at 85% 100%, rgba(0, 229, 255, .10), transparent 60%),
    var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  line-height: 1.5;
}
```

## Composants

### Titre

```css
.title {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--fs-h1);
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  line-height: 1;
}
.label {
  font-size: var(--fs-label);
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--text-muted);
}
```

### Bouton principal (parallélogramme)

```css
.btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 44px; padding: 0 var(--space-5);
  font-family: var(--font-display); font-weight: 700; font-size: 18px;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--on-accent); background: var(--accent);
  border: 0; border-radius: var(--radius);
  clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
  transition: transform var(--dur-fast) var(--ease-race),
              box-shadow var(--dur-fast) var(--ease-race),
              filter var(--dur-fast);
  cursor: pointer;
}
.btn:hover { transform: translateX(2px); filter: brightness(1.1); box-shadow: var(--glow-accent); }
.btn:active { transform: translateX(0) scale(.98); }
.btn:focus-visible { outline: 2px solid var(--accent-2); outline-offset: 3px; }
.btn:disabled { background: var(--surface-2); color: var(--text-muted); box-shadow: none; cursor: not-allowed; }

.btn--ghost {
  background: transparent; color: var(--text);
  box-shadow: inset 0 0 0 1px var(--border);
}
```

### Carte avec coin biseauté

```css
.card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  padding: var(--space-4);
  clip-path: polygon(0 0, calc(100% - var(--bevel)) 0, 100% var(--bevel), 100% 100%, 0 100%);
}
.card.is-selected { box-shadow: inset 3px 0 0 var(--accent-2); background: var(--surface-2); }
```

### Barre de stat segmentée

```html
<div class="stat">
  <span class="label">Accélération</span>
  <div class="stat__bar" style="--value: 72%"></div>
  <span class="stat__num">72</span>
</div>
```

```css
.stat { display: grid; grid-template-columns: 120px 1fr 40px; align-items: center; gap: var(--space-3); }
.stat__bar {
  height: 10px; background: var(--surface-2); transform: skewX(var(--skew)); overflow: hidden;
  position: relative;
}
.stat__bar::after {
  content: ""; position: absolute; inset: 0 auto 0 0; width: var(--value);
  background: linear-gradient(90deg, var(--accent-2), var(--accent));
  -webkit-mask: repeating-linear-gradient(90deg, #000 0 10px, transparent 10px 12px);
          mask: repeating-linear-gradient(90deg, #000 0 10px, transparent 10px 12px);
}
.stat__num { font-family: var(--font-hud); font-variant-numeric: tabular-nums; text-align: right; }
```

### Chiffre HUD (vitesse, score, chrono)

```html
<div class="hud">
  <span class="hud__value">248</span><span class="hud__unit">KM/H</span>
</div>
```

```css
.hud__value {
  font-family: var(--font-hud); font-weight: 800; font-size: var(--fs-hud);
  font-variant-numeric: tabular-nums; font-style: italic;
  text-shadow: 0 0 18px rgba(0, 229, 255, .45);
}
.hud__unit { margin-left: var(--space-2); font-size: var(--fs-label); letter-spacing: .15em; color: var(--text-muted); }
.hud--redline .hud__value { color: var(--danger); text-shadow: 0 0 18px rgba(255, 31, 75, .6); }
```

### Élément de menu

```css
.menu-item {
  display: block; padding: var(--space-3) var(--space-4);
  font-family: var(--font-display); font-weight: 700; font-size: 22px;
  text-transform: uppercase; color: var(--text-muted);
  transition: transform var(--dur-base) var(--ease-race), color var(--dur-base);
}
.menu-item:hover, .menu-item.is-active {
  color: var(--text); transform: translateX(12px);
  box-shadow: inset 4px 0 0 var(--accent);
}
```

### Lignes de vitesse en arrière-plan

```css
.speed-lines {
  position: fixed; inset: 0; pointer-events: none; opacity: .25;
  /* tirets horizontaux, visibles seulement sur de fines bandes (masque) */
  background: repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 60px, transparent 60px 200px);
  -webkit-mask: repeating-linear-gradient(0deg, transparent 0 22px, #000 22px 23px);
          mask: repeating-linear-gradient(0deg, transparent 0 22px, #000 22px 23px);
  animation: speed 0.6s linear infinite;
}
@keyframes speed { from { background-position-x: 0; } to { background-position-x: -200px; } }
```

### Mouvement réduit

```css
@media (prefers-reduced-motion: reduce) {
  .speed-lines { display: none; }
  *, *::before, *::after {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
```
