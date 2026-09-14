import type { Fecha, Importe, Tono } from '@kamayuk/formato';

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
