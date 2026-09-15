// @vitest-environment node
//
// Lee dos archivos del disco y compara texto. No es un DOM lo que necesita.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ARTBOARDS, rutaDe } from './artboards.ts';
import { UMBRAL_DE_TEXTO, conDosDecimales, contraste } from './contraste.ts';
import { temasDeUi } from './especificadores.ts';
import {
  type Correspondencia,
  constante,
  constantesDeColor,
  delHelmet,
  discrepancias,
  enElMarcado,
  masCercanos,
  normalizar,
} from './paleta-del-artboard.ts';
import { paletaDeLaIdentidad, reglasDe } from './tailwind.ts';

/**
 * **La identidad `clasico` de `@kamayuk/ui` es la paleta que dibuja `Ciudadano.dc.html`** (issue 2).
 *
 * <h2>La direccion, que no es simetrica</h2>
 *
 * Como en `rentas` (rentas#80): la libreria **publica** la paleta y quien tiene el artboard
 * vendorizado es este repositorio, asi que es este quien comprueba que cuadra. La libreria no
 * puede leer el artboard de un sistema sin depender de el (ADR-0030 §4). Y este portal **elige**
 * `clasico`, no la escribe: si la identidad se aparta del artboard, el arreglo es un issue en
 * `kamayuk-lib`, nunca un `--color-*` aqui (lo prohibe `sin-colores-propios`).
 *
 * <h2>Que bloque se lee</h2>
 *
 * `[data-tema='clasico']` de `temas.css`, fuera de toda capa y de todo `@media`: el que el navegador
 * pinta con `data-tema="clasico"` en modo claro. Se alcanza **desde la hoja publicada**, siguiendo
 * su `@import "./temas.css"` (`hermanaDe`), y no por una ruta al clon: una ruta leeria el archivo
 * aunque el paquete ya no lo sirviera. NO se lee `estilos/clasico.css`, que es el origen del que se
 * genera y que la libreria no publica ni importa: lo que se compara es lo que llega.
 *
 * <h2>La tabla: cada color del artboard, con su token o con su porque</h2>
 *
 * Tres decisiones posibles, y las tres se comprueban:
 *
 *   · `igual`: el token vale lo que el artboard dibuja.
 *   · `desviacion`: el token existe y a proposito vale otra cosa. Lleva escrito el valor del
 *     artboard contra el que se decidio y el de la libreria: si cualquiera de los dos se mueve, rojo.
 *   · `sin-token`: el artboard pinta un valor que `clasico` no tiene. Se dice que se usa en su lugar;
 *     y si la libreria algun dia publica un token con ese valor, rojo: la entrada sobra.
 *
 * Nada de lo que se aparta del artboard queda fuera de la tabla para que la guarda salga verde.
 */

const HOJA_DEL_ARTBOARD = (() => {
  const declarado = ARTBOARDS.find((a) => a.archivo.endsWith('Ciudadano.dc.html'));
  if (declarado === undefined) throw new Error('`Ciudadano.dc.html` no esta en `artboards.ts`.');
  return rutaDe(declarado);
})();

const ARTBOARD = readFileSync(HOJA_DEL_ARTBOARD, 'utf8');

/** `clasico/claro`, tal como llega al navegador. */
const CLASICO = paletaDeLaIdentidad(reglasDe(readFileSync(temasDeUi(), 'utf8')), 'clasico');

/** Las constantes de color que el issue 2 nombra, y que la tabla tiene que traer si o si. */
const LAS_QUE_PIDE_EL_ISSUE = [
  'AZUL',
  'AZUL_2',
  'ACERO',
  'AZUL_TXT',
  'VERDE_BG',
  'VERDE_FG',
  'ROJO_BG',
  'ROJO_FG',
  'AMBAR_BG',
  'AMBAR_FG',
];

/**
 * El granate de «Con mi cuenta», decidido en el issue 7: lo leen dos filas, la constante y el marcado.
 *
 * `clasico` no tiene acento granate. El issue pide el token mas cercano y sin literal, y se CALCULA
 * (ΔE*76, abajo): `--mal-tinta` (`#a94442`) queda a 20.1, y el siguiente, `--atencion-tinta`, a 57.4.
 * El reparo de la tabla del issue 2 —que `--mal-tinta` dice «error»— se mira asi: el filo esta SIEMPRE,
 * no aparece al fallar, y el error de la tarjeta no depende de el: lo dicen el mensaje con
 * `role="alert"` y el campo con `aria-invalid`. Y lo que el artboard quiere del filo —distinguir los dos
 * caminos, azul el del correo y rojo oscuro el de la cuenta— solo lo conserva un rojo.
 */
const GRANATE_DE_LA_CUENTA = {
  tipo: 'sin-token',
  elArtboardDice: '#A6093D',
  seSustituyePor: '--color-mal-tinta',
  esElMasCercano: true,
  porQue:
    'Ningun token de `clasico` es un acento granate (`kamayuk-lib`#56 no lo recoge). ' +
    '`src/pasos/identificar/Identificar.tsx` pinta el filo con `--mal-tinta`, el mas cercano (calculado ' +
    'abajo): es un filo que esta siempre, y el error de la tarjeta lo dicen su mensaje y `aria-invalid`.',
} as const;

