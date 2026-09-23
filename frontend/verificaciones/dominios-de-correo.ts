/**
 * **Que dominio de correo es reservado, y donde vive uno que no lo es** (issue 51).
 *
 * <h2>El defecto que evita</h2>
 *
 * `fruiz159@gmail.com` tenia forma de ser una persona real, no coincidia con la ficha de ejemplo
 * («Maria E. Castillo») y viajaba en el paquete de produccion. Un correo de mentira que apunta a un
 * dominio registrable —`gmail.com`, `correo.com`, `correo.pe`— puede ser, sin que nadie lo decida,
 * el buzon de alguien: el issue 51 lo cambia por dominios que las RFC reservan para que nadie los
 * registre nunca.
 *
 * <h2>Por que funciones puras sobre `(dominio)` y `(texto)`</h2>
 *
 * Por lo mismo que `colores-propios.ts` (rentas#140): se ejercen sobre cadenas inventadas, sin leer
 * ni un archivo, y la guarda que recorre el arbol (`los-correos-usan-dominio-reservado.test.ts`) es
 * una capa aparte, delgada, que solo decide QUE archivos mirar.
 *
 * <h2>Los dominios reservados</h2>
 *
 * RFC 2606 reserva `example.com`, `example.net`, `example.org` y los TLD `.example`, `.test`,
 * `.invalid`; RFC 6761 reserva ademas `localhost`. Son los unicos nombres que un correo de mentira
 * puede usar sin correr el riesgo de apuntar a un buzon de verdad: ninguna autoridad los vende, y
 * las RFC piden a quien resuelve nombres que nunca los saque a Internet. Un subdominio de los tres
 * primeros (`ventanilla.example.com`) cuenta tambien: sigue sin ser registrable por nadie.
 */

/** Los tres dominios base de RFC 2606, mas `localhost` (RFC 6761): exactos o con subdominio. */
const DOMINIOS_BASE = ['example.com', 'example.org', 'example.net', 'localhost'] as const;

/** Los TLD reservados de RFC 2606: cualquier dominio que acabe en uno de estos vale. */
const TLDS_RESERVADOS = ['.example', '.test', '.invalid'] as const;

/** Si `dominio` (tal cual sigue al `@`) es uno de los reservados, exacto o por subdominio. */
export function esDominioReservado(dominio: string): boolean {
  const d = dominio.toLowerCase();
  if (DOMINIOS_BASE.some((base) => d === base || d.endsWith(`.${base}`))) return true;
  return TLDS_RESERVADOS.some((tld) => d.endsWith(tld));
}

export interface CorreoEncontrado {
  /** La linea del texto, contada desde 1 como la cuenta un editor. */
  readonly linea: number;
  /** La direccion completa, tal como aparece. */
  readonly correo: string;
  /** Lo que sigue al `@`. */
  readonly dominio: string;
}

/**
 * Una direccion de correo: local-part arroba dominio-con-al-menos-un-punto. No pretende validar
 * RFC 5322 entero —no hace falta—, solo reconocer lo que un correo escrito a mano parece ser sin
 * confundirse con un paquete con ambito (`@kamayuk/api`, que no trae un punto tras el `@`) ni con
 * una version (`core@^7.26.10`, que tras el `@` no trae letras de dominio).
 */
const PATRON_DE_CORREO = /[A-Za-z0-9._%+-]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

/** Las direcciones de `texto` cuyo dominio NO es reservado, con su linea. */
export function correosNoReservados(texto: string): CorreoEncontrado[] {
  const salida: CorreoEncontrado[] = [];
  texto.split('\n').forEach((linea, indice) => {
    for (const coincidencia of linea.matchAll(PATRON_DE_CORREO)) {
      const dominio = coincidencia[1];
      if (dominio !== undefined && !esDominioReservado(dominio)) {
        salida.push({ linea: indice + 1, correo: coincidencia[0], dominio });
      }
    }
  });
  return salida;
}
