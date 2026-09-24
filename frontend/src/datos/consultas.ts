import { QueryClient } from '@tanstack/react-query';

/**
 * **El cliente de consultas del portal, con su politica escrita** (issue 50).
 *
 * Hasta el issue 50 `main.tsx` hacia `new QueryClient()` a secas, y los valores por omision de React
 * Query son los de una aplicacion que lee datos que cambian solos: todo caduca al instante
 * (`staleTime: 0`) y se vuelve a pedir al montar, al recuperar el foco de la pestana y al volver la
 * red. Aqui eso es un defecto, por tres razones:
 *
 *   · **la deuda no cambia sola mientras se mira**: cambia cuando alguien paga en la ventanilla o
 *     corre el calculo de intereses, y cada importe ya dice a que fecha es (`actualizadoA`). Volver a
 *     pedirla al cambiar de pestana no trae nada nuevo, y cuesta una consulta a cada municipalidad;
 *   · **cada peticion lleva el token, y el portal todavia no lo refresca** (#35, fuera de alcance):
 *     la de despues de media hora en otra pestana puede contestar 401, y antes del issue 50 ese 401
 *     borraba la lista a mitad de la eleccion (`LaConsulta.unaVerdad.test.tsx`, AC3);
 *   · **quien decide volver a preguntar es la persona**, con «Reintentar la consulta», que es un
 *     `refetch` y no depende de nada de esto.
 *
 * De ahi:
 *
 *   · `staleTime: Infinity` — lo leido no caduca solo. Ni montar ni volver al paso 2 lo pide otra vez;
 *   · `gcTime: Infinity` — lo leido no se tira mientras la pagina viva. El recorrido lo lee en todos
 *     sus pasos (`ProveedorDelRecorrido`), no solo en el que lo pidio, y la cache del portal son tres
 *     lecturas. Y sin plazo no hay temporizador: con los cinco minutos por omision, desmontar el
 *     portal en una prueba dejaba un `setTimeout` vivo tras el entorno (`src/pruebas/portal.test.tsx`);
 *   · `refetchOnWindowFocus: false` y `refetchOnReconnect: false` — con `staleTime: Infinity` ya no
 *     pedirian (solo piden lo caducado), pero se escriben: si manana alguien baja el `staleTime` de
 *     una consulta, que el foco no vuelva a pedir sin que nadie lo haya decidido;
 *   · `retry: false` — como en `rentas`, y como ya decia cada gancho de `src/datos/fuente.ts`: un 401
 *     reintentado tres veces son tres 401. Se escribe aqui tambien para que una consulta nueva lo
 *     herede sin acordarse.
 *
 * Y lo que NO se cambia, a proposito: con un error en una consulta REPETIDA, React Query conserva
 * `data` —solo cambia `status` a `error`—. Lo que decide si eso se ve es la pantalla: `LaConsulta`
 * dibuja lo que hay antes que el error.
 *
 * Lo llaman `main.tsx` y `montarElPortal` (`src/pruebas/portal.tsx`), y nadie mas hace un
 * `new QueryClient` en `src/` (`src/datos/consultas.test.ts`): una prueba con otros valores estaria
 * midiendo otro portal.
 */
export function crearClienteDeConsultas(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
      },
    },
  });
}
