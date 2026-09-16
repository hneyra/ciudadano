import type { Fecha } from '@kamayuk/formato';

import type {
  MunicipalidadDelContrato,
  ObligacionDelContrato,
  PredioDelContrato,
  SituacionDelContrato,
} from './contrato.ts';
import type {
  DeudaDelServidor,
  EstadoDeLaSituacion,
  MunicipalidadDelPortal,
  PredioDelPortal,
  QuienDebe,
  SaldosDeLaMunicipalidad,
  SituacionDelServidor,
} from './tipos.ts';

/**
 * **El adaptador de `GET /portal/situacion` al modelo del portal** (issue 26).
 *
 * Una funcion pura: entra la respuesta tal como la declara `contrato.ts`, sale lo que las pantallas
 * saben dibujar (`tipos.ts`). **No llama a la red** —eso es el issue 27—, no lee la hora, no
 * formatea y **no suma**: las cuentas son de `cuentas.ts`, que es el unico sitio del portal que
 * suma y lo hace con `sumarImportes`.
 *
 * <h2>Lo que hay que saber antes de leer una linea</h2>
 *
 * La respuesta del servidor **no tiene la forma del artboard**. Trae obligaciones por tributo y
 * ejercicio, cada importe con su fecha, y predios sin identificador; no trae cuotas, ni desglose de
 * servicios del arbitrio, ni estado ni vencimiento por concepto. Este archivo dice, campo por
 * campo, que se puede dibujar y que no, y **lo que no se puede sale `null`**.
 *
 * Y lo medido manda sobre el contrato: `diseno/medidas/situacion-2026-09-16.json` es la respuesta
 * real, con la rama que hoy contesta la plataforma (una municipalidad que no se pudo leer), y
 * `deLaSituacion.test.ts` la lee del disco.
 *
 * <h2>Las cuatro decisiones, y por que</h2>
 *
 * <h3>1. `concepto` = tributo en castellano + ejercicio</h3>
 *
 * «Impuesto predial 2026», como el artboard. Los tributos que el portal sabe nombrar son **tres**
 * ({@link EN_CASTELLANO}); el vocabulario del libro tiene doce, y los otros nueve salen **en
 * crudo** («MULTA_TRANSITO 2026»). Traducirlos a ojo seria escribir aqui el nombre legal de nueve
 * tributos que este portal no ha medido ni una vez; en crudo se lee raro, pero se lee **lo que es**
 * y el ciudadano ve la deuda en vez de no verla.
 *
 * <h3>2. `unidad`: el predio solo si se puede identificar</h3>
 *
 * La obligacion trae `predioId`, pero **el predio del contrato no trae `predioId`** (esta decidido
 * asi en el servidor: el identificador interno no se publica). Asi que casarlos es imposible salvo
 * en un caso, y solo en ese se hace: **cuando la municipalidad publica un unico predio**, una
 * obligacion con `predioId` es la de ese predio, porque no hay otro que pueda ser. Con dos o mas,
 * el portal **no adivina**: dice «Sin detalle del predio». Con `vehiculoId` no hay ni lista de
 * vehiculos que mirar, y sin ninguno de los dos la obligacion no cuelga de ninguna unidad.
 *
 * <h3>3. `reajuste` se **agrega al modelo**, no se suma a los gastos</h3>
 *
 * Las dos salidas que el issue plantea son sumarlo a `gastos` o darle sitio propio, y aqui se le da
 * sitio ({@link DeudaDelServidor.reajuste}). Sumarlo a `gastos` daria el total correcto y una
 * etiqueta falsa: «Gastos y costas» es lo que cuesta cobrar —emision, notificacion, costas—, y el
 * reajuste es la actualizacion del tributo por el indice de precios. Son cosas distintas en la ley
 * y en el recibo de la municipalidad, y la pantalla que las junte le estara diciendo al ciudadano
 * que le cobran de gastos algo que no son gastos.
 *
 * Lo que **no** se puede hacer es dejarlo fuera y ya: seria dinero que se debe y no se cobra. Por
 * eso el sitio propio viene acompanado de que `cuentas.ts` lo sume (`ConSaldo.reajuste`), y por eso
 * se guarda ademas `totalDelServidor`: la prueba compara lo que suma el portal con lo que sumo el
 * servidor para la misma obligacion, y si el reajuste se cayera por el camino, saldria roja.
 *
 * <h3>4. `cuotas`, `vence`, `estado`, `tono` y `detalle` llegan `null`</h3>
 *
 * Porque **el contrato no los trae**. El portal real no sabe el vencimiento: no hay cuota, no hay
 * fecha de vencimiento, no hay «Vencida» ni «En coactiva», y no hay desglose de los servicios del
 * arbitrio. Deducirlos —«si hay interes, esta vencida»— seria inventar un dato que el ciudadano
 * leeria como oficial. `tono` acompana a `estado` y cae con el: es el color de una palabra que no
 * tenemos.
 */

