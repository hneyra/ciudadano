import { identidad } from './identidad.ts';

/**
 * **Quien entro, leido del token y de ningun otro sitio** (issue 27).
 *
 * <h2>Por que aqui y no en `@kamayuk/sesion`</h2>
 *
 * Porque los claims que importan **son de este realm**: `tipo_documento` y `numero_documento` los
 * pone `kamayuk-ciudadano` y no existen en el realm del back-office, que es el que usan los otros
 * cuatro sistemas. Meterlos en la libreria comun seria que los cuatro arrastraran el vocabulario de
 * un realm que no consultan. Y `kamayuk-lib` no se toca desde un issue de este repositorio.
 *
 * <h2>El token no se verifica aqui, y eso no es un descuido</h2>
 *
 * La firma la comprueba **el backend** en cada peticion; el navegador no tiene con que —no hay
 * clave publica que no haya que ir a buscar, y aunque la hubiera, una comprobacion del lado del
 * cliente no protege de nadie: quien manipule el token manipula tambien el codigo que lo
 * comprobaria—. Lo que se lee de aqui es **solo para dibujar el nombre en la barra**. Ninguna
 * decision de autorizacion cuelga de esto: lo que se puede ver lo decide el servidor, contestando
 * 401 o 403.
 *
 * Y por eso todo lo de abajo devuelve `null` en vez de lanzar: un token con otra forma no puede
 * dejar la barra en blanco ni reventar el arranque. Sin claims, la barra ensena «Iniciar sesion»,
 * que es lo mismo que ensena sin token.
 *
 * <h2>Nada de esto se guarda</h2>
 *
 * Se lee del token en memoria cada vez que se pregunta. La prohibicion `token-en-almacenamiento`
 * sigue encendida en todo el arbol (`verificaciones/el-token-vive-en-memoria.test.ts`), y copiar el
 * nombre a `localStorage` para no volver a descifrarlo seria escribir en el disco del navegador de
 * un equipo compartido —que es donde se paga un tributo— quien acaba de entrar.
 */

/** Lo que el token del portal dice de quien entro. Cada campo puede faltar. */
export interface ClaimsDelCiudadano {
  /** `name`, o `given_name` + `family_name` si el realm no compone el primero. */
  readonly nombre: string | null;
  /** `tipo_documento`: `DNI`, `CE`, … tal como lo escribe el realm. */
  readonly tipoDeDocumento: string | null;
  /** `numero_documento`, tal cual. */
  readonly numeroDeDocumento: string | null;
}

/** Vacio, que es lo que se contesta cuando el token no dice nada de esto. */
const NADA: ClaimsDelCiudadano = { nombre: null, tipoDeDocumento: null, numeroDeDocumento: null };

/** Una cadena con algo dentro, o `null`. Un claim en blanco es un claim que no vino. */
function siTieneAlgo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

/**
 * El cuerpo del JWT, ya descifrado, o `null`.
 *
 * `base64url` y no `base64`: el JWT usa el alfabeto seguro para URL (`-` y `_` en vez de `+` y
 * `/`, y sin relleno), y `atob` no lo entiende. Y el texto se descifra con `TextDecoder` sobre los
 * bytes y no con `atob` a secas: `atob` devuelve una cadena de bytes, asi que «María» saldria
 * «MarÃ­a» — el nombre de la barra es justo donde eso se ve.
 */
function cuerpoDelToken(token: string): Record<string, unknown> | null {
  const partes = token.split('.');
  const carga = partes.length === 3 ? partes[1] : undefined;
  if (carga === undefined || carga === '') return null;

  try {
    const base64 = carga.replaceAll('-', '+').replaceAll('_', '/');
    const bytes = Uint8Array.from(atob(base64), (letra) => letra.charCodeAt(0));
    const leido: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof leido === 'object' && leido !== null ? (leido as Record<string, unknown>) : null;
  } catch {
    // Un token con otra forma no es una averia que haya que ensenar: es «no sabemos quien es».
    return null;
  }
}

/** Lo que dice ESE token. Exportada aparte del de la sesion para poder probarla con uno de mentira. */
export function claimsDe(token: string | null): ClaimsDelCiudadano {
  if (token === null) return NADA;
  const cuerpo = cuerpoDelToken(token);
  if (cuerpo === null) return NADA;

  const nombre = siTieneAlgo(cuerpo['name']);
  const pila = [siTieneAlgo(cuerpo['given_name']), siTieneAlgo(cuerpo['family_name'])].filter(
    (parte): parte is string => parte !== null,
  );

  return {
    nombre: nombre ?? (pila.length === 0 ? null : pila.join(' ')),
    tipoDeDocumento: siTieneAlgo(cuerpo['tipo_documento']),
    numeroDeDocumento: siTieneAlgo(cuerpo['numero_documento']),
  };
}

/** Quien entro en ESTA pestana, segun el token que tenga la puerta ahora mismo. */
export function claimsDelCiudadano(): ClaimsDelCiudadano {
  return claimsDe(identidad.token());
}

/** Si hay sesion abierta: hay token, sin mas. Quien lo dice es la puerta, no una bandera del portal. */
export function haySesion(): boolean {
  return identidad.token() !== null;
}
