import { z } from 'zod';

import { RespuestaQueNoEntiendo } from './respuestaQueNoEntiendo.ts';

/**
 * **La forma de `GET /rentas/api/v1/portal/situacion`, tal como el servidor la manda** (issue 26).
 *
 * Los nombres son los del JSON, sin traducir y sin reordenar: `gasto` en singular, `predioId` con
 * su `Id`, `resumenDeSaldos` entero. **Este archivo no es el modelo del portal** —ese es
 * `tipos.ts`— y por eso no se le parece: lo que hay aqui es lo que llega por el cable, y el puente
 * entre las dos formas, con sus decisiones escritas, es `deLaSituacion.ts`.
 *
 * <h2>De donde sale cada tipo</h2>
 *
 * De las clases Java que sirven la respuesta, leidas y no supuestas:
 * `rentas:backend/kamayuk-rentas-nucleo/src/main/java/kamayuk/rentas/nucleo/infraestructura/web/SituacionDelCiudadanoResource.java`
 * (la raiz, la municipalidad y el predio) y `ConsultaUnificadaResource.java` del mismo paquete (el
 * `ResumenDeSaldos` y la `ObligacionDeLaFicha`, que el portal **comparte** con la ficha 360 del
 * back-office: es lo que impide que la ventanilla y el portal digan cifras distintas el mismo dia).
 * La misma forma esta declarada en `rentas:docs/50-api/formas-de-la-api.json`, entrada
 * `GET /portal/situacion`.
 *
 * <h2>Ninguna cifra es `number`, y ninguna viaja sin su fecha</h2>
 *
 * Todo importe llega como {@link ImporteConFecha}: texto decimal mas el dia al que esta
 * actualizado. No es estilo del backend, es su regla 9 (RNF-075) vigilada por ArchUnit alli
 * —`TODA_CIFRA_DE_LA_WEB_LLEVA_SU_FECHA`— y la regla 1 de aqui. Enteros hay dos, y son cuentas de
 * cosas, no de dinero: `municipalidadesRecorridas` y `ejercicio`.
 *
 * <h2>Lo que el contrato NO trae, y hay que mirar antes de dibujar nada</h2>
 *
 * Ni cuotas, ni vencimiento, ni estado por concepto, ni desglose de servicios del arbitrio, ni
 * identificador del predio (los predios llegan **sin** `predioId`, asi que una obligacion no se
 * puede casar con el suyo). Lo que el portal hace con esos huecos lo decide `deLaSituacion.ts`, y
 * la regla es la misma en todos: **ausente es `null`, nunca un valor inventado**.
 *
 * <h2>Desde el issue 34, los tipos SALEN del esquema</h2>
 *
 * Cada tipo de abajo es `z.infer` de su esquema, no una declaracion aparte: una forma escrita dos
 * veces acaba diciendo dos cosas, y la que se desvia es la que nadie mira —el tipo dice `number` y
 * el esquema deja pasar texto, o al reves—. `contrato.test.ts` lo fija con `expectTypeOf`: un tipo
 * vuelto a escribir a mano que se aparte del esquema no compila.
 *
 * <h2>La frontera: `leerLaSituacion`, y la asimetria que decide</h2>
 *
 * Lo que llega por el cable es `unknown` hasta que pasa por {@link leerLaSituacion}. Los objetos son
 * `z.object` a secas —ni `.strict()` ni `.passthrough()`— y eso es una decision, no un descuido:
 *
 *   · **un campo DE MAS no rompe nada, y se descarta.** El backend tiene que poder crecer —un
 *     `cuotas` el dia que las publique, un `moneda`— sin tumbar al portal que ya esta desplegado.
 *     Con `.strict()` cualquier campo nuevo dejaria sin su deuda a todos los ciudadanos hasta
 *     redesplegar el portal. Y se DESCARTA en vez de pasar (`.passthrough()`) para que ninguna
 *     pantalla empiece a leer un campo que la frontera no conoce: lo que no se valido no sigue.
 *   · **un campo DE MENOS, o de otro tipo, si rompe**, con {@link RespuestaQueNoEntiendo}. Ahi el
 *     portal ya no sabe que esta leyendo: un importe que falta se dibujaria como un hueco que parece
 *     un cero, y un `ejercicio` en texto llegaria a una cuenta como si fuera numero. Esto es dinero de
 *     una persona: mejor decir «no pudimos leerlo» que ensenar una cifra equivocada.
 */

/**
 * La forma de un importe servido: **la que `@kamayuk/formato` sabe dibujar**, ni mas ni menos.
 *
 * Opcionalmente negativo, con cero, uno o dos decimales, punto decimal y sin separador de miles. Es
 * `IMPORTE_SERVIDO` de `formatearImporte` y de `sumarImportes`, que la libreria no exporta: se
 * repite aqui y `contrato.test.ts` mide, contra la libreria misma, que las dos aceptan lo mismo.
 *
 * Endurecer aqui no es mas exigente que hoy: cualquier otra forma ya revienta, solo que DESPUES,
 * al dibujarla, con un `Error` suelto en mitad de la pantalla. Y no se exigen dos decimales justos
 * porque el backend no los garantiza: `Dinero` sale por `toPlainString()` y su escala es la D-03a,
 * todavia abierta en `rentas`.
 */
