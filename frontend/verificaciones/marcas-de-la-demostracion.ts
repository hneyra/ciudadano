import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  COMPROBANTE,
  CONTRIBUYENTE,
  DEUDAS,
  EJEMPLOS,
  HISTORIAL,
  MEDIOS,
  UNIDADES,
  USUARIO,
} from '../src/datos/demostracion.ts';
import { ejemploSeTraduce } from '../src/pasos/pagar/textosDeLosMedios.ts';

/**
 * **Las marcas de los datos del artboard: lo que no puede aparecer en el paquete de produccion**
 * (issue 58).
 *
 * Una marca es una cadena que solo existe porque alguien la copio de la demostracion: el nombre de
 * una persona, un documento, un correo, un numero de comprobante o de operacion, la direccion de un
 * predio, su ficha catastral, la placa de un vehiculo, el numero al que se yapea. Si una esta en el
 * paquete de produccion, los datos del artboard viajan con el portal que se instala en una
 * municipalidad —y con ellos, a quien se le pueden atribuir—.
 *
 * <h2>Sacadas del dato, no escritas aqui</h2>
 *
 * Una lista a mano se desvia en silencio: el dia que se cambie un nombre o se anada un pago, la guarda
 * seguiria buscando el viejo y saldria verde sin mirar nada. Asi que se leen de `demostracion.ts`
 * **por el campo**, no por el valor: cambiar el valor cambia la marca, y anadir una unidad anade las
 * suyas.
 *
 * Que campos, y por que esos: los que **dicen quien es alguien o donde esta algo suyo**. No entra el
 * texto que no identifica a nadie —«Impuesto predial 2026», «Por vencer», «Tarjeta»—, que el portal
 * con plataforma dice igual con los datos de la persona de verdad, y cuya presencia no afirma nada.
 *
 * <h2>Ocho caracteres o mas</h2>
 *
 * Por debajo, una cadena no distingue nada: «123» —el ejemplo del codigo de seguridad— esta en
 * cualquier paquete de JavaScript por mil motivos. Los documentos del artboard tienen ocho cifras
 * justas, y entran.
 */
const MINIMO = 8;

export function marcasDeLaDemostracion(): readonly string[] {
  const todas = [
    // Quien debe, y quien entra con la cuenta del artboard.
    CONTRIBUYENTE.nombre,
    CONTRIBUYENTE.codigo,
    CONTRIBUYENTE.numeroDeDocumento,
    USUARIO.nombre,
    USUARIO.codigo,
    USUARIO.numeroDeDocumento,
    USUARIO.correo,
    // Los ejemplos de los campos de documento: son el codigo y el DNI del contribuyente, y un RUC.
    ...Object.values(EJEMPLOS.busqueda),
    EJEMPLOS.cuenta,
    // Lo que sella el comprobante, y los comprobantes de los pagos anteriores.
    COMPROBANTE.numero,
    COMPROBANTE.operacion,
    ...HISTORIAL.map((pago) => pago.comprobante),
    // Donde esta lo suyo: las direcciones, las fichas catastrales, la placa.
    ...DEUDAS.map((deuda) => deuda.unidad),
    ...UNIDADES.flatMap((unidad) => [unidad.titulo, unidad.origen]),
    // A donde se paga y a nombre de quien: el numero para yapear, los codigos de pago y el nombre de
    // la tarjeta de ejemplo (el de la usuaria). Los ejemplos que son solo la forma de unas cifras
    // —«0000 0000 0000 0000»— no dicen de nadie: `ejemploSeTraduce` es quien los distingue.
    ...MEDIOS.flatMap((medio) => [
      ...(medio.codigo === undefined ? [] : [medio.codigo]),
      ...(medio.campos ?? []).map((campo) => campo.ejemplo).filter(ejemploSeTraduce),
    ]),
  ];
  return [...new Set(todas)].filter((marca) => marca.length >= MINIMO);
}

/** Los archivos de un paquete construido en los que se busca: todos menos los mapas. */
function archivosDe(dist: string, desde = dist): readonly string[] {
  return readdirSync(desde, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(desde, entrada.name);
    if (entrada.isDirectory()) return archivosDe(dist, ruta);
    // Sin los `.map`: llevan el codigo fuente ENTERO, comentarios incluidos, y un comentario puede
    // nombrar una marca para contar por que no viaja (`laFuente.ts` cita «Rufina Medina Medina»). La
    // imagen no los publica (`imagen/sin-mapas.sh`).
    return entrada.name.endsWith('.map') ? [] : [relative(dist, ruta)];
  });
}

/**
 * **En que archivos de un paquete construido aparece cada marca.** Lo usan los caminos del arnes que
 * construyen: `e2e/la-demostracion-no-viaja-al-bundle.spec.ts` y `e2e/el-dist-de-la-imagen-esta-limpio.spec.ts`.
 */
export function enQueArchivosEsta(dist: string): readonly { marca: string; archivos: readonly string[] }[] {
  const contenidos = archivosDe(dist).map((archivo) => ({ archivo, texto: readFileSync(join(dist, archivo), 'utf8') }));
  if (contenidos.length === 0) throw new Error(`«${dist}» no tiene ningun archivo: ¿se construyo?`);
  return marcasDeLaDemostracion().map((marca) => ({
    marca,
    archivos: contenidos.filter(({ texto }) => texto.includes(marca)).map(({ archivo }) => archivo),
  }));
}
