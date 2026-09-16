import { Suspense, useEffect, useRef } from 'react';
import { Navigate, type RouteObject, createHashRouter, useNavigate } from 'react-router-dom';

import { Marco } from './marco/Marco.tsx';
import { PANTALLAS, precargarLasPantallas } from './pasos/pantallas.tsx';
import { useRecorrido } from './recorrido/ProveedorDelRecorrido.tsx';
import { type Paso, TODOS_LOS_PASOS, pasoAlcanzable, ultimoAlcanzable } from './recorrido/recorrido.ts';
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

  // Dibujada la primera pantalla, se piden las demas: cada una es un trozo del bundle (issue 11), y
  // sin esto cada paso nuevo esperaria el suyo en blanco. Pedirlas dos veces no las pide dos veces.
  useEffect(() => {
    void precargarLasPantallas().catch(() => {
      // Sin red no hay nada que hacer aqui: al abrir ese paso, `lazy` lo vuelve a pedir y, si falla,
      // lo dice el limite de errores del enrutador.
    });
  }, []);

  // Mientras se redirige no se dibuja el paso: ni un cuadro de una pantalla a la que no se puede ir.
  if (!alcanzable) return null;

  // Una pantalla por paso (issues 5-10), cada una en su trozo (`src/pasos/pantallas.tsx`). Mientras su
  // trozo llega, el hueco se marca ocupado y guarda la altura, para que el pie no suba y baje.
  const { Pantalla } = PANTALLAS[paso];
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-[60vh]" />}>
      <Pantalla />
    </Suspense>
  );
}

/** La raiz y lo que no es ninguna ruta: al paso en que esta el recorrido. */
function AlPasoActual() {
  const { estado } = useRecorrido();
  return <Navigate replace to={RUTA_DEL_PASO[ultimoAlcanzable(estado)]} />;
}

export const RUTAS: RouteObject[] = [
  {
    element: <Marco />,
    children: [
      { index: true, element: <AlPasoActual /> },
      // Los de los DOS recorridos: una ruta que no existiera daria un 404 del enrutador en vez de la
      // redireccion de `PantallaDelPaso`, que es quien dice a donde se puede ir.
      ...TODOS_LOS_PASOS.map((paso) => ({
        path: RUTA_DEL_PASO[paso].slice(1),
        element: <PantallaDelPaso paso={paso} />,
      })),
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
