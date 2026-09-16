import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { Aplicacion } from './aplicacion.tsx';
import { arrancar } from './arranque.ts';
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
 * **Primero quien pregunta, y solo entonces quien dibuja** (issue 13).
 *
 * `arrancar()` canjea el codigo de autorizacion si venimos del emisor, y **monta siempre**: este
 * portal no va a la puerta al arrancar, porque su recorrido entero funciona en modo demostracion.
 * El porque entero, en `src/arranque.ts`.
 *
 * El montaje va como funcion y no en la linea de abajo para que sea LO ULTIMO que pasa: lo que
 * tenga que ocurrir antes de que React monte no puede colarse despues.
 */
await arrancar(() => {
  createRoot(raiz).render(
    <StrictMode>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={consultas}>
          <Aplicacion enrutador={enrutador} />
        </QueryClientProvider>
      </I18nextProvider>
    </StrictMode>,
  );
});
