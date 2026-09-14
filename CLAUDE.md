# `ciudadano` — Contexto para agentes

El **portal público de pago de tributos** de la Municipalidad Distrital de Catacaos: la cara que ve
el contribuyente, no la ventanilla. Diseñado en Claude Design (proyecto «SGTM Redesign»,
`Ciudadano.dc.html`) y construido con **el mismo stack que `rentas/frontend`**, enlazado a
[`kamayuk-lib`](https://github.com/hneyra/kamayuk-lib).

Es parte de **Kamayuk**, el producto multi-municipal. Los modelos que se copian —y se leen antes de
suponer nada— son [`rentas`](https://github.com/hneyra/rentas) (`frontend/`, `.github/`, su
`CLAUDE.md`) y el `CLAUDE.md` de `kamayuk-lib`.

## Qué hay hoy, medido y no supuesto

| Pieza | Estado |
|---|---|
| `frontend/` — `ciudadano-web` | **El andamiaje (issue 1) y el tema (issue 2), sin pantallas.** Vite 7 + React 19.3 + TypeScript 5.9 con yarn classic. `yarn verificar` encadena lint, tipos, i18n y pruebas: **16 archivos, 130 pruebas**, 0 fallos. `yarn build` construye el bundle en `dist/`. `yarn dev` sirve `http://localhost:5174/portal/` con un marcador —la barra del artboard: escudo, «Pago de tributos en línea» y «Municipalidad Distrital de Catacaos» por `t()`, en blanco sobre `bg-azul`, sobre `bg-fondo`— |
| `frontend/diseno/` | `Ciudadano.dc.html` y `escudo-catacaos.png`, **vendorizados tal cual**, con su huella SHA-256 vigilada |
| `.github/workflows/frontend.yml` | El job `verificar` de `rentas`: dos checkouts hermanos, `yarn install --frozen-lockfile`, `yarn verificar`, `yarn build` |
| Tema | **Elegido, no escrito** (issue 2): `ProveedorDeTema` de `@kamayuk/ui` en `src/aplicacion.tsx` con `identidadPorOmision: 'clasico'` y `prefijoDeClaves: 'kamayuk.ciudadano'`. `src/estilos.css` no declara ni un color, ni una fuente, ni un radio; su capa `base` porta los estilos globales del artboard con `var(--color-…)`. Lo que del artboard NO es token, o la libreria decidio distinto, esta en la tabla de `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts` |
| Datos, pantallas | **No existen todavía.** Datos de demostración: issue 3, en `src/datos/`. Arnés de Playwright: issue 11 |

## Lo que este repositorio NO hace

- **No tiene backend.** Es solo demostración: los datos salen de `src/datos/` y **nada llama a
  `fetch`** —la prohibición `fetch-fuera-del-cliente` está encendida en todo el árbol, sin
  excepción—. Por eso no hay `server.proxy` en `vite.config.ts`.
- **No tiene login real.** Nada de `@kamayuk/sesion`, PKCE ni Keycloak; tampoco `@kamayuk/api`.
- **No usa `@kamayuk/shell`**: es el armazón de back-office de los sistemas, y esto es un portal.
- **No se despliega.** Sin Dockerfile, sin nginx, sin imagen.
- **No modifica `kamayuk-lib`.** Lo que falte se construye aquí con `radix-ui`, `cn` y los tokens
  del tema; si la librería necesita cambiar, es un issue de allí.

## Estructura

```
frontend/                 Vite 7, React 19, TypeScript 5.9, con yarn. `ciudadano-web`
  src/main.tsx            StrictMode + I18nextProvider + QueryClientProvider. Importa la hoja, UNA vez
  src/aplicacion.tsx      el marcador del andamiaje; lo sustituyen las pantallas
  src/i18n/               el castellano es la clave; el locale se REGENERA, no se escribe
  src/estilos.css         no define ni un color: importa la de `@kamayuk/ui`, dice a Tailwind dónde mirar
                          y porta en `@layer base` los estilos globales del artboard, con tokens
  diseno/                 el artboard y el escudo, tal cual se entregaron
  resolucion.ts           `resolve.dedupe` DERIVADO de las peerDependencies de cada `@kamayuk/*`
  eslint.prohibiciones.mjs  DERIVA las nueve de `@kamayuk/verificaciones`; aquí solo su excepción de ruta
  verificaciones/         las guardas del árbol, sus `muestras/` que las violan y `tipos/`;
                          `colores-propios/` es la muestra de `sin-colores-propios`
.github/workflows/        la CI del frontend
```

**El frontend no funciona sin `kamayuk-lib` clonado al lado**, y en `main`: `package.json` declara
`@kamayuk/{formato,ui,verificaciones}` como `link:../../kamayuk-lib/paquetes/*`. Si falta:

```bash
git clone https://github.com/hneyra/kamayuk-lib ../kamayuk-lib   # desde la raíz de este repositorio
```

Ojo: `yarn install --frozen-lockfile` con el hermano ausente **sale con código 0** y deja enlaces
colgantes. Lo dicen, nombrando el `git clone`, `eslint.prohibiciones.mjs` (primer paso de
`yarn verificar`), `resolucion.ts` (`yarn dev` y `yarn build`) y
`verificaciones/enlace-con-kamayuk-lib.test.ts`.

## Stack

El de `rentas/frontend`, con las mismas versiones resueltas (el `yarn.lock` parte del suyo):
`react`/`react-dom` 19.3.0, `@tanstack/react-query`, `react-hook-form` + `@hookform/resolvers` +
`zod`, `react-router-dom`, `i18next` + `react-i18next`, Tailwind v4 por `@tailwindcss/vite`, y las
peerDependencies de `@kamayuk/ui` (`class-variance-authority`, `clsx`, `tailwind-merge`, `radix-ui`,
`react-day-picker`, `cmdk`, `sonner`, `tailwindcss`). Vitest 3 con jsdom y Testing Library; ESLint 9
con `typescript-eslint`, `react-hooks` y `jsx-a11y`; `i18next-cli`.

Las tres cosas que el enlace exige, aprendidas por las malas en `rentas`: `preserveSymlinks: true`
en `tsconfig.base.json` (rentas#88), `resolve.dedupe` derivado de las peerDependencies (sin él, dos
copias de React) y `@source` en `src/estilos.css` (rentas#107; sin él, Tailwind omite `node_modules`
y la mitad de las clases de la librería no generan regla).

## Reglas que no se negocian

- **Referencia de diseño: `frontend/diseno/Ciudadano.dc.html`.** Los estilos inline son la
  especificación de medidas; los textos en español son **definitivos**. `support.js` y `DCLogic`
  son andamiaje del entorno de diseño y no se portan.
- **`kamayuk-lib` lo más posible**: `@kamayuk/ui` y `@kamayuk/formato` antes que una pieza propia.
- **Importes siempre `string` decimal** (`"1842.60"`); sumas con `sumarImportes`; nada de `number`,
  `Number()`, `parseFloat` ni aritmética sobre importes. `<Importe>` siempre con `fechaCalculo`.
  Lo vigilan las nueve prohibiciones de ESLint, cada una con su muestra.
- **Todo texto visible** (texto, `aria-label`, `placeholder`, `title`, `alt`) pasa por `t()`, y el
  locale se regenera con `yarn i18n:regenerar`.
- **Accesibilidad**: pruebas con Testing Library por rol y nombre accesible; controles de al menos
  44 px de alto donde el artboard lo marca.
- **Toda guarda nueva se demuestra fallando**, y el PR cuenta con qué rotura y qué rojo.
- **PR**: rama `issue-<N>-<slug>`; el cuerpo lleva `Closes #<N>` (en inglés, en el cuerpo: GitHub
  no auto-cierra con la palabra castellana); secciones «Que hace», «Como se demostro que la
  verificacion puede fallar», «Lo que NO cierra»; capturas si hay UI.

## Idioma

Español en el dominio, inglés en lo técnico. **Sin tildes ni eñe en identificadores** (lo prohíbe
ESLint). Comentarios, pruebas, commits y PR en castellano. Los comentarios explican **el porqué**, y
cuando algo viene de `rentas` lo dicen con su número (`rentas#113`): esa procedencia es la medición
que se hizo.

## Comandos

```bash
cd frontend
yarn install                 # con ../../kamayuk-lib en su sitio
yarn verificar               # lint, tipos, i18n y pruebas. Sin navegador ni backend
yarn build                   # el bundle, en dist/
yarn dev                     # http://localhost:5174/portal/ (puerto estricto: el 5173 es de rentas)
yarn i18n:regenerar          # el locale `es` sale de la lista de claves; no se escribe a mano
```

## Verificar antes de afirmar

**Ejecutar la prueba vale más que razonar sobre ella.** Y no basta con que la verificación esté
escrita: **tiene que demostrarse que puede fallar** — se rompe a propósito lo que protege, se
ejecuta, y se anota el rojo exacto que sale.

| Verificación | Cómo se demostró que puede fallar | Resultado |
|---|---|---|
| `andamiaje.test.ts` (#1) | `preserveSymlinks: false`; `yarn i18n` fuera de `verificar`; `build: "tsc --noEmit"`; el workflow sin su ruta en `paths`, sin `--frozen-lockfile`, sin `yarn build`, con `path: libs`, y renombrado | Rojo cada vez. **Hallazgo**: la copia de `rentas` seguía verde sin `--frozen-lockfile` porque la cadena sale en los comentarios; ahora se leen solo las líneas que no son comentario |
| `enlace-con-kamayuk-lib.test.ts` (#1) | `link:` de `formato` apuntando a `ui`; los tres `link:` a un clon inexistente; y el árbol copiado a un directorio sin hermano | «`../../kamayuk-lib/paquetes/ui` es «@kamayuk/ui», no «@kamayuk/formato»»; «no existe» con el `git clone`. Sin hermano, `yarn lint` y `yarn build` ya paran nombrando el `git clone`, y `yarn install --frozen-lockfile` sale con rc=0 |
| `la-resolucion-dice-el-clon-hermano.test.ts` (#1) | `requerir.resolve` a pelo en `resolucion.ts`; el `git clone` quitado de `remedio.mjs` | «Un `resolve` sin envolver vuelve a reventar…»; «expected … to contain 'git clone https://github.com/hneyra/k…'» |
| `las-peerdependencies-estan.test.ts` (#1) | `cmdk` fuera de `package.json`; `radix-ui` a `^0.9.0` | «@kamayuk/ui pide «cmdk» (^1.1.1) y este frontend no lo declara»; «radix-ui: aqui «^0.9.0» y @kamayuk/ui pide «^1.6.7»» |
| `resuelve-el-clon-hermano.test.ts` (#1) | `resolve.dedupe: []` en `vitest.config.ts` | `Failed to resolve import "react/jsx-dev-runtime" from "../../kamayuk-lib/paquetes/ui/textos.tsx"` |
| `tailwind-esta-conectado.test.ts` (#1) | `[react(), tailwind()]`; `[react()]`; el `@source` un nivel corto | «expected 3 to be less than 0»; «Complementos declarados: vite:react-babel, …»; «Ningun `@source` de src/estilos.css cae en @kamayuk/ui» |
| `los-import-resuelven-por-exports.test.ts` (#1) | `@import '@kamayuk/ui/estilos/estilos.css'` (existe, no se publica) | «el `exports` de «@kamayuk/ui» no publica «./estilos/estilos.css»» |
| `las-prohibiciones-son-las-de-la-libreria.test.ts` (#1) | una prohibición propia con `selector:`; un `message` reescrito; `DONDE_SE_LLAMA_A_FETCH = ['src/api/']` | «solo en ciudadano: propia»; «tiene otro «message» aqui que en la libreria»; «expected [ 'src/api/' ] to deeply equal []» |
| `reglas-de-eslint.test.ts` (#1) | muestra `token-en-almacenamiento` borrada; vaciada; `['src/api/']` como excepción; la entrada de `SALVO_EN_ESTE_ARBOL` quitada | «no tiene muestra que la viole»; «(ninguno): expected [] to include 'El token vive en memoria…'»; «un `fetch` en src/api/cliente.ts se senala: expected '' to match …»; ESLint no arranca: «trae prohibiciones con excepcion que este arbol no ha situado» |
| `el-locale-esta-completo.test.ts` (#1) | un valor distinto de su clave; una clave quitada | ««Pago de tributos en línea» dice «Pago de tributos online»»; «faltan». Con la clave quitada, `yarn i18n` sale rc=1: «Incomplete translations detected» |
| `los-artboards-estan.test.ts` (#1) | un texto del artboard retocado; `<x-dc>` quitado; el archivo borrado | «ya no es la copia que se vendorizo»; «no trae el bloque <x-dc>»; «FALTA UN ARTBOARD VENDORIZADO» |
| `src/aplicacion.test.tsx` (#1) | el título, y luego la entidad, escritos a pelo sin `t()` (ESLint no lo caza: rc=0) | «Unable to find an accessible element with the role "heading" and name "⟦Pago de tributos en línea⟧"»; «Unable to find an element with the text: ⟦Municipalidad Distrital de Catacaos⟧» |
| `la-paleta-cuadra-con-el-artboard.test.ts` (#2) | `const AZUL = '#0D5FA9'` y el velo del avatar a `.12` en el artboard vendorizado (restaurados); la fila `GRANATE` renombrada; `laLibreriaDice` de `--mal-borde` a `#EBCCD1`; el umbral de `#777` a 4.4 | «AZUL (constante, linea 706…): el artboard dice «#0d5fa9» y --color-azul vale «#0d5fa8»»; «velo del disco del avatar (linea 80): la tabla se decidio contra «rgba(255, 255, 255, 0.22)» y el artboard dice ahora «rgba(255, 255, 255, 0.12)»»; «El artboard declara constantes de color que la tabla no decide: … [ 'GRANATE' ]»; «la tabla dice que --color-mal-borde vale «#ebccd1» y la identidad dice «#a94442»»; «gris de nota `#777` (#777777) contra --color-superficie (#ffffff) da 4.48:1, que YA LLEGA a 4.4:1» |
| `tailwind-emite-las-clases.test.ts` (#2) | `bg-azull` en el marcador; `@theme { --color-azul: initial; --radius-sm: 5px }` en `src/estilos.css`; el contorno global con `var(--color-foco)`; `table { width }` quitado | «Hay clases escritas que Tailwind NO genera … bg-azull»; «Tailwind no genera la regla `.bg-azul`» y «expected '5px' to be '3px'»; «El contorno de foco global no llega a 3:1 … #1ba0d7 sobre --color-fondo (#f4f6f8): 2.75:1 / sobre --color-superficie (#ffffff): 2.98:1»; «expected '(no se declara)' to be '100%'» |
| `sin-colores-propios.test.ts` (#2) | `:root { --color-azul: #0d5fa8; }` en la hoja; `bg-[#0D5FA8]` y `style={{ borderColor: 'rgb(0, 0, 0)' }}` en el marcador; la guarda sin `cn` y sin la comprobacion de `font-family` | «src/estilos.css:79 — declara --color-azul…» y «color literal «#0d5fa8»»; «src/aplicacion.tsx:47 — color literal «#0D5FA8» en `className`» / ««rgb(» en `style`»; «la guarda no senalo lo que la muestra … viola» (faltan las lineas 11 y 17). **Hallazgo**: sin `cn` seguia verde, porque el unico `cn()` de la muestra colgaba de un `className`; se anadio a la muestra uno suelto |
| `src/aplicacion.test.tsx`, tema (#2) | el `ProveedorDeTema` quitado; `identidadPorOmision: 'institucional'`; `prefijoDeClaves: 'kamayuk.rentas'` | «Expected the element to have attribute: data-tema="clasico" Received: null»; «… Received: data-tema="institucional"»; «… Received: data-tema="sepia"» |
| `tinta-4-no-es-color-de-texto.test.ts` (#2) | `text-tinta-4` en la entidad del marcador | «src/aplicacion.tsx:52 sobre <p> — el elemento no lleva `aria-hidden`, o sea que lo que pinta se lee» |
