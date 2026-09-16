import type { Fecha, Importe } from '@kamayuk/formato';

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
 */

/**
 * El tipo de documento con que se pregunto, tal como lo trae el token.
 *
 * Son los seis del enumerado `rentas:kamayuk-rentas-dominio-compartido/.../TipoDocumento.java`. Se
 * declara cerrado —y no `string`— porque es un enumerado del servidor: si algun dia llegara un
 * septimo, el rojo tiene que salir aqui y no en la pantalla que lo pinte.
 */
export type TipoDeDocumentoDelContrato = 'DNI' | 'RUC' | 'CE' | 'PASAPORTE' | 'PARTIDA' | 'OTRO';

/**
 * Un importe y el dia al que esta actualizado: `{"importe":"1842.60","actualizadoA":"2026-09-16"}`.
 *
 * **El importe viaja como texto, nunca como numero**, y la fecha nunca falta. Que sean un solo tipo
 * y no dos campos sueltos es lo que hace que no se separen por el camino: una cifra sin fecha es
 * una cifra que dentro de tres dias es otra.
 */
export interface ImporteConFecha {
  readonly importe: Importe;
  readonly actualizadoA: Fecha;
}

/**
 * El «Resumen de saldos» de una municipalidad: las cinco cifras **ya sumadas por el servidor** y la
 * frase que las explica.
 *
 * `estadoDeLaConsulta` la redacta el servidor (RNF-083) y tiene tres formas, escritas en
 * `rentas:kamayuk-rentas-nucleo/.../ConsultaUnificada.java:378-386`: «Sin deuda pendiente al
 * {fecha}», «1 obligacion con saldo al {fecha}» y «N obligaciones con saldo al {fecha}». El portal
 * la **muestra**, no la compone: dos interfaces que la compusieran acabarian escribiendo dos frases
 * distintas y una de las dos olvidaria la fecha.
 */
export interface ResumenDeSaldosDelContrato {
  readonly insoluto: ImporteConFecha;
  readonly reajuste: ImporteConFecha;
  readonly interes: ImporteConFecha;
  /** En **singular** y sin `s`: es el nombre del campo en el JSON. */
  readonly gasto: ImporteConFecha;
  readonly total: ImporteConFecha;
  readonly estadoDeLaConsulta: string;
}

/**
 * Una obligacion con saldo: un tributo de un ejercicio, con sus cinco importes.
 *
 * `tributo` es texto y no un enumerado cerrado **a proposito**: el vocabulario del libro tiene doce
 * entradas (`rentas:kamayuk-rentas-cuentacorriente/.../TributoDelLibro.java`) y el portal solo sabe
 * nombrar tres. Cerrarlo aqui dejaria sin dibujar una deuda que el ciudadano si tiene.
 *
 * `predioId` y `vehiculoId` son los identificadores internos de la unidad, y **son anulables**: una
 * obligacion puede no colgar de ninguna. Ojo: el predio del contrato llega SIN `predioId`, asi que
 * este numero no sirve para casarlos (ver {@link PredioDelContrato}).
 */
export interface ObligacionDelContrato {
  readonly tributo: string;
  readonly ejercicio: number;
  readonly predioId: number | null;
  readonly vehiculoId: number | null;
  readonly insoluto: ImporteConFecha;
  readonly reajuste: ImporteConFecha;
  readonly interes: ImporteConFecha;
  readonly gasto: ImporteConFecha;
  /** La suma que hizo el servidor para ESTA obligacion. El portal no la recompone. */
  readonly total: ImporteConFecha;
}

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
export interface PredioDelContrato {
  readonly codigoReferenciaCatastral: string;
  readonly tipo: string;
  readonly direccion: string;
  readonly porcentajeTitularidad: string;
}

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
export interface MunicipalidadDelContrato {
  readonly ubigeo: string;
  readonly nombre: string;
  readonly codigoContribuyente: string;
  readonly nombreContribuyente: string;
  readonly activo: boolean;
  readonly resumenDeSaldos: ResumenDeSaldosDelContrato;
  readonly obligaciones: readonly ObligacionDelContrato[];
  readonly predios: readonly PredioDelContrato[];
}

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
 */
export interface SituacionDelContrato {
  readonly tipoDocumento: TipoDeDocumentoDelContrato;
  readonly numeroDocumento: string;
  readonly aLaFecha: Fecha;
  readonly municipalidadesRecorridas: number;
  readonly totalConsolidado: ImporteConFecha | null;
  readonly notaDelTotal: string | null;
  /** Si esta persona no figura en ninguna municipalidad del sistema. */
  readonly sinRegistros: boolean;
  readonly municipalidades: readonly MunicipalidadDelContrato[];
}
