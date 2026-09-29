/**
 * **Los plazos de un caso que monta el portal entero** (issue 42): 20 s el caso, y no los 5 s de
 * Vitest; 5 s cada espera de Testing Library (`findBy…`, `waitFor`), y no 1 s.
 *
 * Los declara el proyecto `portal` de `vitest.config.ts` (issue 63): el del caso como su `testTimeout`,
 * y el de las esperas `src/pruebas/esperaDelPortal.ts`, su preparacion. Hasta el issue 63 cada archivo
 * los pedia con una llamada en su nivel superior. `verificaciones/la-suite-tiene-tope.test.ts` vigila
 * que todo archivo que monta el portal caiga en ese proyecto.
 *
 * Este modulo es una HOJA, sin un solo `import`: lo importa `vitest.config.ts`, que Vite empaqueta y
 * ejecuta en Node antes de que exista ningun entorno de pruebas, y `src/pruebas/portal.tsx` precarga
 * las pantallas con un `await` de nivel superior que alli no se puede correr.
 *
 * <h2>Por que hacen falta</h2>
 *
 * El tiempo de estos casos es CPU —jsdom dibujando el marco, la pantalla y Radix, y `getByRole`
 * recorriendo el arbol— y crece con la carga de la maquina, que es COMPARTIDA (`k3s-server` y otras
 * suites). Con carga 15 y los plazos por omision caian de 7 a 10 casos por corrida, cada vez otros, y en
 * aislado pasaban: rojo de la maquina, no del codigo. Y los rojos cambiaban de archivo, por eso el plazo
 * es de TODOS los que montan el portal y no solo de los que cayeron alguna vez.
 *
 * <h2>La medida: una corrida EN VERDE con la maquina cargada</h2>
 *
 * 2026-09-23, `vitest run` entero con 2 procesos, 13 procesos `yes` encima de lo que ya hubiera: carga
 * media 15.9, pico 20.8; 72 archivos, 791 de 791. Duracion por caso del reportero JSON, y cada espera
 * cronometrada envolviendo el `asyncWrapper` de Testing Library (instrumento de un rato, no confirmado).
 * Por archivo, el caso mas lento y la espera mas larga (entre parentesis, cuantas esperas hizo):
 *
 *     caso   espera        archivo
 *     7.1 s  1.21 s (65)   src/pasos/historial/Historial.test.tsx
 *     5.5 s  1.80 s  (4)   src/aplicacion.sinPlataforma.test.tsx
 *     5.3 s  0.11 s  (1)   src/pasos/buscar/Buscar.tipo.test.tsx
 *     4.6 s  0.58 s (15)   src/pasos/historial/Historial.menu.test.tsx
 *     3.6 s  0.28 s  (5)   src/pasos/comprobante/Comprobante.sesion.test.tsx
 *     3.4 s  1.15 s (15)   src/pasos/historial/Historial.plataforma.test.tsx
 *     3.3 s  0.26 s (69)   src/pasos/comprobante/Comprobante.test.tsx
 *     3.3 s  0.68 s  (7)   src/pasos/deudas/Deudas.test.tsx
 *     3.2 s  0.75 s (19)   src/pasos/pagar/Pagar.test.tsx
 *     3.1 s  1.39 s (14)   src/pasos/buscar/Buscar.test.tsx
 *     3.0 s  0.99 s (23)   src/pasos/pagar/Pagar.plataforma.test.tsx
 *     2.8 s  0.16 s  (1)   src/pasos/pagar/Pagar.cuentas.test.tsx
 *     2.6 s  0.29 s  (6)   src/marco/Barra.test.tsx
 *     2.3 s  0.39 s (10)   src/enrutador.test.tsx
 *     2.3 s  0.41 s (22)   src/pasos/identificar/Identificar.test.tsx
 *     2.2 s  0.23 s  (1)   src/pasos/historial/Historial.cuentas.test.tsx
 *     2.2 s  0.23 s  (2)   src/pasos/comprobante/Comprobante.cuentas.test.tsx
 *     2.1 s     —    (0)   src/aplicacion.puerta.test.tsx
 *     2.0 s  0.25 s  (5)   src/arranque.plataforma.test.tsx
 *     1.9 s     —    (0)   src/pasos/deudas/Deudas.cuentas.test.tsx
 *     1.9 s     —    (0)   src/marco/impresionEnClaro.test.tsx
 *     1.9 s  0.41 s  (1)   src/pruebas/portal.test.tsx
 *     1.9 s     —    (0)   src/aplicacion.test.tsx
 *     1.8 s  0.17 s (13)   src/pasos/entrar/Entrar.test.tsx
 *     1.7 s  0.43 s  (4)   src/marco/FranjaDePasos.test.tsx
 *     1.5 s  0.60 s (22)   src/pasos/deudas/Deudas.plataforma.test.tsx
 *     1.2 s  0.28 s  (3)   src/marco/Barra.plataforma.test.tsx
 *
 * De las 327 esperas, 312 acabaron en medio segundo o menos (mediana 76 ms), y **4 pasaron del segundo
 * que Testing Library da por omision** (1.80, 1.39, 1.21 y 1.15 s): esas cuatro, con el plazo de
 * siempre, habrian salido rojas en una corrida que por lo demas es verde.
 *
 * <h2>Y no es lentitud de como estan escritos</h2>
 *
 * Revisado lo que el issue pide mirar antes de subir un plazo. Ya escriben con `fireEvent` y no con
 * `userEvent` (lo que hacia pasar de 5 s al desplegable, `Buscar.test.tsx`). Y `findBy` donde bastaria
 * `getBy`: en estos 27 archivos hay 136 `findBy` y 101 `waitFor`; en la corrida de arriba sus esperas
 * sumaron 45.9 s de 252.3 s de casos, y las 189 que acabaron en 100 ms o menos —las unicas que un
 * `getBy` podria sustituir, porque contestan a la primera— sumaron 7.8 s, repartidos entre todos los
 * archivos. Las largas esperan una navegacion o una consulta de verdad, donde un `getBy` fallaria. No se
 * cambio ninguna: no hay tiempo que ganar ahi, y cada una dice «esto llega despues». Lo que si era lento
 * por como estaba escrito se arreglo en su archivo: `src/pasos/pantallas.test.tsx`.
 *
 * <h2>De ahi los dos numeros</h2>
 *
 * El mismo margen para los dos, algo menos de tres veces lo peor medido en verde:
 *
 *   · **caso, 20 s** = 2.8 × 7.1 s. Tres archivos pasan de los 5 s por omision (`Historial`,
 *     `aplicacion.sinPlataforma`, `Buscar.tipo`) y otros diez quedan entre 2.5 y 5 s, sin margen para
 *     una carga algo mayor que esta.
 *   · **espera, 5 s** = 2.8 × 1.8 s. Cuatro archivos tuvieron una espera de mas de 1 s (`sinPlataforma`,
 *     `Buscar`, `Historial`, `Historial.plataforma`).
 *
 * Lo que la tabla dice de los demas, sin recortarles el plazo (los rojos cambiaban de archivo): los
 * catorce archivos por debajo de 2.5 s NO necesitan el plazo del caso con esta carga —su peor caso cabe
 * dos veces en los 5 s—, y cuatro (`aplicacion.puerta`, `Deudas.cuentas`, `impresionEnClaro` y
 * `aplicacion.test`) no esperan nunca, asi que el plazo de las esperas no les cambia nada.
 *
 * El precio: un caso que se cuelga de verdad —un `findBy` que no llega nunca— tarda 5 s en salir rojo en
 * vez de 1, y uno que no acaba, 20 en vez de 5.
 *
 * Una cifra descartada: la primera version de este comentario anclaba los 20 s en «8.7 s de
 * `Comprobante.sesion`, carga 15». Era lo que ese caso tardo en CADUCAR a 5 s en una corrida roja, no lo
 * que necesita para pasar; en la corrida verde de arriba tardo 3.6 s.
 */
export const PLAZO_DEL_PORTAL = 20_000;
export const ESPERA_DEL_PORTAL = 5_000;