const IMPORTE_SERVIDO = /^-?\d+(\.\d{1,2})?$/;

/** Una fecha ISO 8601 sin hora, `2026-09-16`: `FECHA_SERVIDA` de `formatearFecha`, por lo mismo. */
const FECHA_SERVIDA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El tipo de documento con que se pregunto, tal como lo trae el token.
 *
 * Son los seis del enumerado `rentas:kamayuk-rentas-dominio-compartido/.../TipoDocumento.java`. Se
 * declara cerrado —y no `string`— porque es un enumerado del servidor: si algun dia llegara un
 * septimo, el rojo tiene que salir aqui y no en la pantalla que lo pinte.
 */
export const ESQUEMA_DEL_TIPO_DE_DOCUMENTO = z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE', 'PARTIDA', 'OTRO']);
export type TipoDeDocumentoDelContrato = z.infer<typeof ESQUEMA_DEL_TIPO_DE_DOCUMENTO>;

/**
 * Un importe y el dia al que esta actualizado: `{"importe":"1842.60","actualizadoA":"2026-09-16"}`.
 *
 * **El importe viaja como texto, nunca como numero**, y la fecha nunca falta. Que sean un solo tipo
 * y no dos campos sueltos es lo que hace que no se separen por el camino: una cifra sin fecha es
 * una cifra que dentro de tres dias es otra.
 */
export const ESQUEMA_DEL_IMPORTE = z
  .object({
    importe: z.string().regex(IMPORTE_SERVIDO),
    actualizadoA: z.string().regex(FECHA_SERVIDA),
  })
  .readonly();
export type ImporteConFecha = z.infer<typeof ESQUEMA_DEL_IMPORTE>;

/**
 * El «Resumen de saldos» de una municipalidad: las cinco cifras **ya sumadas por el servidor** y la
 * frase que las explica.
 *
 * `estadoDeLaConsulta` la redacta el servidor (RNF-083) y tiene tres formas, escritas en
 * `rentas:kamayuk-rentas-nucleo/.../ConsultaUnificada.java:378-386`: «Sin deuda pendiente al
 * {fecha}», «1 obligacion con saldo al {fecha}» y «N obligaciones con saldo al {fecha}». El portal
 * la **muestra**, no la compone: dos interfaces que la compusieran acabarian escribiendo dos frases
 * distintas y una de las dos olvidaria la fecha.
 *
 * `gasto` va en **singular** y sin `s`: es el nombre del campo en el JSON.
 */
export const ESQUEMA_DEL_RESUMEN = z
  .object({
    insoluto: ESQUEMA_DEL_IMPORTE,
    reajuste: ESQUEMA_DEL_IMPORTE,
    interes: ESQUEMA_DEL_IMPORTE,
    gasto: ESQUEMA_DEL_IMPORTE,
    total: ESQUEMA_DEL_IMPORTE,
    estadoDeLaConsulta: z.string(),
  })
  .readonly();
export type ResumenDeSaldosDelContrato = z.infer<typeof ESQUEMA_DEL_RESUMEN>;

/**
 * Una obligacion con saldo: un tributo de un ejercicio, con sus cinco importes.
 *
 * `tributo` es texto y no un enumerado cerrado **a proposito**: el vocabulario del libro tiene doce
 * entradas (`rentas:kamayuk-rentas-cuentacorriente/.../TributoDelLibro.java`) y el portal solo sabe
 * nombrar tres. Cerrarlo aqui dejaria sin dibujar una deuda que el ciudadano si tiene.
 *
 * `ejercicio` es un **entero**: es una cuenta de años, no de dinero, y `2024.5` no es un ejercicio.
 *
 * `predioId` y `vehiculoId` son los identificadores internos de la unidad, y **son anulables**: una
 * obligacion puede no colgar de ninguna. Ojo: el predio del contrato llega SIN `predioId`, asi que
 * este numero no sirve para casarlos (ver {@link PredioDelContrato}).
 *
 * `total` es la suma que hizo el servidor para ESTA obligacion. El portal no la recompone.
 */
export const ESQUEMA_DE_LA_OBLIGACION = z
  .object({
    tributo: z.string(),
    ejercicio: z.number().int(),
    predioId: z.number().int().nullable(),
    vehiculoId: z.number().int().nullable(),
    insoluto: ESQUEMA_DEL_IMPORTE,
    reajuste: ESQUEMA_DEL_IMPORTE,
    interes: ESQUEMA_DEL_IMPORTE,
    gasto: ESQUEMA_DEL_IMPORTE,
    total: ESQUEMA_DEL_IMPORTE,
  })
  .readonly();
export type ObligacionDelContrato = z.infer<typeof ESQUEMA_DE_LA_OBLIGACION>;

