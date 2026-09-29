import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';

import { Aplicacion, ComprobandoLaSesion, NoSePudoDibujar } from './aplicacion.tsx';
import { arrancar } from './arranque.ts';
import { crearClienteDeConsultas } from './datos/consultas.ts';
import { FuenteActiva, type FuenteDelPortal } from './datos/fuente.ts';
import { laFuente } from './datos/laFuente.ts';
import { type Enrutador, crearEnrutador } from './enrutador.tsx';
import i18n, { sumarLosTextosDeLaFuente } from './i18n/i18n.ts';
import { avisarQueNoSeCargo } from './inicio.ts';
import { LimiteDeErrores } from './marco/NoSePudoMostrar.tsx';
import { politicaDe } from './modo/modo.ts';

/**
 * **El portal, como trozo aparte** (issue 56): lo que hasta entonces era el cuerpo de `main.tsx`.
 *
 * Se carga con un `import()` desde `main.tsx` —por `cargarElPortal`, de `src/inicio.ts`— para que,
 * si no llega o si montarlo rechaza, quede alguien que lo diga sin depender de nada de lo que hay
 * aqui: ni React, ni i18next, ni el tema. Ver la cabecera de `src/inicio.ts`.
 */

/**
 * Un solo cliente de consultas para toda la pagina, creado FUERA del render: dentro, `StrictMode`
 * lo crearia dos veces en desarrollo y cada uno tendria su propia cache.
 *
 * Con la politica del portal (issue 50): lo leido no caduca solo, y ni el foco ni la red lo vuelven a
 * pedir. El porque, en `src/datos/consultas.ts`.
 */
const consultas = crearClienteDeConsultas();

/**
 * El enrutador, por lo mismo: fuera del render, una sola vez (ver `src/enrutador.tsx`). **Pero no al
 * cargar el modulo** (issue 61, revision del PR #72): `createHashRouter` lee la URL al crearse, y la
 * vuelta del emisor la limpia DESPUES, en el canje (`history.replaceState`, que no avisa a nadie).
 * Creado antes, el enrutador arrancaba en la raiz con el navegador ya en `#/entrar`. Se crea al
 * montar, cuando el canje ya termino, y se guarda para no crear otro.
 */
let enrutador: Enrutador | null = null;
function elEnrutador(): Enrutador {
  enrutador ??= crearEnrutador();
  return enrutador;
}

/**
 * **Monta el portal en `raiz`: de donde lee, y solo entonces quien pregunta y quien dibuja**
 * (issues 13, 27 y 56).
 *
 * **Una sola raiz**, y dos cosas que se pueden dibujar en ella: la espera del canje silencioso
 * (issue 35), si tarda, y el portal. `render` sobre la misma raiz sustituye la una por el otro sin
 * desmontar el documento, asi que no hay un instante en blanco entre las dos.
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
 * <h2>Y por que NO hay un `await` de nivel superior, ni aqui ni en `main.tsx`</h2>
 *
 * Porque `await laFuente()` **cuelga el arranque en un paquete construido en modo demostracion**, y
 * esta medido (issue 27, con el arnes): el trozo de la demostracion importa `src/datos/demostracion.ts`,
 * que Rollup deja en el trozo que carga el recorrido —la entrada hasta el issue 56; desde entonces,
 * el de este modulo—. Con un `await` arriba, la evaluacion de ese trozo se queda suspendida esperando
 * al de la demostracion, y este espera a que aquel termine de evaluarse: un abrazo mortal. El
 * sintoma es el peor posible — la peticion del trozo sale con 200, no hay ni un error en la consola,
 * y `#raiz` se queda **vacio**.
 *
 * (Desde el issue 58 `demostracion.ts` ya no esta en este trozo —solo lo importa la fuente de
 * demostracion—, pero la fuente sigue compartiendo modulos con el recorrido, y la regla se queda: un
 * `await` arriba vuelve a depender de como reparta Rollup.)
 *
 * Dentro de una funcion que se llama cuando el modulo YA se evaluo, el ciclo no existe. En el paquete
 * de produccion el `import()` se pliega y tampoco, asi que esto solo se ve con la bandera encendida:
 * por eso lo encontro el arnes y no `yarn build`.
 *
 * <h2>Y lo que revienta DESPUES de montar tampoco deja la pagina en blanco (issue 67)</h2>
 *
 * El `.catch` de abajo solo ve lo que rechaza al montar: `render` no devuelve nada que rechazar, y
 * un error en un dibujo posterior subia hasta la raiz, que React 19 desmonta entera. Dos redes:
 *
 *   · **el limite de errores de la raiz** (`LimiteDeErrores`), dentro de i18next para que su aviso
 *     pase por `t()`, y por fuera de todo lo demas: dibuja «No se pudo mostrar esta pantalla» con su
 *     propio tema (`NoSePudoDibujar`);
 *   · y si hasta ese aviso revienta, **`onUncaughtError`**: React ya vacio la raiz, y se escribe en
 *     ella el aviso de la entrada, el que no necesita ni React ni i18next (`src/inicio.ts`). En una
 *     microtarea, cuando React termino de desmontar: dentro de la llamada, soltar la raiz avisa de una
 *     carrera y lo escrito se borra.
 *
 * Lo que revienta dentro del enrutador lo recoge antes su `errorElement` (`src/enrutador.tsx`), que
 * deja el marco en pie cuando lo que revento es una pantalla.
 */
export function montar(raiz: HTMLElement): Promise<void> {
  const laRaiz = createRoot(raiz, {
    onUncaughtError: (error) => {
      queueMicrotask(() => {
        laRaiz.unmount();
        avisarQueNoSeCargo(raiz, error);
      });
    },
  });

  function dibujar(fuente: FuenteDelPortal, contenido: ReactNode): void {
    laRaiz.render(
      <StrictMode>
        <I18nextProvider i18n={i18n}>
          <LimiteDeErrores alFallar={<NoSePudoDibujar />}>
            <QueryClientProvider client={consultas}>
              <FuenteActiva value={fuente}>{contenido}</FuenteActiva>
            </QueryClientProvider>
          </LimiteDeErrores>
        </I18nextProvider>
      </StrictMode>,
    );
  }

  return laFuente()
    .then((fuente) => {
      // Lo que dicen los datos de la demostracion llega con ella, no en el locale de siempre (issue 58).
      sumarLosTextosDeLaFuente(fuente);
      return arrancar(() => dibujar(fuente, <Aplicacion enrutador={elEnrutador()} />), {
        // De la politica del modo de la fuente, y no del entorno otra vez: con la sesion de la
        // demostracion no se le pregunta nada a ningun emisor (issue 35).
        conEmisor: politicaDe(fuente).sesion.laAbreUnEmisor,
        esperando: () => dibujar(fuente, <ComprobandoLaSesion />),
      });
    })
    .catch((error: unknown) => {
      // React suelta la raiz antes de que `src/inicio.ts` escriba en ella su aviso: dos duenos del
      // mismo nodo es un `removeChild` que revienta en el siguiente render (issue 56).
      laRaiz.unmount();
      throw error;
    });
}
