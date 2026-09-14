import type { Fecha } from '@kamayuk/formato';

import type {
  ComprobanteDeDemostracion,
  Contribuyente,
  Deuda,
  MedioDePago,
  PagoDelHistorial,
  Unidad,
  Usuario,
} from './tipos.ts';

/**
 * **Los datos de demostracion del portal**, copiados del artboard.
 *
 * Este portal no tiene backend: todo lo que ensena sale de aqui. Es una copia LITERAL de
 * `diseno/Ciudadano.dc.html`, lineas 740-924 (`DEUDAS`, `MEDIOS`, `HISTORIAL`, `UNIDADES`), mas los
 * literales que la logica del prototipo escribe dentro de `renderVals` (el contribuyente, el
 * usuario, el comprobante). Lo unico que cambia es la FORMA —ver `tipos.ts`—: los importes pasan a
 * texto con dos decimales y las tuplas, a objetos con nombre.
 *
 * Que la copia siga siendo literal no se confia a la vista: `demostracion.test.ts` lee el artboard
 * vendorizado, evalua esos literales y los compara campo a campo con lo de aqui.
 *
 * **Sin React y sin cuentas.** Aqui no se suma nada: los totales salen de `cuentas.ts`. Un total
 * escrito a mano en los datos cuadraria hoy y seguiria «cuadrando» el dia que se cambiara un
 * sumando.
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

/**
 * Los numeros que sella el comprobante. Artboard, linea 1037.
 *
 * La fecha va como `Fecha` y la hora aparte: el artboard escribe «13/09/2026 · 10:42» en la linea
 * 1037 y «13/09/2026 - 10:42» en la 1266 (el mismo sello, con dos separadores). La pantalla lo
 * compone con el de la 1037, que es el que pide el issue 3.
 */
export const COMPROBANTE: ComprobanteDeDemostracion = {
  numero: '0003-0041418',
  operacion: '86 4418 2026 0913',
  fecha: FECHA_DE_CORTE,
  hora: '10:42',
};

/** El contribuyente que devuelve cualquier busqueda. Artboard, lineas 1104-1107 y 1294-1295. */
export const CONTRIBUYENTE: Contribuyente = {
  nombre: 'Suc. Rufina Medina Medina',
  codigo: '00000025673',
  tipoDeDocumento: 'DNI',
  numeroDeDocumento: '03593174',
  predios: 2,
  vehiculos: 1,
};

/** La persona con sesion. Artboard, linea 1045 (`usuario`). */
export const USUARIO: Usuario = {
  iniciales: 'MC',
  nombre: 'María E. Castillo',
  tipoDeDocumento: 'DNI',
  numeroDeDocumento: '44218937',
  codigo: '00000025673',
  correo: 'fruiz159@gmail.com',
};

