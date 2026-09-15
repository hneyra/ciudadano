import { useEffect, useRef } from 'react';
import { Navigate, type RouteObject, createHashRouter, useNavigate } from 'react-router-dom';

import { Marco } from './marco/Marco.tsx';
import { Buscar } from './pasos/buscar/Buscar.tsx';
import { Comprobante } from './pasos/comprobante/Comprobante.tsx';
import { Deudas } from './pasos/deudas/Deudas.tsx';
import { Historial } from './pasos/historial/Historial.tsx';
import { Identificar } from './pasos/identificar/Identificar.tsx';
import { Pagar } from './pasos/pagar/Pagar.tsx';
import { useRecorrido } from './recorrido/ProveedorDelRecorrido.tsx';
import { type Paso, pasoAlcanzable, ultimoAlcanzable } from './recorrido/recorrido.ts';
import { RUTA_DEL_PASO } from './recorrido/rutas.ts';

/**
 * **El enrutador del portal**: el marco, y dentro una ruta por paso. Como decide cada ruta, y quien
 * manda entre la URL y el reductor, esta en `src/recorrido/rutas.ts`.
 *
 * Vive fuera de `src/recorrido/` porque monta el marco, y el marco lee el recorrido: dentro, las
 * importaciones darian la vuelta.
 */

/** (2) Cuando la URL nombra un paso: si es alcanzable el estado la sigue; si no, se redirige. */
function PantallaDelPaso({ paso }: { readonly paso: Paso }) {
  const { estado, despachar } = useRecorrido();
  const navegar = useNavigate();
  const alcanzable = pasoAlcanzable(estado, paso);
  const visto = useRef<Paso | null>(null);

  useEffect(() => {
    if (visto.current === paso) return;
    visto.current = paso;
    if (!alcanzable) navegar(RUTA_DEL_PASO[ultimoAlcanzable(estado)], { replace: true });
    else if (estado.paso !== paso) despachar({ tipo: 'irA', paso });
  }, [paso, alcanzable, estado, despachar, navegar]);

  // Mientras se redirige no se dibuja el paso: ni un cuadro de una pantalla a la que no se puede ir.
  if (!alcanzable) return null;

  // Una pantalla por paso (issues 5-10). Ya no queda ningun marcador.
  switch (paso) {
    case 'buscar':
      return <Buscar />;
    case 'deudas':
      return <Deudas />;
    case 'identificar':
      return <Identificar />;
    case 'pagar':
      return <Pagar />;
    case 'comprobante':
      return <Comprobante />;
    case 'historial':
      return <Historial />;
  }
}

/** La raiz y lo que no es ninguna ruta: al paso en que esta el recorrido. */
function AlPasoActual() {
  const { estado } = useRecorrido();
  return <Navigate replace to={RUTA_DEL_PASO[ultimoAlcanzable(estado)]} />;
}

const PASOS: readonly Paso[] = ['buscar', 'deudas', 'identificar', 'pagar', 'comprobante', 'historial'];

export const RUTAS: RouteObject[] = [
  {
    element: <Marco />,
    children: [
      { index: true, element: <AlPasoActual /> },
      ...PASOS.map((paso) => ({ path: RUTA_DEL_PASO[paso].slice(1), element: <PantallaDelPaso paso={paso} /> })),
      { path: '*', element: <AlPasoActual /> },
    ],
  },
];

/**
 * El enrutador del portal. Se crea FUERA del render, como el cliente de consultas de `main.tsx`: dentro,
 * `StrictMode` lo crearia dos veces, cada uno escuchando el hash por su cuenta. Las pruebas crean el
 * suyo y lo `dispose()`an al acabar.
 */
export function crearEnrutador() {
  return createHashRouter(RUTAS);
}

export type Enrutador = ReturnType<typeof crearEnrutador>;
