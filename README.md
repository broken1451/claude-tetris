# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Temas visuales (skins)](#temas-visuales-skins)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Historial del repositorio](#historial-del-repositorio)
  - [Integración con Claude Code](#integración-con-claude-code)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Combos y bonificaciones** (toda la lógica y los valores en `scoring.js`, `SCORING_CONFIG`):
  - **Combo**: limpiar líneas en piezas consecutivas sube el multiplicador x1 → x2 → x3… (tope x8) sobre el total de la jugada; bloquear una pieza sin líneas lo reinicia.
  - **T-Spin / Mini T-Spin** (regla de 3 esquinas, último movimiento = rotación): 400/800/1200/1600 (0–3 líneas) y 100/200/400 (mini), × nivel.
  - **Back-to-Back**: Tetris o T-Spin con líneas consecutivos puntúan ×1.5.
  - **Perfect Clear**: tablero vacío tras limpiar líneas, +800/1200/1800/2000 × nivel.
  - Panel con multiplicador y badge B2B, animaciones, etiquetas flotantes y efectos para T-Spin, B2B y Perfect Clear.
  - **Sonido** sintetizado (WebAudio, `audio.js`) con volumen y silencio (`M`), guardados en `localStorage`.
- **Piezas especiales** (10 % de las piezas, configurable en `SPECIAL_CONFIG`), con marco interior blanco para distinguirlas: pentominó **+**, **U** e **Y**, y pieza **hueca 3×3**. Al hacer un **Tetris** (4 líneas) la siguiente pieza es un **Single 1×1**.
- **Power-ups aleatorios** (cada 5 líneas hay un 60 % de probabilidad de ganar uno; hasta 3 en inventario, teclas `1`–`3` o clic en el slot):
  - 💣 **Bomba**: destruye un área 3×3 alrededor de la celda elegida.
  - ⚡ **Rayo**: elimina una fila o columna completa (`R` alterna).
  - 🎨 **Tinte**: convierte todos los bloques del color elegido en comodines (arcoíris).
  - ⏬ **Gravedad**: compacta los bloques de cada columna eliminando huecos.
  - ❄️ **Congelar**: detiene la caída de la pieza durante 5 s.
  - Los que piden objetivo entran en modo apuntado: ratón o flechas + `Enter`, `Esc`/clic derecho cancela. Configuración y catálogo en `powerups.js`.
- **Habilidades cargables** (solo modo Clásico): una barra de energía ⚡ (0–100) se recarga al limpiar líneas (+8/16/24/40 por 1/2/3/4 líneas). Con `Q` (o clic en la barra) se abre el menú —pausa el juego— y se elige una habilidad con `1`–`5` o clic; si no hay energía suficiente no se activa:
  - 🔮 **Visión anticipada** (30): muestra las siguientes 5 piezas durante 20 s.
  - 🔀 **Intercambio** (25): cambia la pieza actual por otra al azar.
  - 🐢 **Tiempo lento** (40): la caída es 2,5× más lenta durante 10 s.
  - ⏪ **Deshacer** (50): revierte la última colocación (tablero, puntos y la energía que dio).
  - Las temporales muestran una barra de duración en el panel. Catálogo y reglas en `abilities.js`.
- **Título «Claude Tetris»** centrado, con cada letra coloreada con la paleta de las piezas.
- **Temas visuales (skins)**: ver [Temas visuales](#temas-visuales-skins).

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P`       | Pausar / reanudar                 |
| `Q`       | Abrir / cerrar menú de habilidades |
| `C` / `Shift` | Hold: reservar/intercambiar pieza (una vez por pieza) |

---

## Temas visuales (skins)

El selector **SKIN** del panel lateral cambia la apariencia completa al instante, sin recargar:

| Skin          | Aspecto                                                                       |
| ------------- | ----------------------------------------------------------------------------- |
| **Retro**     | Bloques cuadrados de color plano (el aspecto original, por defecto).          |
| **Neon**      | Tablero y vistas en negro, con bloques brillantes y resplandor (`shadowBlur`). |
| **Pastel**    | Colores suaves y esquinas redondeadas.                                        |
| **Pixel art** | Textura de píxeles dibujada sobre cada bloque, escalada a su tamaño.          |

El skin se combina con el interruptor claro/oscuro (en Neon el tablero sigue siendo negro en ambos modos) y la preferencia se guarda en `localStorage('skin')`. El catálogo está en `skins.js`: para añadir uno basta una entrada en `SKINS` (paleta de los índices 1–14 y función `drawBlock`) y, si se quiere, reglas `[data-skin="id"]` en `style.css`.

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un título `<h1 class="title">` («Claude Tetris») con una `<span>` por letra para colorearlas individualmente.
- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza y la lista de controles.
- Un overlay para los estados **PAUSA** y **GAME OVER**.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía) o un índice de color (1–7) que identifica la pieza.
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`).
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-claude-tetris/
├── index.html                       # Estructura del DOM y canvas
├── style.css                        # Estilos del juego (dark theme + título)
├── game.js                          # Toda la lógica del Tetris (~300 líneas)
├── skins.js                         # Temas visuales: paletas y dibujo de bloques
├── README.md
├── CLAUDE.md                        # Guía del proyecto para Claude Code
├── .gitignore                       # Ignora .DS_STORE
├── .claude/
│   └── skills/clima-local/SKILL.md  # Skill local: clima de Santiago u otra ciudad
└── .github/workflows/
    ├── claude.yml                   # Claude Code al mencionar @claude
    └── claude-code-review.yml       # Revisión automática de PRs
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `SKINS`        | Paleta y dibujo de bloques (`skins.js`)  | 4 skins               |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Historial del repositorio

Todo lo realizado hasta ahora, en orden cronológico:

| Fecha      | Cambio                                                                                                                                                                                  |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-04-29 | **Primer commit**: juego completo (`index.html`, `style.css`, `game.js`), `README.md` y `.gitignore`.                                                                                   |
| 2026-11-25 | **PR #1**: se añaden los workflows de GitHub Actions *Claude PR Assistant* (`claude.yml`) y *Claude Code Review* (`claude-code-review.yml`).                                            |
| 2026-11-25 | **PR #3** (originado por el issue #2): Claude añade el título centrado y coloreado «Claude Tetris» (`index.html` +6 líneas, `style.css` +29 líneas; `body` pasa a `flex-direction: column`). |
| 2026-11-25 | Se añaden `CLAUDE.md` y la skill local `clima-local` en `.claude/` (aún sin commit).                                                                                                    |

---

## Integración con Claude Code

- **`CLAUDE.md`**: describe la arquitectura, cómo ejecutar el juego y los _gotchas_ (p. ej. mantener `COLS`/`ROWS`/`BLOCK` alineados con el canvas).
- **`.github/workflows/claude.yml`**: se activa con issues, comentarios y reviews que contengan `@claude`; permite que Claude trabaje sobre el repo desde GitHub (así se creó el título).
- **`.github/workflows/claude-code-review.yml`**: ejecuta `/code-review:code-review --comment` con `anthropics/claude-code-action@v1` sobre cada pull request.
- **`.claude/skills/clima-local`**: skill que consulta el clima actual y el pronóstico de Santiago de Chile (o la ciudad indicada).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.

## Modo Desafío

Pestaña **Desafío**: 5 desafíos con 3 niveles cada uno (Contrarreloj, Supervivencia, Tablero preconfigurado, Piezas invisibles, Rotación inversa). Muestra objetivo, progreso y cronómetro; al terminar aparece victoria/derrota con opciones de reiniciar, siguiente nivel o volver al menú. Las estadísticas son independientes del modo clásico. Para añadir desafíos, ver `challenges.js`.
