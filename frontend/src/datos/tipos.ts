import type { Fecha, Importe, Tono } from '@kamayuk/formato';

import type { ImporteConFecha, TipoDeDocumentoDelContrato } from './contrato.ts';

/**
 * **Los tipos del dominio del portal**, con la forma que dibuja el artboard
 * (`diseno/Ciudadano.dc.html`, lineas 740-924) y los nombres de este repositorio.
 *
 * <h2>Lo que cambia respecto del artboard, y por que</h2>
 *
 * · **Los importes son `Importe` (texto decimal), no `number`.** En el prototipo `insoluto: 293.72`
 *   es un numero y se suma con `+=`; aqui es `'293.72'` y se suma con `sumarImportes`
 *   (`cuentas.ts`). Regla 1: en coma flotante el centimo se pierde antes de llegar a la pantalla.
 * · **Las fechas que el dominio usa como fecha son `Fecha` (ISO sin hora).** Las que el artboard
 *   escribe DENTRO de un texto o de una celda de la tabla de detalle («30/09/2026» en la columna
 *   «Vence») siguen siendo texto: son lo que la tabla pinta, no un dato con el que se opere.
 * · **Las tuplas del prototipo tienen nombre.** `['Importe S/', 1]` es `{ rotulo, cifra: true }`;
 *   `['BCP', 'Banca por internet, app y agentes']`, `{ nombre, canales }`. Un indice no dice que
 *   guarda, y un `1` que significa «alinear a la derecha» se confunde con una cantidad.
 * · **Todo es `readonly`.** Son datos de demostracion compartidos por todas las pantallas: una que
 *   los mutara cambiaria lo que ven las demas.
 */

/**
 * El tono de una insignia. **Es el mismo tipo que declara `Insignia` de `@kamayuk/ui`** para su
 * `tono` (lo importa de `@kamayuk/formato`), y se toma de ahi y no de `@kamayuk/ui` para que
 * `cuentas.ts` y `demostracion.ts` no arrastren React. Que siguen siendo el mismo lo comprueba el
 * compilador en `cuentas.test.ts`.
 */
export type TonoDeInsignia = Tono;

/** Una columna de la tabla de detalle: su rotulo y si lleva cifras (alineada a la derecha). */
export interface ColumnaDeDetalle {
  readonly rotulo: string;
  readonly cifra: boolean;
}

/** El desglose de un concepto: lo que el ciudadano abre con «Ver el detalle». */
export interface TablaDeDetalle {
  readonly titulo: string;
  /** El `min-width` de la tabla, tal cual lo escribe el artboard: `'580px'`. */
  readonly anchoMinimo: string;
  readonly columnas: readonly ColumnaDeDetalle[];
  /** Las celdas, como texto y como las pinta el artboard (con su separador de miles). */
  readonly filas: readonly (readonly string[])[];
  /** El indice de la columna cuyas celdas se pintan como insignia, si alguna. */
  readonly columnaDeInsignia?: number;
  readonly nota: string;
}

/** Un concepto de deuda del contribuyente. */
export interface Deuda {
  readonly id: string;
  readonly concepto: string;
  readonly unidad: string;
  readonly cuotas: string;
  readonly vence: string;
  readonly insoluto: Importe;
  readonly interes: Importe;
  readonly gastos: Importe;
  /** «Por vencer», «Vencida», «En coactiva»: el texto de la insignia. */
  readonly estado: string;
  readonly tono: TonoDeInsignia;
  readonly detalle: TablaDeDetalle;
}

/** Un campo del formulario de un medio de pago (hoy solo los tiene la tarjeta). */
export interface CampoDelMedio {
  readonly clave: string;
  readonly etiqueta: string;
  /** El texto de ejemplo del campo (`placeholder`). */
  readonly ejemplo: string;
  /** `2` ocupa la fila entera; `1`, la mitad. */
  readonly ancho: 1 | 2;
  readonly ayuda?: string;
}

/** Un banco donde se paga con el codigo, y por que canales. */
export interface BancoDelCodigo {
  readonly nombre: string;
  readonly canales: string;
}

/** Un medio de pago del paso 4. */
export interface MedioDePago {
  readonly id: 'tarjeta' | 'yape' | 'pagalo' | 'banco';
  readonly rotulo: string;
  readonly nota: string;
  /** Los trazados (`d`) del icono, en el orden en que el artboard los dibuja. */
  readonly icono: readonly string[];
  readonly titulo: string;
  readonly detalleNota: string;
  readonly campos?: readonly CampoDelMedio[];
  readonly codigoEtiqueta?: string;
  readonly codigo?: string;
  readonly codigoNota?: string;
  /** Con `{{TOTAL}}` donde va el importe: lo sustituye `pasosConTotal`. */
  readonly pasos?: readonly string[];
  readonly bancos?: readonly BancoDelCodigo[];
  readonly aviso: string;
  readonly boton: string;
}

/** Un pago ya hecho, en «Mis pagos». */
export interface PagoDelHistorial {
  readonly fecha: Fecha;
  readonly concepto: string;
  readonly medio: string;
  readonly comprobante: string;
  readonly importe: Importe;
}