/** Los tributos que este portal sabe nombrar en castellano. Los demas van en crudo. */
const EN_CASTELLANO: Readonly<Record<string, string>> = {
  PREDIAL: 'Impuesto predial',
  ARBITRIO: 'Arbitrios municipales',
  VEHICULAR: 'Impuesto vehicular',
};

/** Lo que se dice de la unidad cuando el contrato no deja identificarla. */
const SIN_DETALLE = {
  predio: 'Sin detalle del predio',
  vehiculo: 'Sin detalle del vehículo',
  ninguna: 'Sin unidad asociada',
} as const;

/**
 * Lo que de `SIN_DETALLE` **escribe el portal y no el servidor**, para el inventario del locale
 * (issue 28).
 *
 * `unidad` es un campo mixto: unas veces es el predio de verdad —«Casa habitación · Calle Santa
 * Rosa 116», que es dato y no se traduce— y otras una de estas tres frases, que las redacta este
 * archivo. La pantalla las pasa por `t()` con una variable, asi que `i18next-cli` no las ve:
 * `verificaciones/el-locale-esta-completo.test.ts` las DERIVA de aqui, como las de los medios de
 * pago y las del historial.
 */
export function clavesDeLaUnidad(): readonly string[] {
  return Object.values(SIN_DETALLE);
}

/** El separador con que el artboard une tipo y direccion: «Casa habitación · Calle Santa Rosa 116». */
const PUNTO = ' · ';

/**
 * El nombre de un tributo mas su ejercicio: «Impuesto predial 2026».
 *
 * El ejercicio es un entero (una cuenta de anios, no una cifra de dinero) y se escribe con
 * `String`, no interpolado a ciegas: `tsc` con `restrict-template-expressions` no admite un numero
 * dentro de una plantilla.
 */
function conceptoDe(obligacion: ObligacionDelContrato): string {
  const nombre = EN_CASTELLANO[obligacion.tributo] ?? obligacion.tributo;
  return `${nombre} ${String(obligacion.ejercicio)}`;
}

/**
 * De que unidad es la obligacion, sin adivinar.
 *
 * El unico caso en que un `predioId` se puede casar con un predio es el de la municipalidad con un
 * solo predio: no hay otro que pueda ser. Con dos o mas, el contrato no publica el identificador
 * del predio y aqui no hay nada que comparar.
 */
function unidadDe(obligacion: ObligacionDelContrato, predios: readonly PredioDelContrato[]): string {
  if (obligacion.predioId !== null) {
    const unico = predios.length === 1 ? predios[0] : undefined;
    return unico === undefined ? SIN_DETALLE.predio : `${unico.tipo}${PUNTO}${unico.direccion}`;
  }
  if (obligacion.vehiculoId !== null) return SIN_DETALLE.vehiculo;
  return SIN_DETALLE.ninguna;
}