/**
 * Un predio del que el consultado es titular.
 *
 * **Sin `predioId`**, y esta decidido asi en el servidor: el identificador interno no le sirve a
 * quien mira su propia ficha y publicarlo invitaria a usarlo como parametro de otra llamada. La
 * consecuencia para el portal es que una obligacion con `predioId` **no se puede casar** con su
 * predio; lo unico que los une hoy es que la municipalidad tenga uno solo.
 *
 * `porcentajeTitularidad` es **texto**, no numero, por la misma regla 1 que los importes.
 */
export const ESQUEMA_DEL_PREDIO = z
  .object({
    codigoReferenciaCatastral: z.string(),
    tipo: z.string(),
    direccion: z.string(),
    porcentajeTitularidad: z.string(),
  })
  .readonly();
export type PredioDelContrato = z.infer<typeof ESQUEMA_DEL_PREDIO>;

/**
 * La situacion en una municipalidad.
 *
 * `activo` es si sigue de alta en ese padron; cuando es `false` **la deuda se muestra igual**: la
 * deuda sobrevive a la baja, y ocultarla seria decirle que no debe nada.
 *
 * Ni la municipalidad ni el contribuyente traen identificador interno: la primera se nombra por
 * `ubigeo` y `nombre`; la persona, por el `codigoContribuyente` con el que ESA municipalidad la
 * identifica, que es el que figura en su recibo.
 */
export const ESQUEMA_DE_LA_MUNICIPALIDAD = z
  .object({
    ubigeo: z.string(),
    nombre: z.string(),
    codigoContribuyente: z.string(),
    nombreContribuyente: z.string(),
    activo: z.boolean(),
    resumenDeSaldos: ESQUEMA_DEL_RESUMEN,
    obligaciones: z.array(ESQUEMA_DE_LA_OBLIGACION).readonly(),
    predios: z.array(ESQUEMA_DEL_PREDIO).readonly(),
  })
  .readonly();
export type MunicipalidadDelContrato = z.infer<typeof ESQUEMA_DE_LA_MUNICIPALIDAD>;

/**
 * La respuesta entera de `GET /portal/situacion`.
 *
 * <h2>`totalConsolidado` y `notaDelTotal` van juntos, y por que importa</h2>
 *
 * `totalConsolidado` es `null` cuando alguna municipalidad no se pudo leer, y entonces
 * `notaDelTotal` dice cuales faltan. **No es cero**, y no se puede confundir con cero: un total al
 * que le falta una municipalidad es un importe plausible y equivocado. Esa es exactamente la rama
 * que trae la respuesta medida (`diseno/medidas/situacion-2026-09-16.json`).
 *
 * `aLaFecha` es la fecha de corte del recorrido **entero**, la misma para todas las
 * municipalidades: es lo que hace legitimo el total.
 *
 * `sinRegistros` dice si esta persona no figura en ninguna municipalidad del sistema, y
 * `municipalidadesRecorridas` es un **entero**, una cuenta de municipalidades.
 */
export const ESQUEMA_DE_LA_SITUACION = z
  .object({
    tipoDocumento: ESQUEMA_DEL_TIPO_DE_DOCUMENTO,
    numeroDocumento: z.string(),
    aLaFecha: z.string().regex(FECHA_SERVIDA),
    municipalidadesRecorridas: z.number().int(),
    totalConsolidado: ESQUEMA_DEL_IMPORTE.nullable(),
    notaDelTotal: z.string().nullable(),
    sinRegistros: z.boolean(),
    municipalidades: z.array(ESQUEMA_DE_LA_MUNICIPALIDAD).readonly(),
  })
  .readonly();
export type SituacionDelContrato = z.infer<typeof ESQUEMA_DE_LA_SITUACION>;

/**
 * La ruta de la que llega esta forma, relativa al prefijo del cliente (`/rentas/api/v1`). Escrita
 * UNA vez, y aqui: la pide `fuenteDeLaPlataforma.ts` (que la reexporta) y la nombra el error de la
 * frontera. Vive en el contrato y no en la fuente porque la fuente ya importa el contrato, y al reves
 * seria un ciclo.
 */
export const RUTA_DE_LA_SITUACION = '/portal/situacion';

/**
 * **La frontera**: de lo que llego por el cable a una {@link SituacionDelContrato}, o un fallo con
 * nombre.
 *
 * Recibe `unknown` a proposito, y no un `SituacionDelContrato` «que se supone»: lo que devuelve el
 * cliente HTTP es JSON sin comprobar, y tiparlo antes de mirarlo es justo la confianza que este
 * issue quita. Devuelve lo que `zod` dejo pasar —sin los campos de mas, ver la cabecera— y no la
 * entrada, para que lo que sigue adelante sea exactamente lo validado.
 *
 * @throws RespuestaQueNoEntiendo si falta un campo o uno llega con otro tipo o forma.
 */
export function leerLaSituacion(desconocido: unknown): SituacionDelContrato {
  const leida = ESQUEMA_DE_LA_SITUACION.safeParse(desconocido);
  if (!leida.success) throw new RespuestaQueNoEntiendo(`GET ${RUTA_DE_LA_SITUACION}`, leida.error.issues);
  return leida.data;
}
