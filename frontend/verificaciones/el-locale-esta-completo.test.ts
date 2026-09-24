import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { clavesDeLaEscalera } from '../src/api/escalera.ts';
import { clavesDelSilencio } from '../src/api/silencio.ts';
import { clavesDeLaUnidad } from '../src/datos/deLaSituacion.ts';
import { clavesDelHistorial } from '../src/pasos/historial/textosDelHistorial.ts';
import { clavesDeLosMedios } from '../src/pasos/pagar/textosDeLosMedios.ts';
import { RAIZ } from './artboards.ts';

/**
 * **El locale tiene todas las claves, y ninguna se aparta de la suya** (rentas#103, AC5).
 *
 * Portada de `rentas/frontend/verificaciones/el-locale-esta-completo.test.ts`.
 *
 * <h2>Las dos direcciones, y por que hacen falta las dos</h2>
 *
 * · **Ninguna clave usada falta del locale.** Sin esto, un segundo idioma se haria copiando un
 *   archivo incompleto y la pantalla saldria **a medias**: unas frases traducidas y otras en
 *   castellano, que parece un defecto de la traduccion y es del inventario.
 * · **Ningun valor se aparta de su clave.** El castellano esta en dos sitios —el codigo y el
 *   locale— y el artboard manda sobre el primero. Cada valor **tiene que ser igual a su clave**,
 *   asi que el locale no puede decir algo distinto del artboard sin ponerse rojo.
 *
 * <h2>Lo que cambia respecto a `rentas`: de donde salen las claves</h2>
 *
 * En `rentas` la mayoria sale DERIVADA de las 40 definiciones de pantalla (`catalogo-de-claves.ts`)
 * y el resto es una lista de literales. Aqui no hay definiciones todavia: **todas son literales**,
 * las que el codigo escribe como `t('…')`. Que el codigo no use una clave que esta lista no tiene lo
 * dice `i18next-cli status` —`yarn i18n`, dentro de `yarn verificar`—; que la lista y el locale
 * cuadren, esta guarda. Cuando lleguen las pantallas con sus datos, la lista se derivara como alli.
 *
 * Y la primera ya llego (issue 8): los textos de los cuatro medios de pago viven en `MEDIOS` y la
 * pantalla los traduce con una variable, que `i18next-cli` no ve. Entran DERIVADOS de
 * `clavesDeLosMedios()` (`src/pasos/pagar/textosDeLosMedios.ts`), no copiados aqui.
 *
 * <h2>Y por que el locale se REGENERA en vez de escribirse</h2>
 *
 * Porque sale de esta lista: a mano se queda viejo a la primera frase nueva.
 * `yarn i18n:regenerar` lo vuelve a escribir.
 */

const LOCALE = join(RAIZ, 'src/i18n/locales/es.json');

/**
 * Las formas plurales del paso 2 (issue 6). `es` tiene tres categorias (`one`, `many` y `other`); la
 * `many` es la de los millones y dice lo mismo que `other`.
 */
const PLURALES_DEL_PASO_2: Readonly<Record<string, string>> = {
  // Linea 1105: «2 predios y 1 vehículo».
  '{{count}} predio_one': '{{count}} predio',
  '{{count}} predio_many': '{{count}} predios',
  '{{count}} predio_other': '{{count}} predios',
  '{{count}} vehículo_one': '{{count}} vehículo',
  '{{count}} vehículo_many': '{{count}} vehículos',
  '{{count}} vehículo_other': '{{count}} vehículos',
  // Linea 1116: la nota de la banda. El plural lo decide cuantos estan vencidos, que es el sujeto.
  '{{count}} de {{conceptos}} conceptos están vencidos. El interés corre cada día que pasa._one':
    '{{count}} de {{conceptos}} conceptos está vencido. El interés corre cada día que pasa.',
  '{{count}} de {{conceptos}} conceptos están vencidos. El interés corre cada día que pasa._many':
    '{{count}} de {{conceptos}} conceptos están vencidos. El interés corre cada día que pasa.',
  '{{count}} de {{conceptos}} conceptos están vencidos. El interés corre cada día que pasa._other':
    '{{count}} de {{conceptos}} conceptos están vencidos. El interés corre cada día que pasa.',
  // Lineas 1158-1162: lo que se va a pagar. Con todo marcado, «los 4 conceptos»; con uno solo vivo,
  // «1 concepto» y no «los 1 conceptos» del artboard.
  'Va a pagar los {{count}} conceptos_one': 'Va a pagar {{count}} concepto',
  'Va a pagar los {{count}} conceptos_many': 'Va a pagar los {{count}} conceptos',
  'Va a pagar los {{count}} conceptos_other': 'Va a pagar los {{count}} conceptos',
  'Va a pagar {{count}} concepto de {{total}}_one': 'Va a pagar {{count}} concepto de {{total}}',
  'Va a pagar {{count}} concepto de {{total}}_many': 'Va a pagar {{count}} conceptos de {{total}}',
  'Va a pagar {{count}} concepto de {{total}}_other': 'Va a pagar {{count}} conceptos de {{total}}',
};

