# CIU-0008 — Los topes de la suite: dos procesos y los plazos del portal dichos

- **Estado**: Aceptada (2026-09-23, issue 42 / PR #46)
- **Dónde vive**: `maxWorkers` de `frontend/vitest.config.ts`, `plazosDelPortal()`, `PLAZO_DEL_PORTAL`,
  `ESPERA_DEL_PORTAL` y `limpiarElPortal` de `frontend/src/pruebas/portal.tsx`; lo vigila
  `frontend/verificaciones/la-suite-tiene-tope.test.ts`

## Contexto

La máquina de desarrollo tiene 4 núcleos y es **compartida** (`k3s-server`, otras sesiones con sus
suites), así que la carga cambia sola. `yarn verificar` caía con 5-10 casos caducados cuando la máquina
estaba ocupada: cada vez otros, y en aislado pasaban. Rojo de la máquina, no del código. El tiempo de los
casos que montan el portal es CPU —jsdom dibujando el marco, la pantalla y Radix, y `getByRole`
recorriendo el árbol— y crece con la carga.

## Decisión

- **Dos procesos de prueba** (`maxWorkers: 2`), y no uno por núcleo menos uno (3). Se escribe como
  `maxWorkers` y no como tope de hilos: el `pool` es `forks`.
- **Los casos que montan el portal piden sus plazos** con `plazosDelPortal()` en el nivel superior de su
  archivo: 20 s el caso (y no los 5 de Vitest) y 5 s cada espera de Testing Library (y no 1). Son de
  TODOS los archivos que montan el portal y no solo de los que cayeron alguna vez, porque los rojos
  cambiaban de archivo.
- **`limpiarElPortal` desmonta antes de retirar los avisos** (revisión del PR #46).

## Consecuencias

- Un caso que se cuelga de verdad —un `findBy` que no llega nunca— tarda 5 s en salir rojo en vez de 1, y
  uno que no acaba, 20 en vez de 5.
- Para medir otro tope sin tocar la configuración: `VITEST_MAX_FORKS=<n>` o `--maxWorkers=<n>`.
  `VITEST_MAX_THREADS` no sirve: solo toca hilos.

## Qué se midió

El 2026-09-23, `yarn verificar` entero:

    procesos   carga      tiempo    resultado
    3          7.5        222 s     verde
    2          4.2        212 s     verde
    1          6.6        410 s     verde

Con la máquina libre, 2 cuesta lo mismo que 3 —la CPU ya estaba repartida— y 1 casi dobla el tiempo. El
tope solo no basta: con carga 15 puesta desde fuera, los casos que montan el portal caducaban igual con 2
que con 3 (10 y 7 rojos). Con `VITEST_MAX_THREADS=1` seguían corriendo 3 procesos.

**Los plazos, de una corrida EN VERDE con la máquina cargada**: `vitest run` entero con 2 procesos y 13
procesos `yes` encima (carga media 15.9, pico 20.8; 72 archivos, 791 de 791). Por archivo, el caso más
lento y la espera más larga: el peor caso, 7.1 s (`Historial.test.tsx`); la espera más larga, 1.8 s
(`aplicacion.sinPlataforma.test.tsx`). De las 327 esperas, 312 acabaron en medio segundo o menos (mediana
76 ms), y **4 pasaron del segundo** que Testing Library da por omisión (1.80, 1.39, 1.21 y 1.15 s). De ahí:

- **caso, 20 s** = 2.8 × 7.1 s. Tres archivos pasaban de los 5 s por omisión y otros diez quedaban entre
  2.5 y 5 s, sin margen;
- **espera, 5 s** = 2.8 × 1.8 s.

Por archivo, el caso más lento y la espera más larga (entre paréntesis, cuántas esperas hizo):

    caso   espera        archivo
    7.1 s  1.21 s (65)   src/pasos/historial/Historial.test.tsx
    5.5 s  1.80 s  (4)   src/aplicacion.sinPlataforma.test.tsx
    5.3 s  0.11 s  (1)   src/pasos/buscar/Buscar.tipo.test.tsx
    4.6 s  0.58 s (15)   src/pasos/historial/Historial.menu.test.tsx
    3.6 s  0.28 s  (5)   src/pasos/comprobante/Comprobante.sesion.test.tsx
    3.4 s  1.15 s (15)   src/pasos/historial/Historial.plataforma.test.tsx
    3.3 s  0.26 s (69)   src/pasos/comprobante/Comprobante.test.tsx
    3.3 s  0.68 s  (7)   src/pasos/deudas/Deudas.test.tsx
    3.2 s  0.75 s (19)   src/pasos/pagar/Pagar.test.tsx
    3.1 s  1.39 s (14)   src/pasos/buscar/Buscar.test.tsx
    3.0 s  0.99 s (23)   src/pasos/pagar/Pagar.plataforma.test.tsx
    2.8 s  0.16 s  (1)   src/pasos/pagar/Pagar.cuentas.test.tsx
    2.6 s  0.29 s  (6)   src/marco/Barra.test.tsx
    2.3 s  0.39 s (10)   src/enrutador.test.tsx
    2.3 s  0.41 s (22)   src/pasos/identificar/Identificar.test.tsx
    2.2 s  0.23 s  (1)   src/pasos/historial/Historial.cuentas.test.tsx
    2.2 s  0.23 s  (2)   src/pasos/comprobante/Comprobante.cuentas.test.tsx
    2.1 s     —    (0)   src/aplicacion.puerta.test.tsx
    2.0 s  0.25 s  (5)   src/arranque.plataforma.test.tsx
    1.9 s     —    (0)   src/pasos/deudas/Deudas.cuentas.test.tsx
    1.9 s     —    (0)   src/marco/impresionEnClaro.test.tsx
    1.9 s  0.41 s  (1)   src/pruebas/portal.test.tsx
    1.9 s     —    (0)   src/aplicacion.test.tsx
    1.8 s  0.17 s (13)   src/pasos/entrar/Entrar.test.tsx
    1.7 s  0.43 s  (4)   src/marco/FranjaDePasos.test.tsx
    1.5 s  0.60 s (22)   src/pasos/deudas/Deudas.plataforma.test.tsx
    1.2 s  0.28 s  (3)   src/marco/Barra.plataforma.test.tsx

`yarn verificar` entero, antes y después:

| | libre | cargada |
|---|---|---|
| antes (3 procesos, 5 s) | 222 s, carga 7.5, verde | 743 s, carga 15.1, **7 rojos** |
| después (2 procesos, plazos) | 207 s, carga 4.6, verde | 814 s, carga 13.7, verde; 925 s, carga 15.8, verde |
| después, con la revisión del PR #46 | 203 s, carga 3.6, rc=0 | 932 s, carga 15.6, rc=0 |

**Los avisos al limpiar**: al revés (retirar los avisos con el portal montado), `sonner` dejaba un
`setTimeout` de 200 ms que, si el archivo acababa antes, reventaba con «window is not defined» después del
desmontaje del entorno, y `yarn verificar` salía con rc=1 con todas las pruebas en verde.

## Qué se descartó

- **`poolOptions.threads.maxThreads`** o la variable `VITEST_MAX_THREADS`: parecen un tope y no lo son con
  `forks` (medido: 3 procesos con `=1`).
- **Solo el tope, sin plazos**: 10 rojos con 2 procesos y carga 15.
- **Cambiar `findBy` por `getBy`** para ganar tiempo: en los archivos medidos había 136 `findBy` y 101
  `waitFor`, sus esperas sumaron 45.9 s de 252.3 s de casos, y las que un `getBy` podría sustituir (las
  que contestan a la primera) sumaron 7.8 s repartidos por todos los archivos. Las largas esperan una
  navegación o una consulta de verdad. No hay tiempo que ganar ahí.
- **Anclar los 20 s en «8.7 s de `Comprobante.sesion`, carga 15»**, la primera versión: era lo que ese
  caso tardó en CADUCAR a 5 s en una corrida roja, no lo que necesita para pasar (3.6 s en la verde).