/** La deuda del contribuyente, con el desglose de cada concepto. Artboard, lineas 740-806. */
export const DEUDAS: readonly Deuda[] = [
  {
    id: 'pred26',
    concepto: 'Impuesto predial 2026',
    unidad: 'Casa habitación · Calle Santa Rosa 116',
    cuotas: 'Cuotas 3 y 4 de 4',
    vence: 'La cuota 3 vence el 30 de setiembre',
    insoluto: '293.72',
    interes: '0.00',
    gastos: '0.00',
    estado: 'Por vencer',
    tono: 'atencion',
    detalle: {
      titulo: 'Cuotas del impuesto predial 2026',
      anchoMinimo: '580px',
      columnas: [
        { rotulo: 'Cuota', cifra: false },
        { rotulo: 'Vence', cifra: false },
        { rotulo: 'Importe S/', cifra: true },
        { rotulo: 'Situación', cifra: false },
      ],
      filas: [
        ['1 de 4', '28/02/2026', '147.98', 'Pagada'],
        ['2 de 4', '31/05/2026', '146.86', 'Pagada'],
        ['3 de 4', '30/09/2026', '146.86', 'Por vencer'],
        ['4 de 4', '30/11/2026', '146.86', 'Por vencer'],
      ],
      columnaDeInsignia: 3,
      nota: 'El impuesto del año sale del autovalúo de todos sus predios: S/ 151,406.75 de base, con la escala progresiva. Se reparte en cuatro cuotas iguales.',
    },
  },
  {
    id: 'arb26',
    concepto: 'Arbitrios municipales 2026',
    unidad: 'Casa habitación · Calle Santa Rosa 116',
    cuotas: 'Cuotas 1 a 8 de 12',
    vence: 'La última venció el 31 de agosto',
    insoluto: '291.60',
    interes: '18.44',
    gastos: '0.00',
    estado: 'Vencida',
    tono: 'mal',
    detalle: {
      titulo: 'Servicios que componen el arbitrio',
      anchoMinimo: '640px',
      columnas: [
        { rotulo: 'Servicio', cifra: false },
        { rotulo: 'Cómo se calcula', cifra: false },
        { rotulo: 'Mensual S/', cifra: true },
        { rotulo: '8 meses S/', cifra: true },
      ],
      filas: [
        ['Barrido de calles', 'Por metro de frontis: 8.20 m', '8.40', '67.20'],
        ['Recolección de residuos', 'Por área construida: 164.50 m²', '14.20', '113.60'],
        ['Parques y jardines', 'Por la zona del predio', '6.10', '48.80'],
        ['Serenazgo', 'Por uso y zona', '7.75', '62.00'],
      ],
      nota: 'Los arbitrios se pagan por predio y por mes, no por año. Se calculan con los metros de su frontis y su área construida, que figuran en su ficha catastral.',
    },
  },
  {
    id: 'pred24',
    concepto: 'Impuesto predial 2024',
    unidad: 'Casa habitación · Calle Santa Rosa 116',
    cuotas: 'Cuotas 1 a 4 de 4',
    vence: 'Venció el 30 de noviembre de 2024',
    insoluto: '1842.60',
    interes: '212.44',
    gastos: '12.00',
    estado: 'Vencida',
    tono: 'mal',
    detalle: {
      titulo: 'Composición de la deuda de 2024',
      anchoMinimo: '560px',
      columnas: [
        { rotulo: 'Concepto', cifra: false },
        { rotulo: 'Detalle', cifra: false },
        { rotulo: 'Importe S/', cifra: true },
      ],
      filas: [
        ['Impuesto del año', 'Autovalúo de 2024, cuatro cuotas', '1,842.60'],
        ['Interés moratorio', '0.90 % mensual desde el vencimiento', '212.44'],
        ['Gastos de emisión', 'Notificación de la orden de pago', '12.00'],
        ['Total de 2024', 'Con la amnistía: S/ 1,854.60', '2,067.04'],
      ],
      nota: 'Con la amnistía vigente se condona el interés de S/ 212.44. El impuesto y los gastos no se condonan.',
    },
  },
  {
    id: 'veh24',
    concepto: 'Impuesto vehicular 2024',
    unidad: 'Automóvil Toyota Yaris GLI 2018 · placa T2G-418',
    cuotas: 'Cuota 1 de 4',
    vence: 'En cobranza coactiva desde julio de 2026',
    insoluto: '614.00',
    interes: '182.44',
    gastos: '96.00',
    estado: 'En coactiva',
    tono: 'mal',
    detalle: {
      titulo: 'Deuda en cobranza coactiva',
      anchoMinimo: '560px',
      columnas: [
        { rotulo: 'Concepto', cifra: false },
        { rotulo: 'Detalle', cifra: false },
        { rotulo: 'Importe S/', cifra: true },
      ],
      filas: [
        ['Impuesto de la cuota', '1 % sobre S/ 61,400.00 de base', '614.00'],
        ['Interés moratorio', 'Desde el vencimiento de la cuota', '182.44'],
        ['Costas del procedimiento', 'Expediente coactivo 2026-0418', '96.00'],
        ['Total de la cuota', 'Con la amnistía: S/ 710.00', '892.44'],
      ],
      nota: 'Esta deuda está en cobranza coactiva: se puede pagar en línea igual, y al pagarla se levanta la medida. Las costas del procedimiento no se condonan.',
    },
  },
];

