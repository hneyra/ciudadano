import { crearCliente, type Cliente } from '@kamayuk/api';

import { identidad } from './identidad.ts';
import { PREFIJO } from './prefijo.ts';

/**
 * **El cliente HTTP del portal: el de `@kamayuk/api`, con el prefijo y el token de aqui**
 * (issue 13).
 *
 * <h2>Por que no hay ni una linea de transporte en este archivo</h2>
 *
 * Porque el transporte es del producto y no de este portal: `solicitar()`, `descargar()`,
 * `subir()`, el `problem+json` de RFC 9457, la clave de idempotencia y la cabecera `Authorization`
 * viven en `@kamayuk/api`. Lo unico que la libreria no puede saber son las dos cosas de abajo, que
 * son las que este archivo dice. `rentas` tiene su propia copia (`src/api/cliente.ts`, 154 lineas)
 * porque es anterior al paquete; aqui se nace sin ella.
 *
 * <h2>El `municipalidadId` no se manda, y no se puede mandar (regla 2, ADR-0005)</h2>
 *
 * `OpcionesDeSolicitud` no tiene ninguna cabecera libre, asi que no hay por donde colar el
 * inquilino; y el unico endpoint del ciudadano —`GET /portal/situacion`— no lleva **ningun**
 * parametro: el sujeto sale del claim del token. La prohibicion `municipalidad-en-el-cliente` de
 * ESLint sigue encendida aqui, como en todo el arbol.
 */

/**
 * La raiz de la API se reexporta desde aqui, que es de donde la pide quien compone una peticion.
 *
 * Escrita, una sola vez, en `./prefijo.ts`: ahi esta el porque de que viva en un archivo hoja y no
 * en este. Quien la vigila es `verificaciones/camino-a-la-api.test.ts`.
 */
export { PREFIJO } from './prefijo.ts';

/**
 * El cliente de este portal. Uno, de modulo, como la puerta.
 *
 * **El token entra como FUNCION y no como valor**, y eso no es estilo: el token cambia dentro de la
 * vida de la pagina —no hay ninguno hasta que el canje termina— y un valor leido al construir el
 * cliente seria `null` para siempre, con la primera peticion despues del canje saliendo sin
 * cabecera. Se pasa `identidad.token` y no `() => identidad.token()` porque `crearIdentidad`
 * devuelve un objeto de cierre: el metodo no depende de `this`.
 */
export const cliente: Cliente = crearCliente({ prefijo: PREFIJO, token: identidad.token });
