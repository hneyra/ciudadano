/**
 * **La muestra de `el-modo-se-lee-en-su-modulo.test.ts`** (issue 59): una linea por forma de leer el
 * modo, marcada con `senala`, y al lado lo que se le parece y NO es leer el modo. La prueba compara
 * las lineas que la guarda encuentra con las marcadas: ni una de mas, ni una de menos.
 *
 * Compila con el resto del arbol (los tipos hacen falta para saber de quien es cada propiedad), pero
 * no la importa nadie.
 */
import type { FuenteDelPortal } from '../../src/datos/fuente.ts';
import type { EnDemostracion, Modo, PoliticaDelModo } from '../../src/modo/modo.ts';

declare const fuente: FuenteDelPortal;
declare const modo: Modo;
declare const politica: PoliticaDelModo;
// Declarar el booleano ya es volver a tenerlo, aunque sea en un tipo.
declare const estado: { readonly conPlataforma: boolean }; // senala
declare function elTema(): { readonly modo: 'claro' | 'oscuro' };

// ── Lo que se senala ──────────────────────────────────────────────────────────────────────────────

export const porPunto = fuente.modo === 'plataforma'; // senala
export const delModo = modo.modo; // senala
export const porCorchete = fuente['modo']; // senala
export const { modo: desestructurado } = fuente; // senala
export const preguntaSiEsta = 'consulta' in fuente; // senala
export const losDatos = (modo as EnDemostracion).demostracion; // senala
export const elBooleanoDeVuelta = estado.conPlataforma; // senala
export const elBooleanoPorCorchete = estado['conPlataforma']; // senala
export function hayPlataforma(): boolean { // senala
  return false;
}

// ── Lo que se le parece y no es leer el modo ──────────────────────────────────────────────────────

// El `modo` del tema —claro u oscuro— es otra propiedad, declarada en otra parte.
export const { modo: delTema } = elTema();
export const delTemaPorPunto = elTema().modo;
// Escribir el discriminante en un literal es DEFINIR un modo, no leerlo.
export const escrito: Modo = { modo: 'plataforma' };
// Preguntar a la politica es lo que se pide.
export const simulado = politica.pagoSimulado;
export const deDondeSale = politica.deuda === 'de-la-consulta';
// Lo que toda fuente sabe, este en el modo que este, tampoco es del modo.
export const amnistia = fuente.amnistia;