/** Los cuatro medios de pago del paso 4. Artboard, lineas 808-885. */
export const MEDIOS: readonly MedioDePago[] = [
  {
    id: 'tarjeta',
    rotulo: 'Tarjeta',
    nota: 'Visa, Mastercard, débito o crédito',
    icono: ['M3 7.5h18v11H3z', 'M3 11h18'],
    titulo: 'Pagar con tarjeta',
    detalleNota:
      'El pago se aplica al instante y el comprobante se emite de inmediato. No cobramos comisión.',
    campos: [
      { clave: 'tNum', etiqueta: 'Número de la tarjeta', ejemplo: '0000 0000 0000 0000', ancho: 2 },
      {
        clave: 'tNombre',
        etiqueta: 'Nombre como figura en la tarjeta',
        ejemplo: 'MARIA E CASTILLO P',
        ancho: 2,
      },
      { clave: 'tVence', etiqueta: 'Vence', ejemplo: 'MM/AA', ancho: 1 },
      {
        clave: 'tCvv',
        etiqueta: 'Código de seguridad',
        ejemplo: '123',
        ancho: 1,
        ayuda: 'Los tres dígitos del reverso',
      },
    ],
    aviso: 'Al continuar acepta el cargo en su tarjeta. La operación va cifrada.',
    boton: 'Pagar ahora',
  },
  {
    id: 'yape',
    rotulo: 'Yape o Plin',
    nota: 'Desde su celular, con el QR',
    icono: ['M6.5 2.5h11v19h-11z', 'M10 18.5h4'],
    titulo: 'Pagar con Yape o Plin',
    detalleNota:
      'Abra su aplicación, escanee el código y confirme el monto. El pago se aplica en cuanto lo confirme.',
    codigoEtiqueta: 'Número para yapear',
    codigo: '969 032 194',
    codigoNota:
      'A nombre de la Municipalidad Distrital de Catacaos. Ponga como mensaje su código de contribuyente.',
    pasos: [
      'Abra Yape o Plin y elija «Yapear» o «Enviar».',
      'Escanee el código o escriba el número que aparece arriba.',
      'Confirme el monto exacto de S/ {{TOTAL}} y escriba su código de contribuyente en el mensaje.',
      'Vuelva aquí y pulse «Ya yapeé» para que le emitamos el comprobante.',
    ],
    aviso: 'El monto tiene que ser exacto. Si yapea de menos, la deuda queda parcialmente pagada.',
    boton: 'Ya yapeé',
  },
  {
    id: 'pagalo',
    rotulo: 'pagalo.pe',
    nota: 'Plataforma del Banco de la Nación',
    icono: ['M4 20.5h16', 'M12 3.5 20.5 9H3.5z', 'M6.5 9v11.5', 'M17.5 9v11.5'],
    titulo: 'Pagar por pagalo.pe',
    detalleNota:
      'Le llevamos a pagalo.pe con el código ya cargado. Puede pagar con tarjeta, Yape o en una agencia del Banco de la Nación.',
    codigoEtiqueta: 'Código de tributo en pagalo.pe',
    codigo: '8 4 1 6 2',
    codigoNota: 'Con este código y su código de contribuyente encontrará el pago ya registrado.',
    pasos: [
      'Pulse «Ir a pagalo.pe»: se abre en una pestaña nueva con el código cargado.',
      'Elija cómo pagar y complete la operación allí.',
      'Vuelva a esta pestaña: el pago aparece en un minuto y podrá descargar su comprobante.',
    ],
    aviso: 'pagalo.pe es del Banco de la Nación y cobra su propia comisión.',
    boton: 'Ir a pagalo.pe',
  },
  {
    id: 'banco',
    rotulo: 'Banco o agente',
    nota: 'Con un código de pago',
    icono: [
      'M3.2 7.4h17.6v9.2H3.2z',
      'M13.6 12a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0',
      'M6.6 10.6v2.8',
    ],
    titulo: 'Pagar en un banco o agente',
    detalleNota:
      'Le damos un código de pago. Llévelo a cualquiera de los bancos de la lista, a su aplicación o a un agente, y pague ahí.',
    codigoEtiqueta: 'Su código de pago',
    codigo: '2026-0025673-4418',
    codigoNota:
      'Válido por 72 horas. Apúntelo o descárguelo: con él pagan por usted sin que haga falta nada más.',
    pasos: [
      'Vaya a su banco, a su aplicación o a un agente autorizado.',
      'Busque «Municipalidad de Catacaos» en pagos de servicios.',
      'Escriba el código de pago y confirme el monto de S/ {{TOTAL}}.',
      'Guarde el voucher: el pago se aplica al día siguiente hábil.',
    ],
    bancos: [
      { nombre: 'BCP', canales: 'Banca por internet, app y agentes' },
      { nombre: 'Interbank', canales: 'Banca por internet y app' },
      { nombre: 'BBVA', canales: 'Banca por internet y ventanilla' },
      { nombre: 'Scotiabank', canales: 'Banca por internet y app' },
      { nombre: 'Caja Piura', canales: 'Ventanilla y app' },
      { nombre: 'Banco de la Nación', canales: 'Ventanilla y pagalo.pe' },
    ],
    aviso:
      'Con código de banco el pago se aplica al día siguiente hábil. Si su cuota vence hoy, pague con tarjeta o Yape.',
    boton: 'Ya pagué en el banco',
  },
];