const TABLA: readonly Correspondencia[] = [
  // ── Las constantes de la logica (lineas 706-716) ──────────────────────────────────────────
  {
    delArtboard: 'AZUL',
    donde: 'constante, linea 706: barra, boton primario, titulos',
    leer: constante('AZUL'),
    decision: { tipo: 'igual', token: '--color-azul' },
  },
  {
    delArtboard: 'AZUL_2',
    donde: 'constante, linea 707: hover del azul',
    leer: constante('AZUL_2'),
    decision: { tipo: 'igual', token: '--color-azul-oscuro' },
  },
  {
    delArtboard: 'AZUL_2',
    donde: 'constante, linea 707: hover del azul',
    leer: constante('AZUL_2'),
    decision: { tipo: 'igual', token: '--color-azul-hover' },
  },
  {
    delArtboard: 'ACERO',
    donde:
      'constante, linea 708: filo superior de «Solo con mi correo» (318), filo del aviso de la ' +
      'cuenta (558) y fondo de la accion principal del comprobante, con texto blanco (1285)',
    leer: constante('ACERO'),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#3D7EB7',
      seSustituyePor: '--color-azul',
      porQue:
        '`kamayuk-lib`#56 no lo recoge. Y como fondo de un boton con texto blanco no llega a AA ' +
        '(4.32:1, calculado abajo); `--azul` da 6.52:1 y es el azul de las demas acciones.',
      noLlegaA: { contra: '--color-sobre-azul', umbral: UMBRAL_DE_TEXTO },
    },
  },
  {
    delArtboard: 'AZUL_TXT',
    donde: 'constante, linea 709, y `a { color }` del helmet: enlaces y botones de texto',
    leer: constante('AZUL_TXT'),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#1569B0',
      seSustituyePor: '--color-azul',
      porQue:
        '`clasico` no tiene token de enlace (`kamayuk-lib`#56 no lo recoge). `#1569B0` cumple AA, ' +
        'pero no puede escribirse aqui; `--azul` es el mas cercano y lee mejor (6.52:1 frente a ' +
        '5.71:1 sobre blanco). Lo aplica `src/estilos.css` a `a`.',
    },
  },
  {
    delArtboard: 'GRANATE',
    donde: 'constante, linea 710: filo superior de la tarjeta «Con mi cuenta» (335)',
    leer: constante('GRANATE'),
    decision: GRANATE_DE_LA_CUENTA,
  },
  {
    delArtboard: 'VERDE_BG',
    donde: 'constante, linea 711: insignia «pagado»',
    leer: constante('VERDE_BG'),
    decision: { tipo: 'igual', token: '--color-ok-fondo' },
  },
  {
    delArtboard: 'VERDE_FG',
    donde: 'constante, linea 712: insignia «pagado»',
    leer: constante('VERDE_FG'),
    decision: { tipo: 'igual', token: '--color-ok-tinta' },
  },
  {
    delArtboard: 'ROJO_BG',
    donde: 'constante, linea 713: insignia «vencida», alerta',
    leer: constante('ROJO_BG'),
    decision: { tipo: 'igual', token: '--color-mal-fondo' },
  },
  {
    delArtboard: 'ROJO_FG',
    donde: 'constante, linea 714: tinta de «vencida» y de los errores',
    leer: constante('ROJO_FG'),
    decision: { tipo: 'igual', token: '--color-mal-tinta' },
  },
  {
    delArtboard: 'ROJO_FG en `IN_MAL`',
    donde: 'linea 719: el filo del campo con error',
    // La linea 719 no escribe el color: concatena la constante. Se lee QUE constante concatena y
    // luego su valor, para que un `IN_MAL` que pasara a otra constante tambien se note.
    leer: (artboard) => {
      const nombre = enElMarcado(/const IN_MAL = '[^']*border:1px solid ' \+ ([A-Z_]+) \+/)(artboard);
      return nombre === null ? null : constante(nombre)(artboard);
    },
    decision: { tipo: 'igual', token: '--color-mal-borde' },
  },
  {
    delArtboard: 'AMBAR_BG',
    donde: 'constante, linea 715: insignia «por vencer», amnistia',
    leer: constante('AMBAR_BG'),
    decision: { tipo: 'igual', token: '--color-atencion-fondo' },
  },
  {
    delArtboard: 'AMBAR_FG',
    donde: 'constante, linea 716: insignia «por vencer», amnistia',
    leer: constante('AMBAR_FG'),
    decision: { tipo: 'igual', token: '--color-atencion-tinta' },
  },

  // ── Los estilos globales del `<helmet>` (lineas 12-22) ────────────────────────────────────
  {
    delArtboard: '`html, body { background }`',
    donde: 'helmet, linea 13: el lienzo',
    leer: delHelmet('html, body', 'background'),
    decision: { tipo: 'igual', token: '--color-fondo' },
  },
  {
    delArtboard: '`html, body { color }`',
    donde: 'helmet, linea 13: el texto',
    leer: delHelmet('html, body', 'color'),
    decision: { tipo: 'igual', token: '--color-tinta' },
  },
  {
    delArtboard: '`html, body { font-family }`',
    donde: 'helmet, linea 13',
    leer: delHelmet('html, body', 'font-family'),
    decision: { tipo: 'igual', token: '--font-sans' },
  },
  {
    delArtboard: '`:focus-visible { outline }`',
    donde: 'helmet, linea 17',
    leer: delHelmet(':focus-visible', 'outline'),
    // El token vale lo del artboard. Que el contorno global NO se pinte con el —2.98:1— es una
    // decision de `src/estilos.css`, y la mide `tailwind-emite-las-clases`.
    decision: { tipo: 'igual', token: '--color-foco' },
  },

  // ── Lo que el marcado pinta en linea y la libreria decidio distinto ───────────────────────
  {
    delArtboard: 'filo de la alerta',
    donde: 'linea 148: `role="alert"` de la busqueda',
    leer: enElMarcado(/<div role="alert" style="[^"]*?border:1px solid (#[0-9A-Fa-f]{3,6})/),
    decision: {
      tipo: 'desviacion',
      token: '--color-mal-borde',
      elArtboardDice: '#EBCCD1',
      laLibreriaDice: '#a94442',
      porQue:
        'La tabla de `kamayuk-lib`#56 decia `#EBCCD1` y la revision lo corrigio: en la libreria ' +
        '`--mal-borde` es el filo del campo con `aria-invalid` (`CONTROL`), que el artboard dibuja ' +
        'en `#A94442` (fila `ROJO_FG en IN_MAL`). El filo tenue de la alerta lo saca `Alerta` de ' +
        '`border-mal-borde/40`.',
    },
  },
  {
    delArtboard: 'velo del boton «Iniciar sesion» en reposo',
    donde: 'linea 71',
    leer: enElMarcado(/border-radius:3px; background:(rgba\([^)]*\)); color:#fff; font-size:14px/),
    decision: {
      tipo: 'desviacion',
      token: '--color-barra-control',
      elArtboardDice: 'rgba(255,255,255,.1)',
      laLibreriaDice: 'rgba(255, 255, 255, 0.06)',
      porQue:
        'Los tres velos de la barra bajan por contraste (`kamayuk-lib`#56, historia de #41): con ' +
        'los del artboard, las iniciales del avatar con hover dan 3.55:1 y lo secundario sobre el ' +
        'hover 4.22:1. El hover se queda en el techo de `--sobre-barra-2` (15 %), el reposo baja ' +
        'para seguir distinguiendose de el (6 %) y el disco toma lo que queda (12 %).',
    },
  },
  {
    delArtboard: 'velo del disco del avatar',
    donde: 'linea 80',
    leer: enElMarcado(/border-radius:50%; background:(rgba\([^)]*\))/),
    decision: {
      tipo: 'desviacion',
      token: '--color-barra-realce',
      elArtboardDice: 'rgba(255,255,255,.22)',
      laLibreriaDice: 'rgba(255, 255, 255, 0.12)',
      porQue: 'Ver el velo en reposo: los tres se decidieron juntos.',
    },
  },
  {
    delArtboard: 'velo del menu de sesion con hover',
    donde: 'linea 79',
    leer: enElMarcado(/style-hover="background:(rgba\([^)]*\))">\s*<span style="display:grid/),
    decision: {
      tipo: 'desviacion',
      token: '--color-barra-hover',
      elArtboardDice: 'rgba(255,255,255,.18)',
      laLibreriaDice: 'rgba(255, 255, 255, 0.15)',
      porQue: 'Ver el velo en reposo: los tres se decidieron juntos.',
    },
  },

  // ── Lo que el marcado pinta en linea y SI es token ────────────────────────────────────────
  {
    delArtboard: 'lo secundario sobre la barra',
    donde: 'linea 66: la entidad bajo el titulo',
    leer: enElMarcado(/font-size:11\.5px; color:(#[0-9A-Fa-f]{3,6}); overflow:hidden[^>]*>\{\{ entidad \}\}/),
    decision: { tipo: 'igual', token: '--color-sobre-barra-2' },
  },
  {
    delArtboard: 'papel del campo con error',
    donde: 'linea 719: `IN_MAL`',
    leer: enElMarcado(/const IN_MAL = [^\n]*?background:(#[0-9A-Fa-f]{3,6})/),
    decision: { tipo: 'igual', token: '--color-mal-campo' },
  },

  // ── Los grises de nota que no son tokens ──────────────────────────────────────────────────
  {
    delArtboard: 'gris de nota `#777`',
    donde: 'lineas 91, 151, 155, 188, … (trece usos)',
    leer: enElMarcado(/<p style="margin:16px 0 0; font-size:14px; color:(#[0-9A-Fa-f]{3,6}); text-wrap:pretty">Su código/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#777',
      seSustituyePor: '--color-tinta-3',
      porQue:
        'Por debajo de AA sobre blanco (calculado abajo). `kamayuk-lib`#56 lo dejo fuera: la tinta ' +
        'mas tenue que se lee es `--tinta-3`.',
      noLlegaA: { contra: '--color-superficie', umbral: UMBRAL_DE_TEXTO },
    },
  },
  {
    delArtboard: 'gris de nota `#888`',
    donde: 'lineas 215, 403, 458, 470, … (siete usos)',
    leer: enElMarcado(/<p style="margin:4px 0 0; font-size:12\.5px; color:(#[0-9A-Fa-f]{3,6}); text-wrap:pretty">\{\{ c\.nota \}\}/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#888',
      seSustituyePor: '--color-tinta-3',
      porQue: 'Como `#777`, y mas lejos todavia de AA.',
      noLlegaA: { contra: '--color-superficie', umbral: UMBRAL_DE_TEXTO },
    },
  },

  // ── El marco del portal (issue 4) ─────────────────────────────────────────────────────────
  {
    delArtboard: 'etiqueta de un paso futuro',
    donde: 'linea 1076: `color` de la franja cuando el paso no es el actual ni esta hecho',
    leer: enElMarcado(/color:' \+ \(on \? '#333' : \(hecho \? '#555' : '(#[0-9A-Fa-f]{3,6})'\)\)/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#AAA',
      seSustituyePor: '--color-tinta-3',
      porQue:
        'Un paso futuro se lee y se pulsa (avisa «Complete primero los pasos anteriores.»), y `#AAA` ' +
        'queda muy por debajo de AA sobre blanco (calculado abajo). `src/marco/FranjaDePasos.tsx` lo ' +
        'pinta en `--tinta-3`, la tinta mas tenue que se lee, y su numero tambien: el `#999` del ' +
        'artboard es `--tinta-4`, que la libreria declara «no es color de texto».',
      noLlegaA: { contra: '--color-superficie', umbral: UMBRAL_DE_TEXTO },
    },
  },
  {
    delArtboard: 'disco del numero de un paso futuro',
    donde: 'linea 1073: `background` del numero de la franja',
    leer: enElMarcado(/\(on \? AZUL : \(hecho \? VERDE_BG : '(#[0-9A-Fa-f]{3,6})'\)\)/),
    decision: { tipo: 'igual', token: '--color-linea-2' },
  },
  {
    delArtboard: 'opcion del menu de la sesion con hover',
    donde: 'linea 95: `style-hover` de cada opcion',
    leer: enElMarcado(/style-hover="background:(#[0-9A-Fa-f]{3,6})">\{\{ o\.label \}\}/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F6F9FC',
      seSustituyePor: '--color-sup',
      porQue:
        '`clasico` no tiene ese papel. `OpcionDelMenu` de `@kamayuk/ui` resalta con `--sup` ' +
        '(`#f9fbfd`), el papel secundario mas cercano, y `src/marco/Barra.tsx` lo deja.',
    },
  },

  // ── Paso 1 · Buscar mi deuda (issue 5) ────────────────────────────────────────────────────
  {
    delArtboard: 'filo de la tarjeta de la busqueda',
    donde: 'linea 124',
    leer: enElMarcado(/<div style="background:#fff; border:1px solid (#[0-9A-Fa-f]{3,6}); box-shadow:0 1px 2px/),
    decision: { tipo: 'igual', token: '--color-linea' },
  },
  {
    delArtboard: 'la entrada bajo el titulo',
    donde: 'linea 127',
    leer: enElMarcado(/font-size:16px; line-height:1\.6; color:(#[0-9A-Fa-f]{3,6}); max-width:64ch/),
    decision: { tipo: 'igual', token: '--color-tinta-2' },
  },
  {
    delArtboard: 'filo izquierdo del error de la busqueda',
    donde: 'linea 148',
    leer: enElMarcado(/<div role="alert" style="[^"]*?border-left:4px solid (#[0-9A-Fa-f]{3,6})/),
    decision: { tipo: 'igual', token: '--color-mal-tinta' },
  },
  {
    delArtboard: 'papel de «Qué puede hacer aquí»',
    donde: 'linea 154',
    leer: enElMarcado(/border-top:1px solid #EEE; background:(#[0-9A-Fa-f]{3,6}); padding:18px 26px 20px/),
    decision: { tipo: 'igual', token: '--color-sup' },
  },
  {
    delArtboard: 'caja del icono de una capacidad',
    donde: 'linea 160',
    leer: enElMarcado(/width:28px; height:28px; border-radius:3px; background:(#[0-9A-Fa-f]{3,6}); color:#0D5FA8/),
    decision: { tipo: 'igual', token: '--color-azul-suave' },
  },
  {
    delArtboard: 'detalle de una capacidad',
    donde: 'linea 169',
    leer: enElMarcado(/line-height:1\.55; color:(#[0-9A-Fa-f]{3,6}); text-wrap:pretty">\{\{ c\.detalle \}\}/),
    decision: { tipo: 'igual', token: '--color-tinta-3' },
  },
  {
    delArtboard: 'filo de cada capacidad',
    donde: 'linea 1099: `border-top` del estilo de cada capacidad',
    leer: enElMarcado(/margin-right:18px; border-top:1px solid (#[0-9A-Fa-f]{3,6})' \+ \(i === 0/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#E4E4E4',
      seSustituyePor: '--color-linea',
      porQue:
        '`clasico` tiene dos filos grises, `--linea` (`#ddd`) y `--linea-2` (`#eee`), y ninguno es ' +
        '`#E4E4E4`. `src/pasos/buscar/Buscar.tsx` usa `--linea`: es el mas cercano, y deja el filo de ' +
        'cada capacidad un punto mas marcado que el `#EEE` que separa la seccion, como en el artboard.',
    },
  },
  {
    delArtboard: 'filo tenue de la amnistia',
    donde: 'linea 176',
    leer: enElMarcado(/<div style="margin-top:18px; border:1px solid (#[0-9A-Fa-f]{3,6}); border-left:4px solid/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#FAEBCC',
      seSustituyePor: '--color-atencion-tinta',
      porQue:
        '`clasico` no tiene filo para el tono `atencion`. `src/piezas/AvisoConFilo.tsx` lo pinta con ' +
        '`--atencion-tinta` al 25 %, que es lo que hace `Alerta` de `@kamayuk/ui` con el mismo tono ' +
        '(el filo tenue del error, `#EBCCD1`, es la fila «filo de la alerta»).',
    },
  },
  {
    delArtboard: 'filo izquierdo de la amnistia',
    donde: 'linea 176',
    leer: enElMarcado(/<div style="margin-top:18px; border:1px solid #[0-9A-Fa-f]{3,6}; border-left:4px solid (#[0-9A-Fa-f]{3,6})/),
    decision: { tipo: 'igual', token: '--color-atencion-tinta' },
  },

  // ── Paso 2 · Elegir qué pago (issue 6) ────────────────────────────────────────────────────
  {
    delArtboard: 'lo secundario sobre la banda del total',
    donde: 'lineas 199-206: «Deuda total al …», la nota, «Con la amnistía» y el descuento',
    leer: enElMarcado(/letter-spacing:\.09em; color:(#[0-9A-Fa-f]{3,6})">Deuda total al/),
    decision: { tipo: 'igual', token: '--color-sobre-barra-2' },
  },
  {
    delArtboard: 'recargo de un concepto',
    donde: 'linea 245: «incluye S/ … de recargo»',
    leer: enElMarcado(/color:(#[0-9A-Fa-f]{3,6}); margin-top:3px">\{\{ d\.recargo \}\}/),
    decision: { tipo: 'igual', token: '--color-mal-tinta' },
  },
  {
    delArtboard: 'vencimiento de un concepto sin tono',
    donde: 'linea 1140: `venceColor` cuando el tono no es `mal` ni `atencion`',
    leer: enElMarcado(/\(d\.tono === 'atencion' \? AMBAR_FG : '(#[0-9A-Fa-f]{3,6})'\)/),
    decision: { tipo: 'igual', token: '--color-tinta-3' },
  },
  {
    delArtboard: 'papel de la fila marcada',
    donde: 'linea 1147: `marcoStyle` de un concepto marcado',
    leer: enElMarcado(/\(marcada \? '(#[0-9A-Fa-f]{3,6})' : '#fff'\)/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F7FBFE',
      seSustituyePor: '--color-sup',
      porQue:
        '`clasico` no tiene ese papel. `src/pasos/deudas/Deudas.tsx` usa `--sup` (`#f9fbfd`), el papel ' +
        'secundario mas cercano, que es el que pide el issue 6 («Fila marcada: fondo `sup`»).',
    },
  },
  {
    delArtboard: 'filo izquierdo de la fila marcada',
    donde: 'linea 1148: `marcoStyle` de un concepto marcado',
    // Como `IN_MAL`: la linea concatena una constante. Se lee cual, y luego su valor.
    leer: (artboard) => {
      const nombre = enElMarcado(/border-left:4px solid ' \+ \(marcada \? ([A-Z_]+) : 'transparent'\)/)(artboard);
      return nombre === null ? null : constante(nombre)(artboard);
    },
    decision: { tipo: 'igual', token: '--color-azul' },
  },
  {
    delArtboard: 'papel del desglose',
    donde: 'linea 252',
    leer: enElMarcado(/border-top:1px solid #EEE; background:(#[0-9A-Fa-f]{3,6}); padding:4px 20px 16px/),
    decision: { tipo: 'igual', token: '--color-sup' },
  },
  {
    delArtboard: 'filo del contenedor de la tabla del desglose',
    donde: 'linea 254',
    leer: enElMarcado(/<div style="overflow-x:auto; background:#fff; border:1px solid (#[0-9A-Fa-f]{3,6})">/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#E4E4E4',
      seSustituyePor: '--color-linea',
      porQue: 'El mismo gris que el filo de cada capacidad (fila de arriba), con la misma decision: `--linea`.',
    },
  },
  {
    delArtboard: 'papel del rotulo de la tabla del desglose',
    donde: 'linea 721: `TH`',
    leer: enElMarcado(/const TH = '[^']*background:(#[0-9A-Fa-f]{3,6})/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F2F2F2',
      seSustituyePor: '--color-sup',
      porQue:
        'La tabla del desglose es `Tabla` de `@kamayuk/ui`, y su `TablaRotulo` pinta la cabecera del ' +
        'producto: versalitas de 11.5 px en `--tinta-3` sobre `--sup`. `clasico` no tiene el `#F2F2F2`.',
    },
  },
  {
    delArtboard: 'ahorro de lo marcado',
    donde: 'linea 290: «Con la amnistía paga …»',
    leer: enElMarcado(/color:(#[0-9A-Fa-f]{3,6}); margin-top:3px">\{\{ seleccion\.ahorro \}\}/),
    decision: { tipo: 'igual', token: '--color-ok-tinta' },
  },
  {
    delArtboard: 'boton de pagar sin nada marcado',
    donde: 'linea 1169: `botonStyle` con la seleccion vacia, con texto blanco',
    leer: enElMarcado(/\(c\.sel\.length === 0 \? '(#[0-9A-Fa-f]{3,6})' : AZUL\)/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#BBB',
      seSustituyePor: '--color-linea',
      porQue:
        'Blanco sobre `#BBB` no llega a AA (calculado abajo), y el boton sigue siendo pulsable: avisa ' +
        '«Marque al menos un concepto para poder pagar.», asi que lo que dice se tiene que leer. ' +
        '`src/pasos/deudas/Deudas.tsx` lo pinta en `--tinta-2` sobre `--linea` (5.49:1).',
      noLlegaA: { contra: '--color-sobre-azul', umbral: UMBRAL_DE_TEXTO },
    },
  },
  {
    delArtboard: 'filo tenue de «No le queda nada por pagar»',
    donde: 'linea 302',
    leer: enElMarcado(/<div style="background:#DFF0D8; border:1px solid (#[0-9A-Fa-f]{3,6}); border-left:5px solid/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#D6E9C6',
      seSustituyePor: '--color-ok-tinta',
      porQue:
        '`clasico` no tiene filo para el tono `ok`. Se pinta con `--ok-tinta` al 25 %, que es lo que hace ' +
        '`Alerta` de `@kamayuk/ui` con ese tono (y `AvisoConFilo` con `atencion`).',
    },
  },
  {
    delArtboard: 'titulo de «No le queda nada por pagar»',
    donde: 'linea 303',
    leer: enElMarcado(/color:(#[0-9A-Fa-f]{3,6})">No le queda nada por pagar/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#2D5A2E',
      seSustituyePor: '--color-ok-tinta',
      porQue:
        '`clasico` no tiene un verde mas oscuro que `--ok-tinta`. El titulo se distingue del texto por ' +
        'su tamano (18 px) y su negrita, que se conservan.',
    },
  },
  {
    delArtboard: '«Pedir mi constancia de no adeudo» con hover',
    donde: 'linea 305: `style-hover` del boton',
    leer: enElMarcado(/style-hover="background:(#[0-9A-Fa-f]{3,6})">Pedir mi constancia de no adeudo<\/button>\s*<\/div>\s*<\/sc-if>\s*<\/div>\s*<\/sc-if>/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#EFF7EC',
      seSustituyePor: '--color-ok-fondo',
      porQue: '`clasico` no tiene ese papel; `--ok-fondo` es el verde claro de la identidad.',
    },
  },

  // ── Paso 3 · Mis datos (issue 7) ──────────────────────────────────────────────────────────
  {
    delArtboard: 'filo superior de «Solo con mi correo»',
    donde: 'linea 318: escrito en el marcado, no con la constante `ACERO`',
    leer: enElMarcado(/border-top:3px solid (#[0-9A-Fa-f]{3,6}); padding:22px 22px 24px">\s*<h2[^>]*>Solo con mi correo/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#3D7EB7',
      seSustituyePor: '--color-azul',
      porQue:
        'Es `ACERO` (fila de arriba), con su misma decision: `--azul`. El issue 7 lo llama «acento del ' +
        'tema», pero `--acento` (`#1ba0d7`) es el cian del foco, y a su lado el granate de la otra tarjeta ' +
        'dejaria de leerse como su pareja.',
    },
  },
  {
    delArtboard: 'filo superior de «Con mi cuenta»',
    donde: 'linea 335: escrito en el marcado, no con la constante `GRANATE`',
    leer: enElMarcado(/border-top:3px solid (#[0-9A-Fa-f]{3,6}); padding:22px 22px 24px">\s*<h2[^>]*>Con mi cuenta/),
    decision: GRANATE_DE_LA_CUENTA,
  },
  {
    delArtboard: 'filo de las tarjetas de «Mis datos»',
    donde: 'linea 318',
    leer: enElMarcado(/<div style="background:#fff; border:1px solid (#[0-9A-Fa-f]{3,6}); border-top:3px solid #3D7EB7/),
    decision: { tipo: 'igual', token: '--color-linea' },
  },
  {
    delArtboard: 'lo que va a pagar',
    donde: 'linea 315: el parrafo bajo el titulo',
    leer: enElMarcado(/font-size:16px; line-height:1\.6; color:(#[0-9A-Fa-f]{3,6}); max-width:66ch; text-wrap:pretty">Va a pagar/),
    decision: { tipo: 'igual', token: '--color-tinta-2' },
  },
  {
    delArtboard: 'texto de una tarjeta de «Mis datos»',
    donde: 'lineas 320 y 337',
    leer: enElMarcado(/line-height:1\.6; color:(#[0-9A-Fa-f]{3,6}); text-wrap:pretty">Lo más rápido/),
    decision: { tipo: 'igual', token: '--color-tinta-3' },
  },
  {
    delArtboard: 'error del correo y de la cuenta',
    donde: 'lineas 326 y 347',
    leer: enElMarcado(/font-size:13\.5px; color:(#[0-9A-Fa-f]{3,6})">\{\{ errorCorreo \}\}/),
    decision: { tipo: 'igual', token: '--color-mal-tinta' },
  },
  {
    delArtboard: '«Entrar y pagar» con hover',
    donde: 'linea 349: `style-hover` del boton secundario',
    leer: enElMarcado(/style-hover="background:(#[0-9A-Fa-f]{3,6})">Entrar y pagar/),
    decision: { tipo: 'igual', token: '--color-info-fondo' },
  },

  // ── Paso 4 · Pagar (issue 8) ──────────────────────────────────────────────────────────────
  {
    delArtboard: 'nota de un medio de pago',
    donde: 'linea 376',
    leer: enElMarcado(/line-height:1\.5; color:(#[0-9A-Fa-f]{3,6}); margin-top:7px; text-align:left/),
    decision: { tipo: 'igual', token: '--color-tinta-3' },
  },
  {
    delArtboard: 'caja del icono de un medio no elegido',
    donde: 'linea 1210: `iconStyle`',
    leer: enElMarcado(/\(on \? AZUL : '(#[0-9A-Fa-f]{3,6})'\) \+ '; color:'/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F0F2F4',
      seSustituyePor: '--color-fondo',
      esElMasCercano: true,
      porQue:
        '`clasico` no tiene ese gris. `src/pasos/pagar/Pagar.tsx` pinta la caja con `--fondo`, el mas cercano ' +
        '(calculado abajo), y el icono con `--tinta-3` (el `#777` del artboard, fila «gris de nota»).',
    },
  },
  {
    delArtboard: 'filo del medio elegido',
    donde: 'linea 1212: `style` del boton del medio',
    // Como `IN_MAL`: la linea concatena una constante. Se lee cual, y luego su valor.
    leer: (artboard) => {
      const nombre = enElMarcado(/\(on \? '2px solid ' \+ ([A-Z_]+) : '1px solid/)(artboard);
      return nombre === null ? null : constante(nombre)(artboard);
    },
    decision: { tipo: 'igual', token: '--color-azul' },
  },
  {
    delArtboard: 'papel del medio elegido',
    donde: 'linea 1213: `style` del boton del medio',
    leer: enElMarcado(/cursor:pointer; background:' \+ \(on \? '(#[0-9A-Fa-f]{3,6})' : '#fff'\)/),
    decision: {
      tipo: 'desviacion',
      token: '--color-azul-suave',
      elArtboardDice: '#F0F6FB',
      laLibreriaDice: '#e8f1f9',
      porQue:
        'El issue 8 lo pide asi («activo con borde 2 px `azul` y fondo `azul-suave`»). `#F0F6FB` es ' +
        '`--info-fondo`, el papel de los avisos informativos y del bloque del codigo de pago (fila de abajo): ' +
        'con el, el medio elegido y el codigo que se lleva al banco serian el mismo papel. `--azul-suave` es ' +
        'el realce azul de la identidad, un punto mas marcado.',
    },
  },
  {
    delArtboard: 'filo discontinuo del codigo de pago',
    donde: 'linea 414',
    leer: enElMarcado(/border:1px dashed (#[0-9A-Fa-f]{3,6}); background:/),
    decision: { tipo: 'igual', token: '--color-azul' },
  },
  {
    delArtboard: 'papel del codigo de pago',
    donde: 'linea 414',
    leer: enElMarcado(/border:1px dashed #[0-9A-Fa-f]{3,6}; background:(#[0-9A-Fa-f]{3,6}); padding:18px/),
    decision: { tipo: 'igual', token: '--color-info-fondo' },
  },
  {
    delArtboard: 'filo de la rejilla de bancos',
    donde: 'linea 432',
    leer: enElMarcado(/data-bancos="1" style="[^"]*border:1px solid (#[0-9A-Fa-f]{3,6})"/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#E4E4E4',
      seSustituyePor: '--color-linea',
      porQue: 'El mismo gris que el filo de cada capacidad (paso 1), con la misma decision: `--linea`.',
    },
  },
  {
    delArtboard: 'papel del pie del panel del medio',
    donde: 'linea 444',
    leer: enElMarcado(/border-top:1px solid #EEE; background:(#[0-9A-Fa-f]{3,6})">\s*<p[^>]*>\{\{ medio\.aviso \}\}/),
    decision: { tipo: 'igual', token: '--color-sup' },
  },
  {
    delArtboard: 'boton verde de confirmar',
    donde: 'linea 446: fondo del boton, con texto blanco',
    leer: enElMarcado(/padding:0 28px; background:(#[0-9A-Fa-f]{3,6}); color:#fff; font-size:16px/),
    // Que el texto encima se lee lo calcula la prueba de abajo, en claro y en oscuro.
    decision: { tipo: 'igual', token: '--color-ok-tinta' },
  },
  {
    delArtboard: 'boton verde de confirmar con hover',
    donde: 'linea 446: `style-hover` del boton',
    leer: enElMarcado(/style-hover="background:(#[0-9A-Fa-f]{3,6})">\{\{ medio\.boton \}\}/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#326032',
      seSustituyePor: '--color-ok-tinta',
      esElMasCercano: true,
      porQue:
        '`clasico` no tiene un verde mas oscuro que `--ok-tinta` (el mas cercano, calculado abajo). ' +
        '`src/pasos/pagar/Pagar.tsx` deja el fondo en `--ok-tinta` y lo oscurece con `hover:brightness-90`: ' +
        'un filtro, no un color, que en claro sube el contraste del texto en vez de bajarlo.',
    },
  },
  {
    delArtboard: 'cabecera del resumen «Lo que va a pagar»',
    donde: 'linea 451',
    leer: enElMarcado(/border-bottom:1px solid #EEE; background:(#[0-9A-Fa-f]{3,6})">\s*<h2[^>]*>Lo que va a pagar/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F2F6FA',
      seSustituyePor: '--color-sup',
      porQue:
        '`clasico` no tiene ese papel. El mas cercano es `--info-fondo`, que es el papel de los avisos y ' +
        'aqui el del codigo de pago; el issue 8 pide `sup` para la fila del total, que el artboard pinta con ' +
        'el mismo `#F2F6FA`, y la cabecera va con ella: `--sup` es la cabecera de `Tabla` y el pie del panel.',
    },
  },
  {
    delArtboard: 'papel de «Total a pagar»',
    donde: 'linea 1241: `filaStyle` de la cuarta fila de los totales',
    leer: enElMarcado(/background:' \+ \(i === 3 \? '(#[0-9A-Fa-f]{3,6})' : '#fff'\)/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F2F6FA',
      seSustituyePor: '--color-sup',
      porQue: 'El issue 8 lo pide («fondo `sup`»). Es el papel de la cabecera del resumen (fila de arriba).',
    },
  },
  {
    delArtboard: 'filo de «Total a pagar»',
    donde: 'linea 1241: `filaStyle` de la cuarta fila de los totales',
    leer: enElMarcado(/border-top:' \+ \(i === 3 \? '2px solid (#[0-9A-Fa-f]{3,6})'/),
    decision: { tipo: 'igual', token: '--color-linea' },
  },
  {
    delArtboard: 'filo de las demas filas de los totales',
    donde: 'linea 1241: `filaStyle`',
    leer: enElMarcado(/'2px solid #[0-9A-Fa-f]{3,6}' : '1px solid (#[0-9A-Fa-f]{3,6})'\)/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F6F6F6',
      seSustituyePor: '--color-linea-2',
      porQue:
        'Es un filo, y `--linea-2` es el filo mas tenue de `clasico`. Lo mas cercano son `--fondo` y `--sup`, ' +
        'que son papeles: sobre el blanco del resumen apenas separan, y el modo oscuro los deriva como papel.',
    },
  },
  {
    delArtboard: 'filo de cada concepto del resumen',
    donde: 'linea 454',
    leer: enElMarcado(/padding:12px 18px; border-bottom:1px solid (#[0-9A-Fa-f]{3,6})">/),
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#F0F0F0',
      seSustituyePor: '--color-linea-2',
      esElMasCercano: true,
      porQue: '`clasico` no tiene ese gris; `--linea-2` (`#eee`) es el mas cercano, calculado abajo.',
    },
  },
];

/**
 * El boton verde de confirmar del paso 4 (issue 8): el fondo y el texto que `src/pasos/pagar/Pagar.tsx`
 * le pone. El artboard escribe blanco sobre `#3C763D`; aqui es `--sobre-azul` —el texto del `Boton`
 * primario— sobre `--ok-tinta`, y se mide en los DOS modos, porque en oscuro `--ok-tinta` es un verde
 * claro y el texto que se lee encima es el oscuro.
 */
const BOTON_VERDE = { fondo: '--color-ok-tinta', texto: '--color-sobre-azul' } as const;

describe('la identidad `clasico` es la paleta del artboard', () => {
  it('EL CENTINELA: las dos lecturas traen algo, y la tabla cubre cada constante de color', () => {
    // Sin esto, un cambio de formato en `temas.css` dejaria la paleta VACIA y todas las filas
    // «igual» saldrian rojas a la vez con un motivo que no es el suyo — o, peor, un cambio en el
    // artboard dejaria sin constantes y la cobertura de abajo pasaria sobre la nada.
    expect(
      CLASICO.size,
      '`temas.css` no trae el bloque `[data-tema=\'clasico\']` fuera de capa y de `@media`',
    ).toBeGreaterThan(0);

    const constantes = constantesDeColor(ARTBOARD);
    const faltanDelIssue = LAS_QUE_PIDE_EL_ISSUE.filter((n) => !constantes.includes(n));
    expect(
      faltanDelIssue,
      'El artboard ya no declara constantes que el issue 2 manda comparar',
    ).toEqual([]);

    // Una constante de color NUEVA en el artboard no puede quedar fuera sin decidir que es.
    const enLaTabla = new Set(TABLA.map((f) => f.delArtboard));
    const sinDecidir = constantes.filter((n) => !enLaTabla.has(n));
    expect(
      sinDecidir,
      'El artboard declara constantes de color que la tabla no decide:\n' +
        `${sinDecidir.map((n) => `  ${n}`).join('\n')}\n\n` +
        '  Cada una entra en `TABLA` como `igual`, `desviacion` o `sin-token`, con su porque.',
    ).toEqual([]);
  });

  it('EL CENTINELA: la guarda muerde sobre una copia del artboard con un hex retocado', () => {
    // La demostracion de que puede fallar, escrita para que se pueda mirar: la misma tabla, contra
    // una COPIA en memoria del artboard con `AZUL` y el lienzo del helmet cambiados. El vendorizado
    // no se toca, que su huella la vigila `los-artboards-estan`.
    const retocado = ARTBOARD.replace("const AZUL = '#0D5FA8';", "const AZUL = '#0D5FA9';").replace(
      'html, body { margin: 0; background: #F4F6F8;',
      'html, body { margin: 0; background: #F4F6F9;',
    );
    expect(retocado, 'el retoque no encontro que retocar').not.toBe(ARTBOARD);

    const rojo = discrepancias(TABLA, retocado, CLASICO);
    expect(rojo.some((l) => l.includes('AZUL (') && l.includes('#0d5fa9'))).toBe(true);
    expect(rojo.some((l) => l.includes('background') && l.includes('#f4f6f9'))).toBe(true);

    // Y las otras dos decisiones tambien muerden: una desviacion cuyo valor de libreria cambia, y
    // un «sin token» que la libreria empieza a publicar.
    const otraPaleta = new Map(CLASICO)
      .set('--color-barra-hover', 'rgba(255, 255, 255, 0.18)')
      .set('--color-enlace', '#1569b0');
    const rojoDeLaLibreria = discrepancias(TABLA, ARTBOARD, otraPaleta);
    expect(rojoDeLaLibreria.some((l) => l.includes('--color-barra-hover') && l.includes('sobra'))).toBe(true);
    expect(rojoDeLaLibreria.some((l) => l.includes('AZUL_TXT') && l.includes('--color-enlace'))).toBe(true);
  });

  it('cada color del artboard esta en su token, o su desviacion esta escrita y sigue siendo cierta', () => {
    const rojo = discrepancias(TABLA, ARTBOARD, CLASICO);
    expect(
      rojo,
      'La identidad `clasico` de `@kamayuk/ui` dejo de ser la paleta que dibuja el artboard:\n' +
        `${rojo.join('\n')}\n\n` +
        '  Este portal no arregla esto escribiendo un color: el artboard manda, y si la identidad se\n' +
        '  aparto, el cambio es un issue en `kamayuk-lib`. Si la desviacion es deliberada, entra en\n' +
        '  `TABLA` con su porque.',
    ).toEqual([]);
  });

  it('y lo que se sustituye «por el mas cercano», no se cree: se calcula', () => {
    const conEsaRazon = TABLA.filter(
      (f): f is Correspondencia & { decision: { tipo: 'sin-token'; seSustituyePor: string } } =>
        f.decision.tipo === 'sin-token' && f.decision.esElMasCercano === true && f.decision.seSustituyePor !== null,
    );
    expect(conEsaRazon.length, 'ninguna fila se justifica por cercania: esta prueba se quedo sin sujeto').toBeGreaterThan(0);

    const lejos = conEsaRazon.flatMap(({ delArtboard, leer, decision }) => {
      const valor = normalizar(leer(ARTBOARD) ?? decision.elArtboardDice);
      const { tokens, distancia } = masCercanos(valor, CLASICO);
      return tokens.includes(decision.seSustituyePor)
        ? []
        : [
            `  ${delArtboard} (${valor}): se sustituye por ${decision.seSustituyePor}, y lo mas cercano de ` +
              `la identidad es ${tokens.join(', ')} (ΔE ${conDosDecimales(distancia)})`,
          ];
    });
    expect(
      lejos,
      'La tabla dice «el mas cercano» de un token que no lo es:\n' + `${lejos.join('\n')}\n\n  Revisa la fila.`,
    ).toEqual([]);
  });

  it('el boton verde de confirmar se lee: su texto sobre `--ok-tinta` llega a AA en claro y en oscuro', () => {
    const temas = reglasDe(readFileSync(temasDeUi(), 'utf8'));
    const oscuro = new Map<string, string>();
    for (const regla of temas) {
      if (regla.dentroDe.length > 0 || !regla.selectores.includes("[data-tema='clasico'][data-modo='oscuro']")) continue;
      for (const [propiedad, valor] of regla.declaraciones) oscuro.set(propiedad, valor);
    }
    expect(oscuro.size, "`temas.css` no trae `[data-tema='clasico'][data-modo='oscuro']`").toBeGreaterThan(0);

    const medidas = (
      [
        ['claro', CLASICO],
        ['oscuro', oscuro],
      ] as const
    ).map(([modo, paleta]) => {
      const fondo = paleta.get(BOTON_VERDE.fondo);
      const texto = paleta.get(BOTON_VERDE.texto);
      if (fondo === undefined || texto === undefined) return { modo, razon: 0, dice: 'la identidad no declara el par' };
      const razon = contraste(normalizar(fondo), normalizar(texto));
      return { modo, razon, dice: `${BOTON_VERDE.texto} (${texto}) sobre ${BOTON_VERDE.fondo} (${fondo}): ${conDosDecimales(razon)}:1` };
    });
    const noLlegan = medidas.filter((m) => m.razon < UMBRAL_DE_TEXTO).map((m) => `  ${m.modo}: ${m.dice}`);
    expect(
      noLlegan,
      `El texto del boton verde de confirmar no llega a ${UMBRAL_DE_TEXTO}:1:\n${noLlegan.join('\n')}\n\n` +
        '  Busca otro par de tokens y escribe aqui su porque.',
    ).toEqual([]);
  });

  it('y lo que se deja fuera por contraste, no se cree: se calcula', () => {
    const noLlegan = TABLA.flatMap(({ delArtboard, leer, decision }) => {
      if (decision.tipo !== 'sin-token' || decision.noLlegaA === undefined) return [];
      const valor = normalizar(leer(ARTBOARD) ?? decision.elArtboardDice);
      const papel = CLASICO.get(decision.noLlegaA.contra);
      if (papel === undefined) return [`  ${delArtboard}: la identidad no declara ${decision.noLlegaA.contra}`];
      const razon = contraste(valor, normalizar(papel));
      return razon < decision.noLlegaA.umbral
        ? []
        : [
            `  ${delArtboard} (${valor}) contra ${decision.noLlegaA.contra} (${papel}) da ` +
              `${conDosDecimales(razon)}:1, que YA LLEGA a ${decision.noLlegaA.umbral}:1`,
          ];
    });
    expect(
      TABLA.filter((f) => f.decision.tipo === 'sin-token' && f.decision.noLlegaA !== undefined).length,
      'ninguna fila se justifica por contraste: esta prueba se quedo sin sujeto',
    ).toBeGreaterThan(0);
    expect(
      noLlegan,
      'La tabla deja fuera por contraste valores que el calculo ya no descarta:\n' +
        `${noLlegan.join('\n')}\n\n  La razon escrita dejo de ser cierta: revisa la fila.`,
    ).toEqual([]);
  });
});
