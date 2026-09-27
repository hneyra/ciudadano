/**
 * **La muestra de `ninguna-pantalla-decide-el-paso.test.ts`** (issue 61): una linea por forma de
 * mover el recorrido de paso por su cuenta, marcada con `senala`, y al lado lo que se le parece y NO
 * lo es. La prueba compara las lineas que la guarda encuentra con las marcadas: ni una de mas, ni una
 * de menos.
 *
 * Compila con el resto del arbol, pero no la importa nadie.
 */
import {
  Link, // senala
  NavLink as Enlace, // senala
  useNavigate, // senala
  useLocation,
} from 'react-router-dom';

import type { Enrutador } from '../../src/enrutador.tsx';
import type { AccionDelRecorrido, Paso } from '../../src/recorrido/recorrido.ts';

declare function despachar(accion: AccionDelRecorrido): void;
declare const paso: Paso;
declare const tipo: 'irA';
declare const enrutador: Enrutador;

// ── irA ───────────────────────────────────────────────────────────────────────────────────────────

despachar({ tipo: 'irA', paso: 'pagar' }); // senala
despachar({ tipo: 'irA', paso }); // senala
export const guardada: AccionDelRecorrido = { tipo: 'irA', paso: 'deudas' }; // senala
export const conComillas: AccionDelRecorrido = { 'tipo': 'irA', paso: 'deudas' }; // senala
export const conAsConst = { tipo: 'irA' as const, paso: 'historial' as const }; // senala
export const entreParentesis: AccionDelRecorrido = { tipo: ('irA'), paso }; // senala
export const plantilla: AccionDelRecorrido = { tipo: `irA`, paso }; // senala
export const conSatisfies = { tipo: 'irA', paso } satisfies AccionDelRecorrido; // senala
export const abreviada: AccionDelRecorrido = { tipo, paso }; // senala
export const calculada: AccionDelRecorrido = { ['tipo']: 'irA', paso }; // senala
export const sinPaso = { tipo: 'irA' }; // senala
export function devuelta(): AccionDelRecorrido {
  return { paso, tipo: 'irA' }; // senala
}

// ── navegar y rutas ───────────────────────────────────────────────────────────────────────────────

export function Pantalla() {
  const navegar = useNavigate();
  void navegar('/pagar'); // senala
  void enrutador.navigate(-1); // senala
  window.location.hash = '#/comprobante'; // senala
  return (
    <>
      <Link to="/deudas">a</Link> {/* senala */}
      <Enlace to="/historial?desde=menu">b</Enlace> {/* senala */}
      <a href="#/identificar">c</a> {/* senala */}
      <a href={`#/buscar`}>d</a> {/* senala */}
      {/* Lo que se le parece y no se senala: */}
      <a href="#/">e</a>
      <a href="#/pagarlo">f</a>
      <a href="https://example.com/pagar">g</a>
      <p title="/ pagar">h</p>
    </>
  );
}

// ── Lo que se le parece y no se senala ────────────────────────────────────────────────────────────

despachar({ tipo: 'volverAElegir' });
despachar({ tipo: 'noSoyYo' });
export const otraClave = { accion: 'irA', paso };
export const soloElTexto = 'irA';
export const enUnTipo: Extract<AccionDelRecorrido, { tipo: 'irA' }>['tipo'] = 'irA';
export function segun(accion: AccionDelRecorrido): boolean {
  return accion.tipo === 'irA';
}
export const dondeEstoy = useLocation;
