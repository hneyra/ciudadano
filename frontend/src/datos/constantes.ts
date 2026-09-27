import type { Fecha } from '@kamayuk/formato';

/**
 * **Lo del artboard que NO es dato de nadie, y por eso puede viajar en el paquete** (issue 58).
 *
 * Hasta el issue 58 vivia en `demostracion.ts`, junto al nombre, los documentos y los predios de unas
 * personas, y las pantallas lo importaban de alli: con cada una de esas importaciones, los datos de
 * la demostracion entraban enteros en el paquete de produccion. Se separa para que las pantallas
 * puedan seguir leyendolo sin alcanzar los datos.
 *
 * Nada de esto identifica a nadie: la municipalidad que cobra, la norma de la amnistia de la
 * demostracion y el dia al que estan calculados sus importes. Con plataforma la amnistia no se nombra
 * —el contrato no trae ninguna (issue 49)—, asi que la ordenanza viaja sin dibujarse.
 *
 * Que sigan siendo la copia literal del artboard lo mide `demostracion.test.ts`, como antes.
 */

/** La entidad que cobra. Artboard, linea 1042 (`entidad`). */
export const ENTIDAD = 'Municipalidad Distrital de Catacaos';

/** La norma de la amnistia que condona el interes. Artboard, lineas 177 y 1311. */
export const ORDENANZA = 'Ordenanza 012-2026-MPS';

/**
 * El dia al que esta calculada toda la deuda de la demostracion: «13 de setiembre de 2026»
 * (artboard, linea 1043) y la fecha del comprobante (1037). Es la `fechaCalculo` de cada `<Importe>`.
 */
export const FECHA_DE_CORTE: Fecha = '2026-09-13';