/**
 * El identificador con que el portal maneja una obligacion, **derivado y no del servidor**.
 *
 * El contrato no da ninguno —ni de la obligacion ni de la municipalidad—, y el recorrido necesita
 * uno: lo marcado, lo pagado y lo seleccionado cuelgan de el (`src/recorrido/recorrido.ts`). Se
 * compone con lo que identifica a la obligacion dentro de la respuesta: la municipalidad (`ubigeo`),
 * el tributo, el ejercicio y la unidad. Dos obligaciones distintas no pueden compartirlo, y la misma
 * obligacion lo tiene igual en dos lecturas seguidas, que es lo que hace que una marca sobreviva a
 * releer.
 */
function idDeLaObligacion(ubigeo: string, obligacion: ObligacionDelContrato): string {
  const unidad =
    obligacion.predioId !== null
      ? `predio-${String(obligacion.predioId)}`
      : obligacion.vehiculoId !== null
        ? `vehiculo-${String(obligacion.vehiculoId)}`
        : 'sin-unidad';
  return [ubigeo, obligacion.tributo.toLowerCase(), String(obligacion.ejercicio), unidad].join('-');
}

/** Una obligacion, ya como concepto del portal. */
function deudaDe(
  ubigeo: string,
  predios: readonly PredioDelContrato[],
  obligacion: ObligacionDelContrato,
): DeudaDelServidor {
  return {
    id: idDeLaObligacion(ubigeo, obligacion),
    concepto: conceptoDe(obligacion),
    unidad: unidadDe(obligacion, predios),
    insoluto: obligacion.insoluto.importe,
    reajuste: obligacion.reajuste.importe,
    interes: obligacion.interes.importe,
    // `gasto` en el contrato, `gastos` aqui: el modelo del portal lo llama asi desde el issue 3.
    gastos: obligacion.gasto.importe,
    actualizadoA: {
      insoluto: obligacion.insoluto.actualizadoA,
      reajuste: obligacion.reajuste.actualizadoA,
      interes: obligacion.interes.actualizadoA,
      gastos: obligacion.gasto.actualizadoA,
    },
    totalDelServidor: obligacion.total.importe,
    tributo: obligacion.tributo,
    ejercicio: obligacion.ejercicio,
    // Lo que el contrato no sabe. Ver la cabecera de este archivo, decision 4.
    cuotas: null,
    vence: null,
    estado: null,
    tono: null,
    detalle: null,
  };
}

/** Las cinco cifras del resumen, tal cual, con su fecha y con el nombre que usa el portal. */
function saldosDe(municipalidad: MunicipalidadDelContrato): SaldosDeLaMunicipalidad {
  const resumen = municipalidad.resumenDeSaldos;
  return {
    insoluto: resumen.insoluto,
    reajuste: resumen.reajuste,
    interes: resumen.interes,
    gastos: resumen.gasto,
    total: resumen.total,
    estadoDeLaConsulta: resumen.estadoDeLaConsulta,
  };
}

/** Un predio, con los nombres del portal y sin identificador que publicar. */
function predioDe(predio: PredioDelContrato): PredioDelPortal {
  return {
    codigoCatastral: predio.codigoReferenciaCatastral,
    tipo: predio.tipo,
    direccion: predio.direccion,
    porcentajeDeTitularidad: predio.porcentajeTitularidad,
  };
}

/** Una municipalidad entera: sus saldos, sus deudas y sus predios. */
function municipalidadDe(municipalidad: MunicipalidadDelContrato): MunicipalidadDelPortal {
  return {
    ubigeo: municipalidad.ubigeo,
    nombre: municipalidad.nombre,
    codigoDelContribuyente: municipalidad.codigoContribuyente,
    nombreDelContribuyente: municipalidad.nombreContribuyente,
    activo: municipalidad.activo,
    saldos: saldosDe(municipalidad),
    deudas: municipalidad.obligaciones.map((obligacion) =>
      deudaDe(municipalidad.ubigeo, municipalidad.predios, obligacion),
    ),
    predios: municipalidad.predios.map(predioDe),
  };
}

