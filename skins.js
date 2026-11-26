'use strict';

// Catálogo de temas visuales (skins). Se carga antes de game.js; no toca el DOM ni el estado.
// Para añadir un skin basta una entrada en SKINS (+ su botón se genera solo):
//   { id, name, colors[15], boardBg, grid, ghostAlpha, drawBlock(context, px, py, size, index, color, ghost) }
//   - colors: indexado por el valor de celda (0 = null, 1–7 estándar, 8 comodín, 9–13 especiales,
//     14 basura); la longitud debe ser MAX_CELL + 1 (powerups.js).
//   - boardBg / grid: { dark, light } o null para usar las variables del tema claro/oscuro (style.css).
//   - drawBlock: px/py en píxeles. game.js ya fija globalAlpha y envuelve la llamada en save/restore,
//     así que el estado que se cambie (sombras, trazos...) no se filtra al resto del dibujo.
// El resto de la página se personaliza en style.css con [data-skin="id"].

const FIRST_SPECIAL = 9;     // a partir de aquí el bloque lleva marca de pieza especial
const DEFAULT_SKIN = 'retro';

// Relleno del bloque: color plano, o degradado arcoíris para el comodín.
function skinFill(context, px, py, size, index, color, wildStops) {
  if (index !== WILD) return color;
  const g = context.createLinearGradient(px, py, px + size, py + size);
  wildStops.forEach((stop, i) => g.addColorStop(i / (wildStops.length - 1), stop));
  return g;
}

function roundedRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

// ---- Retro: bloques cuadrados de color plano (aspecto original) ----
const RETRO_WILD = ['#e57373', '#ffd54f', '#81c784', '#4dd0e1', '#ba68c8'];

function drawRetroBlock(context, px, py, size, index, color) {
  context.fillStyle = skinFill(context, px, py, size, index, color, RETRO_WILD);
  context.fillRect(px + 1, py + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(px + 1, py + 1, size - 2, 4);
  if (index >= FIRST_SPECIAL) {
    // marca de pieza especial: marco interior blanco + brillo
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.lineWidth = 2;
    context.strokeRect(px + 5, py + 5, size - 10, size - 10);
  }
}

// ---- Neon: núcleo oscuro, borde brillante y resplandor con shadowBlur ----
const NEON_WILD = ['#ff0040', '#ffee00', '#00ff66', '#00e5ff', '#d500f9'];

function drawNeonBlock(context, px, py, size, index, color, ghost) {
  const paint = skinFill(context, px, py, size, index, color, NEON_WILD);
  const line = Math.max(1, size / 15);
  const inset = 1 + line / 2;
  context.lineWidth = line;
  context.strokeStyle = paint;
  if (ghost) {   // la sombra es solo contorno discontinuo, sin resplandor
    context.setLineDash([size / 6, size / 10]);
    context.strokeRect(px + inset + 1, py + inset + 1, size - 2 * inset - 2, size - 2 * inset - 2);
    return;
  }
  context.shadowColor = index === WILD ? '#ffffff' : color;
  context.shadowBlur = size * 0.45;
  context.fillStyle = paint;
  context.fillRect(px + 2, py + 2, size - 4, size - 4);
  context.shadowBlur = 0;
  // oscurece el centro (menos en el comodín, para que el arcoíris se lea)
  context.fillStyle = index === WILD ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.55)';
  context.fillRect(px + 3, py + 3, size - 6, size - 6);
  context.shadowBlur = size * 0.3;
  context.strokeRect(px + inset, py + inset, size - 2 * inset, size - 2 * inset);
  if (index >= FIRST_SPECIAL) {
    context.shadowColor = '#ffffff';
    context.strokeStyle = '#ffffff';
    const m = size * 0.28;
    context.strokeRect(px + m, py + m, size - 2 * m, size - 2 * m);
  }
}

// ---- Pastel: colores suaves y esquinas redondeadas ----
const PASTEL_WILD = ['#f6b3b3', '#ffeaa7', '#b8e6b8', '#a8e6ef', '#d7b9f0'];

function drawPastelBlock(context, px, py, size, index, color, ghost) {
  const paint = skinFill(context, px, py, size, index, color, PASTEL_WILD);
  const radius = size * 0.28;
  if (ghost) {   // contorno redondeado; el segundo trazo oscuro lo hace visible sobre fondo claro
    const line = Math.max(1, size / 12);
    context.lineWidth = line;
    roundedRectPath(context, px + 2, py + 2, size - 4, size - 4, radius);
    context.strokeStyle = paint;
    context.stroke();
    context.strokeStyle = 'rgba(80,60,110,0.45)';
    context.lineWidth = line / 2;
    context.stroke();
    return;
  }
  roundedRectPath(context, px + 1, py + 1, size - 2, size - 2, radius);
  context.fillStyle = paint;
  context.fill();
  context.strokeStyle = 'rgba(80,60,110,0.22)';
  context.lineWidth = 1;
  context.stroke();
  // brillo suave en la parte superior
  roundedRectPath(context, px + size * 0.18, py + size * 0.12, size * 0.64, size * 0.2, size * 0.1);
  context.fillStyle = 'rgba(255,255,255,0.45)';
  context.fill();
  if (index >= FIRST_SPECIAL) {
    // marco oscuro: el blanco no contrasta sobre colores suaves
    roundedRectPath(context, px + size * 0.24, py + size * 0.24, size * 0.52, size * 0.52, size * 0.14);
    context.strokeStyle = 'rgba(70,45,100,0.75)';
    context.lineWidth = Math.max(1, size / 14);
    context.stroke();
  }
}

