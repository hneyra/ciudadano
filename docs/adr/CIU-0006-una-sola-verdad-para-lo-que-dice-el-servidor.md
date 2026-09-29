# CIU-0006 — Una sola verdad para lo que dice el servidor: la cache de consultas, con su política

- **Estado**: Aceptada (2026-09-24, issue 50 / PR #54)
- **Dónde vive**: `frontend/src/datos/consultas.ts` (`crearClienteDeConsultas`), `frontend/src/recorrido/recorrido.ts`
  (`DecisionesDelRecorrido` y `DatosLeidos`), `frontend/src/recorrido/ProveedorDelRecorrido.tsx` y
  `frontend/src/pasos/deudas/LaConsulta.tsx`

## Contexto

Con plataforma, los conceptos que se marcan, se pagan y se sellan los trae `GET /portal/situacion`. Entre
los issues 28 y 50 esa lista vivía **dentro del estado del reductor**: un `useEffect` de `LaConsulta` la
copiaba de la cache de React Query con la acción `situacionLeida`. Dos copias del mismo dato del servidor
daban tres defectos:

1. un dibujo con la respuesta ya llegada y la lista todavía vacía —con «No le queda nada por pagar» o un
   instante en blanco—;
2. una consulta repetida que volvía a marcarlo todo;
3. un error en una consulta repetida (un 401 tras media hora en otra pestaña) que borraba la lista a
   mitad de la elección.

Y `main.tsx` hacía `new QueryClient()` a secas: los valores por omisión de React Query son los de una
aplicación que lee datos que cambian solos (`staleTime: 0`, volver a pedir al montar, al recuperar el
foco y al volver la red).

## Decisión

- **La cache de React Query es la única verdad** de lo que manda el servidor. El estado del recorrido se
  parte en dos: `DecisionesDelRecorrido` (lo que decide la persona: el paso, lo marcado por id, lo
  pagado, lo sellado), lo ÚNICO que guarda el reductor montado; y `DatosLeidos` (los conceptos y a
  nombre de quién están), que el proveedor pone al lado de las decisiones **en cada dibujo**
  (`useLaSituacionSinPedir` + `datosDeLaSituacion`) y que viajan con cada acción. `EstadoDelRecorrido` es
  la suma, y el reductor sigue siendo puro sobre ella.
- Lo marcado se guarda por id **con omisión** (`estaMarcada`: marcado con plataforma), así que una
  respuesta distinta se reconcilia sola. El sello guarda los **conceptos** y el contribuyente de ese
  momento, no ids que cuelguen de una lista que puede cambiar.
- Con deuda ya leída, un error en una consulta repetida **no** borra la lista: `LaConsulta` pregunta por
  la deuda antes que por el error (React Query conserva `data` y solo cambia `status`).
- **La política del cliente, escrita** en `crearClienteDeConsultas()`, que usan `montaje.tsx` y
  `montarElPortal` y nadie más: `staleTime` y `gcTime` infinitos, `refetchOnWindowFocus` y
  `refetchOnReconnect` en `false`, y `retry: false`. Volver a preguntar lo decide la persona, con
  «Reintentar la consulta».

## Consecuencias

- En el mismo dibujo en que llega la respuesta, la lista ya está.
- `montarElPortal({ estado })` solo acepta decisiones (`DecisionesDePartida`): sembrar `deudas` no compila
  (revisión del PR #54; con `Partial<EstadoDelRecorrido>` compilaba y el proveedor lo tiraba en silencio).
- Sin `gcTime` no hay temporizador: con los cinco minutos por omisión, desmontar el portal en una prueba
  dejaba un `setTimeout` vivo tras el entorno.
- Fuera: refrescar el token a mitad de sesión (fuera del alcance del issue 35).

## Qué se midió

- `LaConsulta.unaVerdad.test.tsx`, con una sonda (`MutationObserver`) que anota lo que dice `main` tras
  cada commit: sobre `main` antes del arreglo, «+ "(sin titulo) · 0 casillas"» (el dibujo en blanco);
  antes del issue 49, «+ "No le queda nada por pagar · 0 casillas"»; con la copia por efecto, «+ "Lo que
  debe, por concepto · 0 casillas"».
- Con el cliente por omisión, recuperar el foco volvía a pedir: «expected 2 to be 1».
- Sin `gcTime`: «temporizadores programados al limpiar el portal: expected [ 300000 ] to deeply equal []».

## Qué se descartó

- **Copiar la respuesta al estado** con un efecto (la situación de los issues 28-50): son los tres
  defectos de arriba.
- **El cliente de consultas por omisión**: la deuda no cambia sola mientras se mira —cambia cuando alguien
  paga en la ventanilla o corre el cálculo de intereses—, y cada importe ya dice a qué fecha es. Volver a
  pedirla al cambiar de pestaña no trae nada nuevo y cuesta una consulta a cada municipalidad; y un 401
  reintentado tres veces son tres 401.