/**
 * El aviso de la busqueda (nota del revisor del issue 9): lo que queda pendiente es la deuda viva, y
 * no los cuatro del artboard (linea 1006). Sin deuda viva, la frase de abajo, sin plural.
 */
const PLURALES_DE_LA_BUSQUEDA: Readonly<Record<string, string>> = {
  'Encontramos {{count}} conceptos pendientes._one': 'Encontramos {{count}} concepto pendiente.',
  'Encontramos {{count}} conceptos pendientes._many': 'Encontramos {{count}} conceptos pendientes.',
  'Encontramos {{count}} conceptos pendientes._other': 'Encontramos {{count}} conceptos pendientes.',
};

/** Las claves que el codigo escribe como `t('…')`. Los textos son los del artboard, tal cual. */
const LITERALES = [
  // `diseno/Ciudadano.dc.html`, linea 65: el titulo de la barra.
  'Pago de tributos en línea',
  // `diseno/Ciudadano.dc.html`, linea 692: el valor por omision de la prop `entidad`.
  'Municipalidad Distrital de Catacaos',

  // ── El marco (issue 4) ──────────────────────────────────────────────────────────────────────
  // Linea 73: el boton de la barra sin sesion.
  'Iniciar sesión',
  // Linea 1045: la cabecera del menu de la sesion (`usuario.codigo`). El codigo es dato y entra por el hueco.
  'Contribuyente {{codigo}}',
  // Lineas 1052-1055: las cuatro opciones del menu, y los dos avisos que levantan.
  'Mis pagos',
  'Mis predios y vehículos',
  'Cambiar mi clave',
  'Cerrar sesión',
  'Abriría el cambio de clave.',
  'Sesión cerrada.',
  // Lineas 1019-1021: la franja de pasos, y el aviso de un paso futuro (1071).
  'Buscar mi deuda',
  'Elegir qué pago',
  'Mis datos',
  'Pagar',
  'Comprobante',
  'Complete primero los pasos anteriores.',
  // Linea 677: el pie, con la entidad en su hueco; lineas 679-681, sus enlaces.
  '{{entidad}} — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00. Los datos de esta pantalla son de demostración.',
  'Preguntas frecuentes',
  'Reclamos',
  'Términos',
  // El rotulo accesible de la region de avisos. No esta en el artboard (alli el aviso es un
  // `role="status"` sin nombre); es la palabra de `TEXTOS_DE_LA_UI.avisos` de `@kamayuk/ui`, traducida.
  'Avisos',
  // Los titulos de cada paso: lineas 126, 224, 314, 360, 1276 y 570. Cada uno es el `h1` de su pantalla
  // (issues 5-10); «Mis pagos», el del historial, ya esta arriba.
  'Consulte y pague sus tributos',
  'Lo que debe, por concepto',
  '¿A dónde le enviamos el comprobante?',
  '¿Cómo quiere pagar?',
  'Su pago se registró',

  // ── Paso 1 · Buscar mi deuda (issue 5) ──────────────────────────────────────────────────────
  // Linea 127: la entrada bajo el titulo (que es la clave de arriba, «Consulte y pague sus tributos»).
  'Escriba su código de contribuyente o su documento de identidad. Verá lo que debe, con su vencimiento, y podrá pagar todo o solo lo que elija.',
  // Lineas 131 y 1084: «Buscar por» y sus tres opciones. Las opciones son dato del recorrido
  // (`TipoDeDocumento`) y se traducen al dibujarse.
  'Buscar por',
  'Código de contribuyente',
  'DNI',
  'RUC',
  // Linea 1086: la etiqueta del numero. El artboard concatena «Número de » + tipo; aqui son dos
  // frases enteras, para que un traductor no tenga que adivinar la concordancia.
  'Número de DNI',
  'Número de RUC',
  // Lineas 1004-1005: los dos errores de `buscar()`. El aviso de la busqueda valida (1006) sale de la
  // deuda viva (issue 9): sus formas plurales, abajo, y sin deuda viva esta.
  'Escriba su código de contribuyente o su documento para poder buscar.',
  'El código y el documento son solo números. Revise lo que escribió.',
  'No encontramos conceptos pendientes.',
  // Linea 151: la ayuda bajo el formulario.
  'Su código de contribuyente figura en la cuponera del impuesto predial y en cualquier recibo anterior. Si no lo encuentra, busque por su DNI.',
  // Lineas 155 y 1093-1096: «Qué puede hacer aquí» y sus cuatro capacidades.
  'Qué puede hacer aquí',
  'Ver lo que debe',
  'Su impuesto predial, arbitrios y vehicular, con el vencimiento de cada cuota.',
  'Pagar en línea',
  'Con tarjeta, Yape, pagalo.pe o un código para el banco.',
  'Descargar comprobantes',
  'El del pago que acaba de hacer y los de años anteriores.',
  'Saber de dónde sale',
  'El autovalúo de su predio, los metros de frontis y la tabla que se le aplica.',
  // Linea 177: la amnistia. La norma es dato (`ORDENANZA`, de `src/datos/`) y entra por su hueco.
  'Amnistía vigente hasta el 31 de diciembre.',
  'La {{ordenanza}} condona el 100 % del interés moratorio. Al pagar ahora, el descuento se aplica solo: no hay que solicitarlo.',

  // ── Paso 2 · Elegir qué pago (issue 6) ──────────────────────────────────────────────────────
  // Lineas 187-191 y 1105: quien es. El nombre, el codigo y el documento son dato y entran por su
  // hueco; los predios y los vehiculos son plurales (abajo) y entran ya dichos.
  'Contribuyente',
  'Código {{codigo}} · {{tipoDeDocumento}} {{numeroDeDocumento}} · {{predios}} y {{vehiculos}}',
  'No soy yo',
  // Lineas 199-206 y 1116: la banda del total. La fecha la dice `fechaEnPalabras`, con año y
  // «setiembre» (nota del revisor), y el importe `formatearImporte`: los dos entran por su hueco.
  'Deuda total al {{fecha}}',
  'Con la amnistía',
  'se descuenta {{importe}} de interés',
  // Lineas 1119-1122: las cuatro cifras, con su nota.
  'Impuesto y arbitrios',
  'Lo que no se condona',
  'Interés moratorio',
  'La amnistía lo condona entero',
  'Gastos y costas',
  'Emisión y cobranza coactiva',
  'Conceptos',
  'Predial, arbitrios y vehicular',
  // Linea 224 (el titulo, arriba) y 1152: «Marcar todo» / «Quitar todo».
  'Marcar todo',
  'Quitar todo',
  // Lineas 1132-1145: cada concepto. El concepto es dato y entra por su hueco.
  'Pagar {{concepto}}',
  'incluye {{importe}} de recargo',
  'Ver el detalle',
  'Ocultar el detalle',
  // Lineas 1158-1173: la barra de pago, el aviso sin nada marcado y la ayuda de la linea 298.
  'No ha marcado ningún concepto',
  'Con la amnistía paga {{conAmnistia}}: se descuentan {{interes}} de interés',
  'Pagar todo',
  'Pagar lo marcado',
  'Marque al menos un concepto para poder pagar.',
  'Marque al menos un concepto para continuar. Puede pagar todo de una vez o solo lo que le venza primero.',
  // Lineas 303-305 y 1368: sin deuda viva.
  'No le queda nada por pagar',
  'Pagó todos sus conceptos pendientes. Puede pedir su constancia de no adeudo, que acredita que está al día.',
  'Pedir mi constancia de no adeudo',
  'Se emitiría su constancia de no adeudo al día de hoy.',

  // ── Paso 3 · Mis datos (issue 7) ────────────────────────────────────────────────────────────
  // Linea 315: lo que va a pagar (el titulo, «¿A dónde le enviamos…», ya esta arriba). El importe lo
  // dice `formatearImporte` y entra por su hueco.
  'Va a pagar {{importe}}. Necesitamos un correo para enviarle el comprobante. Si tiene cuenta, entre y le guardamos el pago en su historial.',
  // Sin seleccion no hay «Va a pagar» (nota del revisor): se invita a entrar para ver los pagos.
  'Todavía no ha elegido qué pagar. Si tiene cuenta, entre para ver sus pagos y sus comprobantes.',
  // Lineas 319-331 y 1186-1189: «Solo con mi correo», su campo, la casilla, el boton y los dos errores.
  'Solo con mi correo',
  'Lo más rápido. No hace falta crear una cuenta; el comprobante le llega al correo y lo podrá descargar al terminar.',
  'Correo electrónico',
  'nombre@example.com',
  'Avisarme por correo cuando venza mi próxima cuota',
  'Continuar al pago',
  'Escriba un correo para poder enviarle el comprobante.',
  'Ese correo no parece completo. Revíselo: le enviaremos el comprobante ahí.',
  // Lineas 336-350 y 1196-1199: «Con mi cuenta», sus campos, el boton, el error y la bienvenida.
  'Con mi cuenta',
  'Guarda este pago y todos los anteriores en un historial, con sus comprobantes siempre a mano.',
  'Documento de identidad',
  'Clave',
  'Entrar y pagar',
  'Escriba su documento y su clave para entrar.',
  'Bienvenida. Este pago quedará en su historial.',
  // Entrar sin nada que pagar lleva al historial (nota del revisor): alli no hay «este pago».
  'Bienvenida. Aquí están sus pagos.',
  // Linea 350: los dos enlaces, que en la demostracion son botones que avisan.
  'Olvidé mi clave',
  'Crear una cuenta',
  'Abriría la recuperación de su clave.',
  'Abriría el registro de una cuenta nueva.',

  // ── Paso 4 · Pagar (issue 8) ────────────────────────────────────────────────────────────────
  // Linea 361: la entrada bajo el titulo (que ya esta arriba, «¿Cómo quiere pagar?»). Lo que dice cada
  // medio no se escribe aqui: entra derivado de `MEDIOS`, abajo.
  'Elija un medio de pago. Con tarjeta, Yape o pagalo.pe el pago se aplica al instante; con código de banco se aplica al día siguiente hábil.',
  // Linea 431: el rotulo de los bancos.
  'Dónde puede pagarlo',
  // Lineas 449-471 y 1235-1240: el resumen. «Impuesto y arbitrios» y «Gastos y costas» ya estan en el
  // paso 2. El destino entra por su hueco: el correo es dato, y sin correo es «su correo» (1027).
  'Lo que va a pagar',
  'Interés condonado',
  'Total a pagar',
  'El comprobante se enviará a {{destino}}.',
  'su correo',
  'Cambiar lo que voy a pagar',
  // Linea 1255: confirmar sin nada que pagar; y 1270, el aviso del pago registrado.
  'No hay nada que pagar.',
  'Pago registrado. Le enviamos el comprobante a {{destino}}.',
  // Sin nada que pagar, volver a elegir: son los rotulos de la franja («Buscar mi deuda», «Elegir qué
  // pago»), que ya estan arriba.

  // ── Paso 5 · Comprobante (issue 9) ──────────────────────────────────────────────────────────
  // Lineas 485-486 y 1278-1279: la banda de exito («Su pago se registró» ya esta arriba). El importe, el
  // medio y el destino son del pago sellado y entran por su hueco; sin correo, «su correo».
  'Pagó {{importe}} con {{medio}}. Le enviamos el comprobante a {{destino}}, y puede descargarlo aquí mismo. La deuda pagada ya se descontó de su cuenta.',
  // Lineas 495-500: la cabecera del recibo. La entidad ya esta arriba; el numero es dato.
  'Gerencia de Administración Tributaria',
  'Constancia de pago',
  // Lineas 1292-1297: la meta. «Contribuyente» ya esta en el paso 2; los valores son dato.
  'Número de operación',
  'Fecha y hora',
  'Medio de pago',
  'Código',
  'Enviado a',
  // Linea 1301: las columnas de la tabla.
  'Concepto',
  'Unidad',
  'Cuotas',
  'Importe S/',
  // Lineas 1311-1312: el pie. La norma es dato (`ORDENANZA`) y entra por su hueco.
  'Interés condonado por la {{ordenanza}}',
  'Total pagado',
  // Linea 1321: la nota del recibo.
  'Esta constancia acredita el pago de los conceptos detallados. Consérvela: es lo que hay que presentar si la deuda volviera a aparecer. El pago con tarjeta, Yape o pagalo.pe se aplica de inmediato; el pago con código de banco, al día siguiente hábil.',
  // Lineas 538-539 y 1283-1285: las acciones, y el aviso de descargar (1323).
  'Descargar comprobante',
  'Se descargaría el comprobante {{numero}} en PDF.',
  'Imprimir',
  'Ver mis pagos',
  'Pagar otra deuda',
  'Consultar otra deuda',
  // Lineas 548-550: la invitacion sin sesion. El correo del pago entra por su hueco.
  'Guarde este pago en una cuenta',
  'Si crea una cuenta con {{correo}}, este comprobante y los anteriores quedan guardados: no tendrá que volver a buscarlos.',
  'Crear mi cuenta',

  // ── Mis pagos (issue 10) ────────────────────────────────────────────────────────────────────
  // Linea 571: la entrada bajo el titulo («Mis pagos» ya esta arriba, en el menu).
  'Todos sus pagos, con sus comprobantes. Abajo está lo que le queda pendiente.',
  // Lineas 1332-1335: la banda del pago reciente. El importe, el medio y los numeros son del sello y
  // entran por su hueco; sin correo, «su correo».
  'Pago de {{importe}} registrado hoy',
  'Operación {{operacion}} · {{medio}} · comprobante {{numero}}, enviado a {{destino}}',
  'Ver el comprobante',
  // Lineas 586 y 1338-1344: «Pagos realizados», sus columnas («Concepto», «Comprobante» e «Importe S/» ya
  // estan en el paso 5), el boton de cada fila con su nombre accesible y su aviso, y la nota (610).
  'Pagos realizados',
  'Fecha',
  'Medio',
  'Comprobante {{numero}}',
  'Se descargaría el comprobante {{numero}}.',
  'Un pago aplicado ya descontó la cuota. Si pagó y la deuda sigue apareciendo, traiga el comprobante: se resuelve el mismo día.',
  // No esta en el artboard: la fuente de los pagos o de las unidades no contesta.
  'No pudimos traer sus pagos. Vuelva a intentarlo en unos minutos.',
  'No pudimos traer sus predios y vehículos. Vuelva a intentarlo en unos minutos.',
  // Lineas 615-638 y 1349-1371: lo pendiente, sin deuda y con ella. El aviso de la constancia ya esta en
  // el paso 2.
  'Lo que queda pendiente',
  'Sin deuda pendiente',
  'No le queda nada pendiente',
  'Puede pedir su constancia de no adeudo',
  'Al día',
  'Puede pagar todo o elegir solo algunos conceptos.',
  'Pagar lo pendiente',
  'No le queda nada pendiente. Puede pedir su constancia de no adeudo, que acredita que está al día.',
  'Pedir mi constancia',
  // Lineas 645-646 y 668: «De dónde sale lo que paga». Lo que dice cada unidad entra derivado, abajo.
  'De dónde sale lo que paga',
  'Sus predios y vehículos, con los datos sobre los que se calcula cada tributo. Si algo no coincide con la realidad, puede pedir que se rectifique.',
  'El autovalúo lo determina Catastro con el arancel de su calle y los valores unitarios del año; la deuda y las cuotas las lleva Rentas; los pagos se registran en Caja.',

  // ── La puerta de identidad (issue 13) ───────────────────────────────────────────────────────
  // No estan en el artboard: el artboard no tiene login real. Es lo que `src/aplicacion.tsx`
  // dibuja cuando el portal vuelve del emisor y el canje no se pudo hacer.
  'No se pudo abrir su sesión',
  'Volvimos del sistema de identidad sin poder entrar: {{motivo}}. {{detalle}}',
  'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
  // El canje silencioso (issue 35): la espera que `src/aplicacion.tsx` dibuja si preguntarle al
  // emisor si ya se habia entrado tarda; y si no se pudo, la variante del aviso de arriba, que no
  // dice «Volvimos» porque nadie fue a ningun sitio (revision del PR #45).
  'Comprobando su sesión…',
  'Al abrir la página quisimos comprobar si ya había entrado, y no se pudo: {{motivo}}. {{detalle}}',

  // ── El doble modo y los estados de la consulta (issue 27) ───────────────────────────────────
  // No estan en el artboard: el artboard no consulta a ningun servidor. Son los cinco finales que
  // `src/pasos/deudas/LaConsulta.tsx` dibuja cuando hay plataforma, y la sesion de la barra.
  //
  // Lo que NO esta aqui, y no es un olvido: la nota del servidor («No se pudo consultar
  // Municipalidad Provincial de Sullana…»). Esa la redacta el backend y se ensena TAL CUAL; pasarla
  // por `t()` la buscaria en este inventario, no la encontraria, y saldria igual — por accidente.
  'Consultando su deuda…',
  'Estamos preguntando a las municipalidades. Tarda unos segundos.',
  'No pudimos consultar toda su deuda',
  'Por eso no le mostramos ningún total: una cifra a la que le falta una municipalidad se lee como si fuera toda su deuda, y no lo es.',
  'No encontramos deuda a su nombre',
  'Con {{tipoDeDocumento}} {{numeroDeDocumento}} no figura ninguna deuda en las municipalidades del sistema.',
  'Si cree que es un error, acérquese con su documento a la ventanilla de la municipalidad: allí lo revisan en el momento.',
  // El boton del peldano que pide identidad, y lo que se dice si no se pudo ni llegar al emisor.
  'Entrar',
  'No pudimos llevarle al acceso: {{motivo}}.',
  // El nombre de respaldo de la barra: un realm puede no mandar `name`, y el circulo no puede
  // quedarse vacio (`src/marco/Barra.tsx`).
  'Su cuenta',

  // ── El recorrido con plataforma (issue 28) ──────────────────────────────────────────────────
  // Paso 1 · Entrar (`src/pasos/entrar/Entrar.tsx`). No esta en el artboard: alli el paso 1 es
  // buscar por documento, y el backend ya no ofrece eso (ADR-0020).
  'Entre con su cuenta del portal',
  'Su deuda está a nombre de su documento, así que lo primero es saber quién pregunta. Al entrar verá lo que debe en todas las municipalidades del sistema.',
  'Entrar con mi cuenta',
  'Si todavía no tiene cuenta, se la abren en la ventanilla de la municipalidad con su documento: aquí no se puede crear. Es a propósito, porque nadie puede acreditar desde una pantalla que usted es usted.',
  // La franja: la etiqueta del paso 1 con plataforma es la misma clave «Entrar» de arriba, y el
  // aviso de un paso HECHO que ya no se abre, que en demostracion no existia.
  'Ese paso ya está hecho y no hace falta repetirlo.',
  // Paso 2 con plataforma (`src/pasos/deudas/LaConsulta.tsx`): la deuda del servidor.
  'Reintentar la consulta',
  'Lo que suma el portal',
  'Código {{codigo}} · {{documento}}',
  'Reajuste',
  'al {{fecha}}',
  'El portal no publica el desglose de este concepto.',
  'El servidor da el saldo del tributo entero: cuántas cuotas son, cuándo vence cada una y qué servicios componen el arbitrio no viajan en la respuesta. En la ventanilla de la municipalidad se lo detallan.',
  // Pasos 4 y 5: el pago es simulado y se dice (`src/piezas/AvisoDePagoSimulado.tsx`).
  'El pago en línea todavía no está disponible: esta pantalla es una demostración.',
  'Puede recorrerla entera, pero no se cobra nada y su deuda no cambia. Para pagar de verdad, acérquese con su documento a la ventanilla de la municipalidad.',
  'Simular el pago: no se cobra nada',
  // Y las frases que sustituyen a las que afirmarian un hecho que no ocurrio (revision del #28).
  'Aquí no se envía ningún comprobante: el portal todavía no cobra en línea.',
  'Pago simulado. No se cobró nada y su deuda no ha cambiado.',
  'Todavía no se puede pagar en línea',
  'El portal ya sabe lo que debe, pero el cobro todavía no está conectado: no hay ningún medio de pago que ofrecerle. Para pagar, acérquese con su documento a la ventanilla de la municipalidad.',
  'Puede seguir el recorrido, sin pagar',
  'El botón de abajo no cobra: solo enseña cómo se vería su comprobante. Su deuda queda exactamente donde está.',
  'No se le pide ningún dato de pago, porque no hay ningún pago que hacer.',
  'Así se vería su comprobante',
  'Esto es lo que habría pagado: {{importe}}. No se cobró nada, no se envió ningún comprobante y su deuda no ha cambiado.',
  'Comprobante de ejemplo',
  'Total que se pagaría',
  'Este comprobante es una vista de ejemplo y no acredita ningún pago: el portal todavía no cobra en línea, así que no hay ninguna operación que constatar. Para pagar, acérquese con su documento a la ventanilla de la municipalidad.',
  'Pago simulado de {{importe}} en esta visita',
  'No se cobró nada, no se envió ningún comprobante y su deuda sigue pendiente.',
  'Ver cómo se vería',
  // «Mis pagos» con plataforma: lo que el backend no publica, dicho.
  'El portal todavía no publica su historial de pagos: por ahora solo sabe lo que debe hoy. Los pagos anteriores están en la ventanilla de la municipalidad, con su comprobante.',
  'Los predios que el portal publica a su nombre. El autovalúo, los metros de frontis y la tabla que se le aplica no viajan en la respuesta: se los detallan en la ventanilla.',
  'Código catastral {{codigo}}',
  '{{porcentaje}} % de titularidad',
  'El portal todavía no publica sus vehículos: aquí solo están los predios.',
  // Con plataforma, lo que de verdad se sabe en lugar de lo que el artboard afirma (issue 49): «Mis
  // pagos» segun la consulta, el paso 2 sin deuda, la portada, el pie y «Cambiar mi clave».
  'Lo que le queda pendiente, según la consulta de hoy, y los predios a su nombre. El portal todavía no publica sus pagos.',
  'Consultando…',
  'Sin total',
  'No pudimos consultar su deuda. Vuelva a intentarlo en unos minutos.',
  'No pudimos consultar toda su deuda, así que no le mostramos ningún total.',
  'Sin registros',
  'No encontramos deuda a su nombre en las municipalidades del sistema.',
  'Nada pendiente',
  'Según la consulta de hoy, no tiene deuda pendiente en las municipalidades del sistema.',
  'Lo que debe en cada municipalidad del sistema, por tributo y año, con la fecha de cada importe.',
  'Ver sus predios',
  'Los predios que figuran a su nombre, con su código catastral.',
  'Pagar en la ventanilla',
  'El pago en línea todavía no está disponible: se paga con su documento en la municipalidad.',
  '{{entidad}} — Pago de tributos en línea. Atención en ventanilla de lunes a viernes, de 8:00 a 16:00.',
  'El portal todavía no permite cambiar la clave.',

  // Los plurales: cada forma que i18next pide para `es` (`_one`, `_many`, `_other`). Lo que dice
  // cada una esta en `PLURALES`.
  ...Object.keys(PLURALES_DEL_PASO_2),
  ...Object.keys(PLURALES_DE_LA_BUSQUEDA),

  // Lo que dicen los cuatro medios de pago (issue 8), derivado del dato.
  ...clavesDeLosMedios(),
  // Lo que dicen los pagos anteriores y las unidades del historial (issue 10), derivado del dato.
  ...clavesDelHistorial(),
  // Lo que el ADAPTADOR escribe cuando el contrato no deja identificar la unidad (issue 26). La
  // pantalla las traduce con una variable —`unidad` es a veces el predio de verdad, que es dato—,
  // asi que `i18next-cli` no las ve.
  ...clavesDeLaUnidad(),
  // Lo que dice la escalera de la API (issues 13 y 33), derivado de su tabla: los tres textos de
  // cada uno de los NUEVE peldanos —los siete de siempre y los dos que trae kamayuk-lib#96,
  // `conflicto` y `orden-no-admitido`—. La pantalla los traduce con una variable —la clave del
  // peldano solo se sabe en ejecucion—, asi que `i18next-cli` no los ve y escribirlos aqui a mano
  // dejaria el olvido sin rojo.
  ...clavesDeLaEscalera(),
  // Lo que el canje silencioso (issue 35) puede llegar a decir, derivado de `TEXTOS_DEL_SILENCIO`.
  // La pantalla lo traduce con una variable —el motivo solo se sabe en ejecucion—.
  ...clavesDelSilencio(),
];