/** Un predio o vehiculo del contribuyente, en «Mis predios y vehiculos». */
export interface Unidad {
  readonly titulo: string;
  readonly detalle: string;
  /** «Autovalúo 2026», «Base imponible»: de que es la cifra. */
  readonly baseEtiqueta: string;
  readonly base: Importe;
  readonly datos: readonly string[];
  readonly origen: string;
}

/** A nombre de quien esta la deuda que se busco. */
export interface Contribuyente {
  readonly nombre: string;
  readonly codigo: string;
  readonly tipoDeDocumento: string;
  readonly numeroDeDocumento: string;
  readonly predios: number;
  readonly vehiculos: number;
}

/**
 * **A nombre de quien esta la deuda del recorrido** (issue 28).
 *
 * Lo poco de `Contribuyente` que las dos formas de leer saben decir. En demostracion sale del
 * artboard; con plataforma, de `GET /portal/situacion` (`quienDebeDe`, en `deLaSituacion.ts`). Vive
 * en el estado del recorrido porque el comprobante lo sella en papel: con `CONTRIBUYENTE` escrito en
 * la pantalla, un recibo de un pago hecho con plataforma llevaria el nombre y el codigo de OTRA
 * persona.
 *
 * `codigo` y `documento` son anulables porque puede no haberlos: el codigo lo pone cada
 * municipalidad, y con varias detras no hay uno solo que valga.
 */
export interface QuienDebe {
  readonly nombre: string;
  readonly codigo: string | null;
  /** «DNI 03593174», ya compuesto. `null` si no se sabe con que documento. */
  readonly documento: string | null;
}

/** La persona que entra con su cuenta (no tiene por que ser el contribuyente). */
export interface Usuario {
  readonly iniciales: string;
  readonly nombre: string;
  readonly tipoDeDocumento: string;
  readonly numeroDeDocumento: string;
  /** El codigo de contribuyente al que esta afiliada la cuenta. */
  readonly codigo: string;
  readonly correo: string;
}

/** Lo que devuelve buscar una deuda: de quien es y que conceptos siguen pendientes. */
export interface Situacion {
  readonly contribuyente: Contribuyente;
  readonly deudas: readonly Deuda[];
}

/** Los numeros que sella el comprobante de demostracion. */
export interface ComprobanteDeDemostracion {
  readonly numero: string;
  readonly operacion: string;
  readonly fecha: Fecha;
  readonly hora: string;
}

/**
 * <h1>Lo mismo, cuando quien lo cuenta es el servidor (issue 26)</h1>
 *
 * De aqui para abajo esta el modelo del portal **para los datos de `GET /portal/situacion`**. No
 * sustituye a lo de arriba: lo de arriba es lo que dibuja el artboard —con cuotas, vencimiento,
 * estado y desglose— y esto es lo que el servidor **sabe de verdad**, que es menos. El puente, con
 * sus decisiones campo a campo, es `deLaSituacion.ts`; la forma que llega por el cable, `contrato.ts`.
 *
 * La regla que gobierna todo lo de abajo: **lo que el contrato no da llega `null`**. Ni una cuota
 * supuesta, ni un vencimiento a fin de mes, ni un estado deducido del interes.
 */

/**
 * En que situacion esta la consulta, como tipo cerrado, para que las pantallas la dibujen (issue 15).
 *
 * · `con-deuda`: hay obligaciones con saldo.
 * · `sin-deuda`: se leyo todo y no hay ninguna.
 * · `no-se-pudo-consultar`: **falto alguna municipalidad**, asi que no hay total; lo que se
 *   ensena es la nota del servidor. Es la rama de la respuesta medida.
 * · `sin-registros`: la persona no figura en ninguna municipalidad del sistema.
 *
 * Son cuatro y cerrados a proposito: un `string` dejaria que cada pantalla inventara el suyo, y el
 * dia que el servidor traiga una quinta rama el rojo tiene que salir en el adaptador.
 */
export type EstadoDeLaSituacion = 'con-deuda' | 'sin-deuda' | 'no-se-pudo-consultar' | 'sin-registros';

/**
 * El dia al que esta actualizado cada componente del saldo de una deuda.
 *
 * Viaja aparte y no pegado a cada cifra porque las cuentas del portal (`cuentas.ts`) suman importes
 * de texto, no pares. **La fecha no se pierde**: es la que cada `<Importe>` lleva en su
 * `fechaCalculo`. Hoy las cuatro son la misma —el servidor pone la fecha de la obligacion en los
 * cinco importes—, y aun asi se guardan las cuatro: el contrato permite que difieran, y aplanarlas
 * a una seria decidir por el servidor.
 */
export interface FechasDelSaldo {
  readonly insoluto: Fecha;
  readonly reajuste: Fecha;
  readonly interes: Fecha;
  readonly gastos: Fecha;
}

