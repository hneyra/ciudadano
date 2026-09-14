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
    decision: {
      tipo: 'sin-token',
      elArtboardDice: '#A6093D',
      seSustituyePor: null,
      porQue:
        'Ningun token de `clasico` es un acento granate, y `--mal-tinta` seria decir «error» con un ' +
        'filo decorativo. Lo decide la pantalla de identificarse, y no con un hex propio: o se pide ' +
        'el token a `kamayuk-lib` o se dibuja con otro de la identidad.',
    },
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
];

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
