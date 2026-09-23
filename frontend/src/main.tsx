import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { Aplicacion, ComprobandoLaSesion } from './aplicacion.tsx';
import { arrancar } from './arranque.ts';
import { FuenteActiva, type FuenteDelPortal, hayPlataforma } from './datos/fuente.ts';
import { laFuente } from './datos/laFuente.ts';
import { crearEnrutador } from './enrutador.tsx';
import i18n from './i18n/i18n.ts';
// El UNICO sitio donde se importa una hoja de estilos. `src/estilos.css` no define ni un color:
// importa la de `@kamayuk/ui` y le dice a Tailwind donde mirar, porque por omision omite
// `node_modules` y la libreria vive ahi por el `link:`. El motivo entero esta dentro de ese archivo.
import './estilos.css';

const raiz = document.getElementById('raiz');
if (raiz === null) {
  // Revienta al principio y con su nombre. Un `raiz!` dejaria la pagina en blanco sin una
  // sola linea en la consola, que es el fallo mas caro de diagnosticar que hay.
  throw new Error('Falta el elemento #raiz en index.html: la aplicacion no tiene donde montarse.');
}

/**
 * Un solo cliente de consultas para toda la pagina, creado FUERA del render: dentro, `StrictMode`
 * lo crearia dos veces en desarrollo y cada uno tendria su propia cache.
 *
 * Hoy no hay ninguna consulta —no hay backend—, pero las pantallas de los issues siguientes leen
 * sus datos de demostracion por `useQuery`, y el proveedor tiene que estar ya para que la primera
 * no tenga que tocar este archivo.
 */
const consultas = new QueryClient();

/** El enrutador, por lo mismo: fuera del render, una sola vez (ver `src/enrutador.tsx`). */
const enrutador = crearEnrutador();

/**
 * **Una sola raiz**, y dos cosas que se pueden dibujar en ella: la espera del canje silencioso
 * (issue 35), si tarda, y el portal. `render` sobre la misma raiz sustituye la una por el otro sin
 * desmontar el documento, asi que no hay un instante en blanco entre las dos.
 */
const laRaiz = createRoot(raiz);

function dibujar(fuente: FuenteDelPortal, contenido: ReactNode): void {
  laRaiz.render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={consultas}>
          <FuenteActiva value={fuente}>{contenido}</FuenteActiva>
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  );
}

/**
 * **De donde lee el portal, y solo entonces quien pregunta y quien dibuja** (issues 13 y 27).
 *
 * Tres cosas en orden, y las tres antes de que React monte:
 *
 *   1. **la fuente** (`laFuente()`): la de demostracion o la de la plataforma, segun la bandera de
 *      construccion. Se resuelve antes de montar porque la de demostracion llega por un `import()`
 *      y no hay valor que poner mientras llega: montar primero dejaria a la primera pantalla
 *      leyendo de una fuente que todavia no es;
 *   2. **el canje** (`arrancar()`): si volvemos del emisor, el codigo se canjea antes de la primera
 *      peticion, o esa peticion saldria sin token y recibiria su 401; y si no volvemos y hay
 *      plataforma, se le pregunta al emisor en silencio si ya se habia entrado (issue 35), para que
 *      recargar no eche a nadie;
 *   3. **el montaje**, que va como funcion para que sea LO ULTIMO que pasa: lo que tenga que
 *      ocurrir antes de que React monte no puede colarse despues.
 *
 * <h2>Y por que NO hay un `await` de nivel superior aqui, que era lo natural</h2>
 *
 * Porque `await laFuente()` **cuelga el arranque en un paquete construido en modo demostracion**, y
 * esta medido (issue 27, con el arnes): el trozo de la demostracion importa `src/datos/demostracion.ts`,
 * que Rollup deja en el trozo de ENTRADA porque el recorrido tambien lo usa. Con un `await` arriba,
 * la evaluacion de la entrada se queda suspendida esperando al trozo, y el trozo espera a que la
 * entrada termine de evaluarse: un abrazo mortal. El sintoma es el peor posible — la peticion del
 * trozo sale con 200, no hay ni un error en la consola, y `#raiz` se queda **vacio**.
 *
 * Encadenando en vez de esperando, el modulo de entrada termina de evaluarse, el trozo resuelve y el
 * orden de las tres cosas se mantiene igual. En el paquete de produccion el `import()` se pliega y
 * el ciclo no existe, asi que esto solo se ve con la bandera encendida: por eso lo encontro el arnes
 * y no `yarn build`.
 */
void laFuente().then((fuente) =>
  arrancar(() => dibujar(fuente, <Aplicacion enrutador={enrutador} />), {
    // De la fuente, que es el dato, y no del entorno otra vez: en demostracion no se le pregunta
    // nada a ningun emisor (issue 35).
    conPlataforma: hayPlataforma(fuente),
    esperando: () => dibujar(fuente, <ComprobandoLaSesion />),
  }),
);
