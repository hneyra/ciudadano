import { parse } from 'yaml';

/**
 * **El workflow de la CI, leido como YAML** (issue 63).
 *
 * `andamiaje.test.ts` y `motor.ts` lo leian por lineas: quitaban los comentarios a mano —la prosa del
 * workflow nombra las ordenes que explica— y cortaban cada trabajo con una expresion regular sobre su
 * sangria. Aqui lo lee un lector de YAML (`yaml`, el que ya traian Vite e `i18next-cli`), y las guardas
 * navegan `jobs.<trabajo>.steps` como lo navega GitHub: un comentario no es un dato, un paso es un
 * paso aunque cambie su sangria, y el orden de los pasos es el de la lista.
 *
 * Solo se tipa lo que las guardas preguntan.
 */

export interface Paso {
  readonly name?: string;
  readonly id?: string;
  readonly uses?: string;
  readonly run?: string;
  readonly if?: string;
  readonly with?: Readonly<Record<string, unknown>>;
  readonly 'working-directory'?: string;
}

export interface Trabajo {
  readonly needs?: string | readonly string[];
  readonly 'timeout-minutes'?: number;
  readonly steps?: readonly Paso[];
}

export interface Workflow {
  readonly on?: Readonly<Record<string, { readonly paths?: readonly string[] } | null>>;
  readonly jobs?: Readonly<Record<string, Trabajo>>;
}

/**
 * El workflow, o el error del lector si no es YAML. Sin excepcion: leido en la recoleccion de una
 * prueba, un YAML roto se llevaria por delante todos sus casos en vez de poner uno en rojo.
 */
export function leerElWorkflow(crudo: string): { readonly workflow: Workflow; readonly error: string | null } {
  try {
    const leido: unknown = parse(crudo);
    return { workflow: typeof leido === 'object' && leido !== null ? (leido as Workflow) : {}, error: null };
  } catch (error) {
    return { workflow: {}, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Los trabajos, por nombre; ninguno si el workflow no se lee. */
export function trabajosDelWorkflow(crudo: string): Readonly<Record<string, Trabajo>> {
  return leerElWorkflow(crudo).workflow.jobs ?? {};
}

/** Las lineas de la orden de un paso, sin la sangria: un `run: |` es un guion de varias. */
export function lineasDe(paso: Paso | undefined): readonly string[] {
  return (paso?.run ?? '').split('\n').map((linea) => linea.trim());
}