/** Los pagos anteriores, del mas reciente al mas antiguo. Artboard, lineas 887-893. */
export const HISTORIAL: readonly PagoDelHistorial[] = [
  {
    fecha: '2026-08-12',
    concepto: 'Impuesto predial 2026 — cuotas 1 y 2',
    medio: 'Tarjeta',
    comprobante: '0003-0041182',
    importe: '294.84',
  },
  {
    fecha: '2026-05-28',
    concepto: 'Arbitrios 2025 — cuotas 1 a 12',
    medio: 'Yape',
    comprobante: '0003-0038944',
    importe: '412.00',
  },
  {
    fecha: '2025-02-18',
    concepto: 'Impuesto predial 2025 — cuotas 1 a 4',
    medio: 'BCP con código',
    comprobante: '0003-0034118',
    importe: '578.20',
  },
  {
    fecha: '2024-12-04',
    concepto: 'Arbitrios 2024 — cuotas 9 a 12',
    medio: 'Ventanilla',
    comprobante: '0003-0031044',
    importe: '148.60',
  },
  {
    fecha: '2024-02-22',
    concepto: 'Impuesto predial 2024 — cuota 1',
    medio: 'pagalo.pe',
    comprobante: '0003-0028801',
    importe: '460.65',
  },
];

/** Los predios y el vehiculo del contribuyente. Artboard, lineas 895-917. */
export const UNIDADES: readonly Unidad[] = [
  {
    titulo: 'Casa habitación · Calle Santa Rosa 116',
    detalle: 'Su predio principal. De él salen el impuesto predial y los arbitrios.',
    baseEtiqueta: 'Autovalúo 2026',
    base: '132196.75',
    datos: [
      '210.00 m² de terreno',
      '164.50 m² construidos',
      '8.20 m de frontis',
      'Usted es propietaria al 100 %',
    ],
    origen: 'Ficha catastral 200601-02-014-014, actualizada el 12 de marzo de 2026.',
  },
  {
    titulo: 'Terreno sin construir · Mz. B Lt. 7 — Bellavista',
    detalle:
      'Suma al autovalúo del predial. Sin construcción no genera arbitrios de recolección.',
    baseEtiqueta: 'Autovalúo 2026',
    base: '38420.00',
    datos: ['184.00 m² de terreno', 'Sin construcciones', 'Usted es copropietaria al 50 %'],
    origen:
      'Ficha catastral 200601-04-021-007. El 50 % restante figura a nombre de otro titular.',
  },
  {
    titulo: 'Automóvil Toyota Yaris GLI 2018 · placa T2G-418',
    detalle:
      'Estuvo afecto de 2019 a 2021. Ya no genera impuesto nuevo, pero queda la cuota de 2024 sin pagar.',
    baseEtiqueta: 'Base imponible',
    base: '61400.00',
    datos: ['Afecto de 2019 a 2021', 'Dado de baja por vencimiento del plazo'],
    origen:
      'Padrón vehicular de Rentas, con la tabla referencial del MEF para su año de fabricación.',
  },
];