// ---- Pixel art: textura 8×8 escalada al tamaño del bloque ----
// W = brillo, l = claro, d = oscuro, D = muy oscuro, . = color base
const PIXEL_TEXTURE = [
  'lllllllD',
  'lWWl...D',
  'lW.....D',
  'll..d..D',
  'l....d.D',
  'l..d...D',
  'l......D',
  'DDDDDDDD',
];
const PIXEL_SHADES = {
  W: 'rgba(255,255,255,0.65)',
  l: 'rgba(255,255,255,0.3)',
  d: 'rgba(0,0,0,0.18)',
  D: 'rgba(0,0,0,0.4)',
};
const PIXEL_WILD = ['#d04648', '#dad45e', '#6daa2c', '#6dc2ca', '#9b5fc0'];

function drawPixelBlock(context, px, py, size, index, color, ghost) {
  const n = PIXEL_TEXTURE.length;
  const inner = size - 2;
  const at = i => 1 + Math.round(i * inner / n);   // bordes enteros: píxeles nítidos a cualquier tamaño
  const dot = (c, r) => context.fillRect(px + at(c), py + at(r), at(c + 1) - at(c), at(r + 1) - at(r));
  // anillo de píxeles a `k` celdas del borde
  const ring = k => {
    for (let r = k; r < n - k; r++)
      for (let c = k; c < n - k; c++)
        if (r === k || r === n - 1 - k || c === k || c === n - 1 - k) dot(c, r);
  };
  const paint = skinFill(context, px, py, size, index, color, PIXEL_WILD);
  context.fillStyle = paint;
  if (ghost) { ring(0); return; }
  context.fillRect(px + 1, py + 1, inner, inner);
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const shade = PIXEL_SHADES[PIXEL_TEXTURE[r][c]];
      if (!shade) continue;
      context.fillStyle = shade;
      dot(c, r);
    }
  if (index >= FIRST_SPECIAL) {
    context.fillStyle = '#ffffff';
    ring(2);
  }
}

// Índices:  1 I, 2 O, 3 T, 4 S, 5 Z, 6 J, 7 L, 8 comodín, 9 +, 10 U, 11 Y, 12 1×1, 13 hueca, 14 basura
const SKINS = {
  retro: {
    id: 'retro', name: 'Retro',
    colors: [null,
      '#4dd0e1', '#ffd54f', '#ba68c8', '#81c784', '#e57373', '#90caf9', '#ffb74d', '#ffffff',
      '#ff4081', '#c6ff00', '#7c4dff', '#00e676', '#18ffff', '#78909c'],
    boardBg: null, grid: null, ghostAlpha: 0.2,
    drawBlock: drawRetroBlock,
  },
  neon: {
    id: 'neon', name: 'Neon',
    colors: [null,
      '#00e5ff', '#ffee00', '#d500f9', '#00ff66', '#ff1744', '#2979ff', '#ff9100', '#ffffff',
      '#ff2d95', '#c6ff00', '#7c4dff', '#1de9b6', '#84ffff', '#8a9bb0'],
    // negro también en modo claro
    boardBg: { dark: '#000000', light: '#000000' },
    grid: { dark: '#12121f', light: '#12121f' },
    ghostAlpha: 0.7,
    drawBlock: drawNeonBlock,
  },
  pastel: {
    id: 'pastel', name: 'Pastel',
    colors: [null,
      '#a8e6ef', '#ffe99a', '#d7b9f0', '#b8e6a8', '#f6aaaa', '#aebff5', '#ffcc99', '#ffffff',
      '#f9a8d4', '#e4f28c', '#ac9af0', '#86e0bd', '#8cf0e4', '#b4b8c6'],
    boardBg: { dark: '#2b2638', light: '#fffafc' },
    grid: { dark: '#393348', light: '#f1e6ee' },
    ghostAlpha: 0.8,
    drawBlock: drawPastelBlock,
  },
  pixel: {
    id: 'pixel', name: 'Pixel art',
    colors: [null,
      '#41a6c9', '#e8c53a', '#9b5fc0', '#5aa832', '#d04648', '#4a6fd4', '#d27d2c', '#ffffff',
      '#e0508c', '#a4cc24', '#6a45c8', '#1fa874', '#2fc4c0', '#757161'],
    boardBg: { dark: '#140c1c', light: '#deeed6' },
    grid: { dark: '#221a2e', light: '#c8dcc0' },
    ghostAlpha: 0.65,
    drawBlock: drawPixelBlock,
  },
};

// Id de skin válido; cualquier valor desconocido (o null) cae en el skin por defecto.
function resolveSkinId(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(SKINS, id) ? id : DEFAULT_SKIN;
}

if (typeof module !== 'undefined') module.exports = { SKINS, DEFAULT_SKIN, FIRST_SPECIAL, resolveSkinId };
