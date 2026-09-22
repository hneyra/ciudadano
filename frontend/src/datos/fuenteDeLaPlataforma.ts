import type { Cliente } from '@kamayuk/api';

import { cliente as elCliente } from '../api/cliente.ts';
import { leerLaSituacion } from './contrato.ts';
import { deLaSituacion } from './deLaSituacion.ts';
import type { FuenteDelPortal } from './fuente.ts';
import type { PagoDelHistorial, SituacionDelServidor, Unidad } from './tipos.ts';

/**
 * **La fuente de la plataforma: `GET /portal/situacion`, y nada mas** (issue 27).
 *
 * Es la otra mitad del doble modo. Aqui no hay ni una cifra escrita ni una regla de negocio: se
 * pide, se pasa la respuesta por el adaptador de `deLaSituacion.ts` (issue 26) y se devuelve. El
 * transporte —el token en la cabecera, el `problem+json` de RFC 9457 convertido en `ErrorDeLaApi`,
 * el prefijo `/rentas/api/v1`— es del cliente de `src/api/cliente.ts` (issue 25).
 *
 * <h2>Entre el cable y el adaptador, la frontera</h2>
 *
 * Desde el issue 34, lo que contesta el servidor pasa por `leerLaSituacion` (`contrato.ts`) ANTES
 * de tocar el adaptador. Si no tiene la forma del contrato, la consulta rechaza con
 * `RespuestaQueNoEntiendo` y `deLaSituacion` no llega a verlo: el adaptador sigue siendo puro y
 * recibe algo ya valido, y la pantalla dibuja el fallo con su peldano en vez de reventar a mitad
 * de una cuenta.
 *
 * <h2>La peticion NO lleva parametros, y no es un olvido</h2>
 *
 * ADR-0020 retiro `GET /portal/deuda?doc=` por ser una enumeracion de contribuyentes: cualquiera
 * podia preguntar por el documento de cualquiera. Lo reemplazo por esta, **sin parametros**, donde
 * el sujeto sale de los claims del token. Por eso la fuente no recibe un documento que pasarle: no
 * hay donde ponerlo, y ponerlo seria volver a abrir lo que el ADR cerro.
 *
 * <h2>Se construye con el cliente que se le da, y por eso se puede probar</h2>
 *
 * `crearFuenteDeLaPlataforma(cliente)` toma el cliente como argumento y `fuenteDeLaPlataforma` es la
 * instancia con el de verdad. Asi una prueba le da un cliente falso y mide **la ruta exacta que se
 * pide y cuantas veces**, que es lo que un modulo que importara el cliente por su cuenta no dejaria
 * medir sin sustituir el modulo entero.
 *
 * <h2>El historial y las unidades todavia no existen en el servidor, y se dice</h2>
 *
 * No hay endpoint de pagos del ciudadano ni de sus unidades: lo unico que el backend publica para
 * este portal es la situacion. Las dos lecturas **rechazan con su motivo** en vez de devolver una
 * lista vacia: una lista vacia diria «no tiene pagos», que es una afirmacion sobre su historia que
 * nadie ha comprobado, y la pantalla la dibujaria como un hecho. Rechazar deja que «Mis pagos»
 * ensene su estado de error, que es la verdad de hoy. Lo que esa pantalla debe decir con plataforma
 * es del issue 28.
 */

/** La ruta, relativa al prefijo del cliente (`/rentas/api/v1`). Escrita una vez. */
export const RUTA_DE_LA_SITUACION = '/portal/situacion';

/** Lo que se dice cuando se pide algo que el portal todavia no publica. */
export const NO_LO_PUBLICA_EL_PORTAL =
  'El portal todavia no publica esta lectura: el backend solo ofrece GET /portal/situacion. Ver el issue 28.';

function noPublicado<T>(): Promise<T> {
  return Promise.reject(new Error(NO_LO_PUBLICA_EL_PORTAL));
}

/** La fuente que habla con la plataforma, con el cliente que se le de. */
export function crearFuenteDeLaPlataforma(cliente: Cliente): FuenteDelPortal {
  return {
    consulta: async (): Promise<SituacionDelServidor> =>
      // `unknown` y no el tipo del contrato: lo que trae el cable no tiene forma hasta que
      // `leerLaSituacion` la comprueba (issue 34). El adaptador solo ve lo que paso la frontera.
      deLaSituacion(leerLaSituacion(await cliente.solicitar<unknown>(RUTA_DE_LA_SITUACION))),
    historial: (): Promise<readonly PagoDelHistorial[]> => noPublicado(),
    unidades: (): Promise<readonly Unidad[]> => noPublicado(),
  };
}

/** La de verdad, con el cliente del portal. La elige `laFuente.ts` cuando hay plataforma. */
export const fuenteDeLaPlataforma: FuenteDelPortal = crearFuenteDeLaPlataforma(elCliente);
