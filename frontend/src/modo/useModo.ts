import { useRecorrido } from '../recorrido/ProveedorDelRecorrido.tsx';
import type { PoliticaDelModo } from './modo.ts';

/**
 * **Lo que el modo decide, para una pantalla** (issue 59).
 *
 * El UNICO sitio del que una pantalla saca algo que depende del modo. Devuelve la politica que el
 * recorrido fijo al montar (`estado.politica`), no el modo: la pantalla pregunta «¿el pago es
 * simulado?», «¿de donde sale la deuda?», «¿de quien es la sesion?», y no «¿estoy con plataforma?».
 *
 * De la politica del ESTADO, y no de la fuente otra vez: hasta el issue 59 el modo se leia de los dos
 * sitios —`estado.conPlataforma` en unas pantallas, `hayPlataforma(fuente)` en otras— y una prueba que
 * montara un estado de un modo con la fuente del otro veia dos portales a la vez.
 */
export function useModo(): PoliticaDelModo {
  return useRecorrido().estado.politica;
}
