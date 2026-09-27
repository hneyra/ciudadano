// El UNICO sitio donde se importa una hoja de estilos. `src/estilos.css` no define ni un color:
// importa la de `@kamayuk/ui` y le dice a Tailwind donde mirar, porque por omision omite
// `node_modules` y la libreria vive ahi por el `link:`. El motivo entero esta dentro de ese archivo.
//
// Y va aqui, en la ENTRADA, y no en `montaje.tsx` (issue 56): el aviso de `src/inicio.ts` se dibuja
// justo cuando el trozo del portal no llego, y sin la hoja saldria sin una sola de sus clases.
import './estilos.css';

import { cargarElPortal } from './inicio.ts';

const raiz = document.getElementById('raiz');
if (raiz === null) {
  // Revienta al principio y con su nombre. Un `raiz!` dejaria la pagina en blanco sin una
  // sola linea en la consola, que es el fallo mas caro de diagnosticar que hay.
  throw new Error('Falta el elemento #raiz en index.html: la aplicacion no tiene donde montarse.');
}

/**
 * **La entrada no trae el portal: lo pide** (issue 56).
 *
 * Todo lo que hasta el issue 56 vivia aqui —React, i18next, el tema, el enrutador, el arranque— es
 * ahora `src/montaje.tsx`, y llega por este `import()`. Si no llega, o si montarlo rechaza (el canje,
 * la fuente, lo que sea), `cargarElPortal` dibuja un aviso con el DOM a pelo en vez de dejar `#raiz`
 * vacio. El porque de cada decision, en la cabecera de `src/inicio.ts`.
 *
 * `void` y no `await`: ver «por que NO hay un `await` de nivel superior» en `src/montaje.tsx`.
 */
void cargarElPortal(raiz, () => import('./montaje.tsx'));