/**
 * Un concepto de deuda **tal como lo sabe el servidor**: una obligacion (un tributo de un
 * ejercicio) convertida en algo que el portal puede dibujar.
 *
 * <h2>Lo que trae de mas que una `Deuda` del artboard</h2>
 *
 * · `reajuste`, que el artboard no tiene y el servidor si (ver la nota de `cuentas.ts`);
 * · `actualizadoA`, la fecha de cada cifra;
 * · `totalDelServidor`, la suma que hizo el servidor para ESTA obligacion. Se guarda **para poder
 *   comprobar** que lo que suma `cuentas.ts` cuadra con lo que sumo el, no para pintarlo en vez;
 * · `tributo` y `ejercicio` en crudo, que son de donde sale `concepto` y lo que identifica la
 *   obligacion.
 *
 * <h2>Y los cinco `null`, que son el punto de todo esto</h2>
 *
 * `cuotas`, `vence`, `estado`, `tono` y `detalle` **no existen en el contrato**. Se declaran `null`
 * —y no opcionales— para que el compilador obligue a mirarlos: una pantalla que los pinte tiene que
 * decidir que ensena cuando no los hay, y no puede confundirlos con «todavia no llegaron».
 */
export interface DeudaDelServidor {
  /** Derivado, no del servidor: ver `idDeLaObligacion` en `deLaSituacion.ts`. */
  readonly id: string;
  readonly concepto: string;
  readonly unidad: string;
  readonly insoluto: Importe;
  readonly reajuste: Importe;
  readonly interes: Importe;
  readonly gastos: Importe;
  readonly actualizadoA: FechasDelSaldo;
  readonly totalDelServidor: Importe;
  /** El texto crudo del tributo (`PREDIAL`, `ARBITRIO`, `VEHICULAR`, …), sin traducir. */
  readonly tributo: string;
  readonly ejercicio: number;
  readonly cuotas: null;
  readonly vence: null;
  readonly estado: null;
  readonly tono: null;
  readonly detalle: null;
}

/**
 * Un concepto de deuda, venga del artboard o del servidor.
 *
 * Es la union que van a leer las pantallas del doble modo (issue 15): lo que las dos formas
 * comparten —`id`, `concepto`, `unidad` y los tres importes que `cuentas.ts` suma— se puede usar
 * sin preguntar de donde vino; lo demas hay que mirarlo, porque de un lado es texto y del otro
 * `null`.
 */
export type ConceptoDeDeuda = Deuda | DeudaDelServidor;

/**
 * Las cinco cifras del resumen de una municipalidad **sumadas por el servidor**, con su fecha, y la
 * frase que las explica.
 *
 * No se recalculan aqui: son las mismas que da la ficha 360 de la ventanilla, y eso es lo que
 * impide que el portal y ventanilla digan cifras distintas de la misma persona el mismo dia.
 */
export interface SaldosDeLaMunicipalidad {
  readonly insoluto: ImporteConFecha;
  readonly reajuste: ImporteConFecha;
  readonly interes: ImporteConFecha;
  readonly gastos: ImporteConFecha;
  readonly total: ImporteConFecha;
  /** La frase del servidor: «Sin deuda pendiente al …», «1 obligacion con saldo al …», … */
  readonly estadoDeLaConsulta: string;
}

/** Un predio del contribuyente, como lo publica el portal: sin identificador, con su porcentaje. */
export interface PredioDelPortal {
  readonly codigoCatastral: string;
  readonly tipo: string;
  readonly direccion: string;
  /** Texto, no numero: `'100.00'`. */
  readonly porcentajeDeTitularidad: string;
}

/** La situacion del contribuyente en una municipalidad. */
export interface MunicipalidadDelPortal {
  readonly ubigeo: string;
  readonly nombre: string;
  /** El codigo con el que ESTA municipalidad identifica a la persona: el de su recibo. */
  readonly codigoDelContribuyente: string;
  readonly nombreDelContribuyente: string;
  /** Si sigue de alta en ese padron. Con `false` la deuda se ensena igual: sobrevive a la baja. */
  readonly activo: boolean;
  readonly saldos: SaldosDeLaMunicipalidad;
  readonly deudas: readonly DeudaDelServidor[];
  readonly predios: readonly PredioDelPortal[];
}

/**
 * Lo que el portal sabe despues de leer `GET /portal/situacion`.
 *
 * `deudas` son las de todas las municipalidades, en el orden en que llegaron: es lo que la pantalla
 * de «Elegir que pago» marca y lo que `cuentas.ts` suma. `totalConsolidado` es **del servidor** y se
 * ensena tal cual —o no se ensena—; nunca se recalcula, porque un total al que le falta una
 * municipalidad es un importe plausible y equivocado.
 */
export interface SituacionDelServidor {
  readonly estado: EstadoDeLaSituacion;
  readonly tipoDeDocumento: TipoDeDocumentoDelContrato;
  readonly numeroDeDocumento: string;
  /** La fecha de corte del recorrido entero. */
  readonly aLaFecha: Fecha;
  readonly municipalidadesRecorridas: number;
  readonly totalConsolidado: ImporteConFecha | null;
  /** Por que no hay total, redactado por el servidor. `null` cuando lo hay. */
  readonly notaDelTotal: string | null;
  readonly municipalidades: readonly MunicipalidadDelPortal[];
  readonly deudas: readonly DeudaDelServidor[];
}