/**
 * En que situacion esta la consulta.
 *
 * **El orden de las preguntas es la decision**, y la primera es la que salva la respuesta medida:
 * alli `sinRegistros` es `true` **y** falto una municipalidad. Preguntando antes por `sinRegistros`
 * el portal diria «usted no figura en ninguna municipalidad», que es una afirmacion sobre el padron
 * que nadie ha podido comprobar; preguntando antes por el total que falta dice la verdad: no se
 * pudo consultar, y aqui esta el motivo que redacto el servidor.
 *
 * `totalConsolidado === null` basta para la rama fallida: el contrato lo empareja con
 * `notaDelTotal`, pero un total ausente ya es, por si solo, una consulta que no se completo. Sin
 * nota no habra texto que ensenar, y sigue siendo mejor que ensenar cero.
 */
function estadoDe(respuesta: SituacionDelContrato, deudas: readonly DeudaDelServidor[]): EstadoDeLaSituacion {
  if (respuesta.totalConsolidado === null) return 'no-se-pudo-consultar';
  if (respuesta.sinRegistros) return 'sin-registros';
  return deudas.length > 0 ? 'con-deuda' : 'sin-deuda';
}

/**
 * **La respuesta del servidor, como el portal la entiende.** Pura: la misma entrada da la misma
 * salida, y no toca nada de fuera.
 */
export function deLaSituacion(respuesta: SituacionDelContrato): SituacionDelServidor {
  const municipalidades = respuesta.municipalidades.map(municipalidadDe);
  const deudas = municipalidades.flatMap((municipalidad) => municipalidad.deudas);
  return {
    estado: estadoDe(respuesta, deudas),
    tipoDeDocumento: respuesta.tipoDocumento,
    numeroDeDocumento: respuesta.numeroDocumento,
    aLaFecha: respuesta.aLaFecha,
    municipalidadesRecorridas: respuesta.municipalidadesRecorridas,
    // Tal cual, con su fecha: el total del servidor no se recalcula ni se rellena con un cero.
    totalConsolidado: respuesta.totalConsolidado,
    notaDelTotal: respuesta.notaDelTotal,
    municipalidades,
    deudas,
  };
}

/**
 * **A nombre de quien esta la deuda que contesto el servidor** (issue 28).
 *
 * El contrato no trae un contribuyente unico: trae uno **por municipalidad**, cada una con su nombre
 * y su codigo de padron. Esta funcion decide, y decide poco a proposito:
 *
 * · el **nombre** es el de la primera municipalidad que contesto. Con varias suele ser el mismo
 *   —es la misma persona— y componer una lista de nombres para una cabecera que dice «Contribuyente»
 *   seria peor que ensenar uno;
 * · el **codigo** solo si TODAS dicen el mismo. Cada padron numera por su cuenta, y ensenar el de
 *   Catacaos como si fuera «su codigo» con dos municipalidades detras es decirle a alguien que
 *   busque en su recibo un numero que en la mitad de sus recibos no esta;
 * · el **documento** sale de la respuesta entera, que es donde vive: es el del token.
 */
export function quienDebeDe(situacion: SituacionDelServidor): QuienDebe {
  const municipalidades = situacion.municipalidades;
  const primera = municipalidades[0];
  const codigos = new Set(municipalidades.map((municipalidad) => municipalidad.codigoDelContribuyente));
  return {
    nombre: primera?.nombreDelContribuyente ?? '',
    codigo: codigos.size === 1 ? (primera?.codigoDelContribuyente ?? null) : null,
    documento: `${situacion.tipoDeDocumento} ${situacion.numeroDeDocumento}`,
  };
}

/**
 * La fecha con que se dibuja un importe de una deuda del servidor, para el `fechaCalculo` de
 * `<Importe>`.
 *
 * Existe para que ninguna pantalla tenga que acordarse de que la fecha de cada cifra es la suya:
 * se pide el campo y viene la del campo.
 */
export function fechaDelImporte(deuda: DeudaDelServidor, campo: keyof DeudaDelServidor['actualizadoA']): Fecha {
  return deuda.actualizadoA[campo];
}
