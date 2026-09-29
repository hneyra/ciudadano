# CIU-0002 — El recorrido es una máquina de estados, y la URL la sigue con una sola regla

- **Estado**: Aceptada (2026-09-27, issue 61 / PR #72; ampliada en el issue 74 / PR #76)
- **Dónde vive**: `frontend/src/recorrido/recorrido.ts` (el reductor), `frontend/src/recorrido/rutas.ts`
  (`useLaUrlYElPaso`) y `frontend/src/montaje.tsx` (el enrutador, creado después del canje)

## Contexto

El recorrido del portal —buscar o entrar, elegir qué pago, «Mis datos», pagar, el comprobante— vive en
un reductor puro desde el issue 4 (el `state` del artboard, sin React). Hasta el issue 61 era una
máquina de estados **sin decirlo**:

- Las pantallas despachaban `irA` con el destino ya decidido: **13 despachos en 8 archivos** sobre
  `main` (`59837745`) —la barra de pago escogía entre «Mis datos» y pagar, el resumen entre buscar y
  elegir, la marca entre el historial y el primer paso—, y el reductor lo aceptaba sin preguntar.
- Lo alcanzable se medía por la posición ACTUAL (`i <= actual`, la regla de la franja del artboard):
  tras «Iniciar sesión» sin haber buscado, «Mis datos» es el paso 3 y la franja daba por hechos el 1 y
  el 2; y volver atrás dejaba fuera lo recién recorrido, así que Adelante no llevaba a ninguna parte.
- La sincronía entre la URL y el paso vivía en dos sitios, cada uno con su `useRef` (el efecto de
  `rutas.ts` y el de cada ruta en `enrutador.tsx`). Si lo alcanzable cambiaba sin que cambiaran ni el
  paso ni la URL, nadie redirigía y la pantalla se quedaba en blanco (el comprobante sin sello).

## Decisión

- **Cada transición es una acción con nombre** que dice lo que la persona hizo (`buscar`,
  `confirmarEleccion`, `continuarConCorreo`, `entrar`, `confirmarPago`, `volverAElegir`, `irAlInicio`,
  `noSoyYo`, `identificarse`, `pagarLoPendiente`, `verMisPagos`, `verElComprobante`, `consultarOtra`,
  `cerrarSesion`), y **el destino lo decide el reductor**, con la guarda de lo que el destino exige y
  solo desde su paso.
- **`irA` es la navegación libre**, y solo eso: abrir un paso ya alcanzado desde la franja o porque la
  URL lo nombra. Hacia uno que no lo es, no hace nada.
- **El progreso vive en `alcanzado`** (`abierto`/`hecho` por paso). De ahí salen `pasoAlcanzable` y
  `pasoHecho`; lo actualiza cada transición y volver atrás no lo toca.
- **La URL y el paso, en un solo gancho** (`useLaUrlYElPaso`), con una regla: **manda lo que cambió**.
  Si cambió el paso, la URL lo sigue con una entrada nueva; si no, manda la URL si nombra un paso
  alcanzable, y si no se reemplaza por `ultimoAlcanzable`. Se comprueba en cada dibujo.
- La URL que se compara es **la del navegador**, no la del último dibujo; el efecto lo despierta
  también una cuenta de `popstate` (`useMovimientosDelNavegador`, issue 74); y **seguir a la URL no es
  una acción**: el `irA` de la regla 2 se apunta como visto al despacharlo.
- El enrutador se crea en `montar()`, **después** del canje con el emisor (revisión del PR #72).

## Consecuencias

- Ninguna pantalla decide un paso: lo vigila `frontend/verificaciones/ninguna-pantalla-decide-el-paso.test.ts`
  (despachos de `irA` fuera de la navegación libre, y navegar por URL fuera de `rutas.ts`).
- Sin librerías de máquinas de estados (XState): el reductor ya era la máquina; faltaba que las
  transiciones fueran suyas. Sigue siendo puro y se prueba llamándolo.
- Mientras una transición del enrutador está pendiente, el efecto puede pedir la misma redirección con
  `replace` dos veces: es idempotente y no hay bucle.

## Qué se midió

- **El clic antes de la transición.** El enrutador cambia la historia en el acto pero avisa a React
  dentro de `startTransition`: con «Mis datos» → «Continuar al pago» → la franja otra vez en «Mis datos»
  (`Identificar.test.tsx`, con la máquina cargada), el efecto veía `/identificar` —la ruta del dibujo—
  con el navegador ya en `#/pagar`, y cuando la transición llegaba la URL «mandaba» y devolvía el
  recorrido a pagar («expected '#/pagar' to be '#/identificar'», 3 de 3). De ahí leer la ruta del
  navegador.
- **La URL cambiada a espaldas del enrutador.** La vuelta del emisor limpia la barra con
  `history.replaceState`: el navegador quedaba en `#/entrar` y el enrutador en `/`, y `main` vacío
  (arnés, «cancelar en el formulario»). De ahí ponerlo al día reemplazando; y, desde la revisión del
  PR #72, crear el enrutador después del canje, con lo que ese caso ya no llega al gancho (9 de 9 en
  verde sin la línea de puesta al día).
- **Atrás en medio de la transición** (issue 74). En Chromium con la CPU x6, Atrás llegaba antes de que
  se dibujara la transición a «Pagar»; React volvía a dibujar la MISMA ruta, el efecto no corría, y la
  franja quedaba en «Pagar» con la URL en «Mis datos» —14 s después, y para siempre—. De ahí la cuenta
  de `popstate`. `rutas.transicion.test.tsx` lo reproduce sin carga con la pantalla de «Pagar»
  suspendida; `rutas.carrera.test.tsx`, la URL que cambia al despachar el `irA`.

## Qué se descartó

- **`replace` al seguir un paso**: Atrás no podría deshacer una acción.
- **Apuntar el paso visto al dibujarse** y no al despachar: la regla 1 tomaría por acción el paso que
  pidió la URL y empujaría su ruta encima de la que la persona acababa de poner.
- **La franja por posición** (`i <= actual`), la regla del artboard: da por hechos pasos no dados.
