/**
 * **La muestra de `ninguna-pantalla-decide-el-paso.test.ts`** (issue 61): una linea por forma de
 * despachar `irA`, marcada con `senala`, y al lado lo que se le parece y NO lo es. La prueba compara
 * las lineas que la guarda encuentra con las marcadas: ni una de mas, ni una de menos.
 *
 * Compila con el resto del arbol, pero no la importa nadie.
 */
import type { AccionDelRecorrido, Paso } from '../../src/recorrido/recorrido.ts';

declare function despachar(accion: AccionDelRecorrido): void;
declare const paso: Paso;

// ── Lo que se senala ──────────────────────────────────────────────────────────────────────────────

despachar({ tipo: 'irA', paso: 'pagar' }); // senala
despachar({ tipo: 'irA', paso }); // senala
export const guardada: AccionDelRecorrido = { tipo: 'irA', paso: 'deudas' }; // senala
export const conComillas: AccionDelRecorrido = { 'tipo': 'irA', paso: 'deudas' }; // senala
export const conAsConst = { tipo: 'irA' as const, paso: 'historial' as const }; // senala
export const entreParentesis: AccionDelRecorrido = { tipo: ('irA'), paso }; // senala
export const plantilla: AccionDelRecorrido = { tipo: `irA`, paso }; // senala
export const conSatisfies = { tipo: 'irA', paso } satisfies AccionDelRecorrido; // senala
export function devuelta(): AccionDelRecorrido {
  return { paso, tipo: 'irA' }; // senala
}

// ── Lo que se le parece y no se senala ────────────────────────────────────────────────────────────

despachar({ tipo: 'volverAElegir' });
despachar({ tipo: 'irAlInicio' });
export const otraClave = { accion: 'irA', paso };
export const soloElTexto = 'irA';
export const enUnTipo: Extract<AccionDelRecorrido, { tipo: 'irA' }>['tipo'] = 'irA';
export function segun(accion: AccionDelRecorrido): boolean {
  return accion.tipo === 'irA';
}