/** Lo que tiene que decir cada forma plural, con el mecanismo de `rentas`. */
const PLURALES: Readonly<Record<string, string>> = { ...PLURALES_DEL_PASO_2, ...PLURALES_DE_LA_BUSQUEDA };

function elQueDeberiaSer(): Readonly<Record<string, string>> {
  const claves = [...new Set(LITERALES)].sort((a, b) => a.localeCompare(b, 'es'));
  return Object.fromEntries(claves.map((c) => [c, PLURALES[c] ?? c]));
}

describe('el locale `es` esta completo y no se aparta', () => {
  const esperado = elQueDeberiaSer();

  if (process.env.KAMAYUK_REGENERAR === '1') {
    writeFileSync(LOCALE, `${JSON.stringify(esperado, null, 2)}\n`, 'utf8');
  }

  const enDisco = JSON.parse(readFileSync(LOCALE, 'utf8')) as Record<string, string>;

  it('EL CENTINELA: la lista trae las claves del marcador', () => {
    // Sin esto, una lista vaciada haria que «no falta ninguna» pasara en verde sobre la nada.
    expect(Object.keys(esperado), 'la lista de claves vino corta').toEqual(
      expect.arrayContaining(['Pago de tributos en línea', 'Municipalidad Distrital de Catacaos']),
    );
    // Y la parte derivada de `MEDIOS`: si la derivacion se vaciara, sus claves faltarian del locale sin
    // que el resto de la lista lo notara.
    expect(Object.keys(esperado), 'la lista no trae lo que dicen los medios de pago').toEqual(
      expect.arrayContaining(['Pagar con tarjeta', 'Los tres dígitos del reverso', 'Ya pagué en el banco']),
    );
    // Y la derivada de `HISTORIAL` y `UNIDADES` (issue 10), por lo mismo.
    expect(Object.keys(esperado), 'la lista no trae lo que dicen los pagos y las unidades').toEqual(
      expect.arrayContaining(['BCP con código', '8.20 m de frontis', 'Base imponible']),
    );
    // Y la derivada de la escalera de la API (issues 13 y 33): si la tabla se vaciara, sus 27
    // claves faltarian del locale sin que el resto de la lista lo notara. Las dos ultimas son las
    // de los peldanos que trae kamayuk-lib#96: mientras ese PR siga abierto NINGUN fallo llega a
    // ellos, asi que sin nombrarlos aqui sus seis frases podrian caerse de la tabla en verde.
    expect(Object.keys(esperado), 'la lista no trae lo que dice la escalera').toEqual(
      expect.arrayContaining([
        'Su sesión ya no está abierta',
        'El portal no está respondiendo',
        'Eso ya no se puede hacer ahora',
        'No pudimos ordenar la lista así',
      ]),
    );
    // Y la derivada del adaptador (issue 28): si `SIN_DETALLE` se vaciara, sus tres claves faltarian
    // del locale sin que el resto de la lista lo notara.
    expect(Object.keys(esperado), 'la lista no trae lo que dice el adaptador de la situacion').toEqual(
      expect.arrayContaining(['Sin detalle del predio', 'Sin unidad asociada']),
    );
  });

  it('no falta ninguna clave, y no sobra ninguna', () => {
    const faltan = Object.keys(esperado).filter((c) => !(c in enDisco));
    const sobran = Object.keys(enDisco).filter((c) => !(c in esperado));
    expect(
      { faltan: faltan.slice(0, 8), sobran: sobran.slice(0, 8) },
      'El locale `es` dejo de cuadrar con lo que el portal dice.\n' +
        '  Se regenera con:  yarn i18n:regenerar',
    ).toEqual({ faltan: [], sobran: [] });
  });

  it('y NINGUN valor se aparta de su clave, salvo los plurales', () => {
    const apartados = Object.entries(enDisco)
      .filter(([clave, valor]) => valor !== (PLURALES[clave] ?? clave))
      .map(([clave, valor]) => `  «${clave}» dice «${valor}»`);
    expect(
      apartados,
      'Hay entradas del locale que dicen algo distinto de su clave:\n' +
        `${apartados.join('\n')}\n\n` +
        '  El castellano esta en dos sitios —el codigo y el locale— y el artboard manda sobre el\n' +
        '  primero. Si el locale puede decir otra cosa, la pantalla se aparta del artboard.',
    ).toEqual([]);
  });
});
