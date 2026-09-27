import { Suspense, useEffect } from 'react';
import { type RouteObject, createHashRouter } from 'react-router-dom';

import { Marco } from './marco/Marco.tsx';
import { PANTALLAS, precargarLasPantallas } from './pasos/pantallas.tsx';
import { useRecorrido } from './recorrido/ProveedorDelRecorrido.tsx';
import { type Paso, TODOS_LOS_PASOS, pasoAlcanzable } from './recorrido/recorrido.ts';
import { RUTA_DEL_PASO } from './recorrido/rutas.ts';

/**
 * **El enrutador del portal**: el marco, y dentro una ruta por paso. Quien manda entre la URL y el
 * recorrido, y a donde se redirige lo que no es alcanzable, lo decide UN gancho del marco
 * (`useLaUrlYElPaso`, en `src/recorrido/rutas.ts`, issue 61); aqui solo se dibuja.
 *
 * Vive fuera de `src/recorrido/` porque monta el marco, y el marco lee el recorrido: dentro, las
 * importaciones darian la vuelta.
 */

/** La pantalla de un paso, si es alcanzable. Si no, nada: el gancho del marco ya esta redirigiendo. */
function PantallaDelPaso({ paso }: { readonly paso: Paso }) {
  const { estado } = useRecorrido();

  // Dibujada la primera pantalla, se piden las demas: cada una es un trozo del bundle (issue 11), y
  // sin esto cada paso nuevo esperaria el suyo en blanco. Pedirlas dos veces no las pide dos veces.
  useEffect(() => {
    void precargarLasPantallas().catch(() => {
      // Sin red no hay nada que hacer aqui: al abrir ese paso, `lazy` lo vuelve a pedir y, si falla,
      // lo dice el limite de errores del enrutador.
    });
  }, []);

  // Mientras se redirige no se dibuja el paso: ni un cuadro de una pantalla a la que no se puede ir.
  if (!pasoAlcanzable(estado, paso)) return null;

  // Una pantalla por paso (issues 5-10), cada una en su trozo (`src/pasos/pantallas.tsx`). Mientras su
  // trozo llega, el hueco se marca ocupado y guarda la altura, para que el pie no suba y baje.
  const { Pantalla } = PANTALLAS[paso];
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-[60vh]" />}>
      <Pantalla />
    </Suspense>
  );
}

export const RUTAS: RouteObject[] = [
  {
    element: <Marco />,
    children: [
      // La raiz y lo que no es ninguna ruta no dibujan nada: el gancho del marco las lleva al paso en
      // que esta el recorrido, con `replace`.
      { index: true, element: null },
      // Los de los DOS recorridos: una ruta que no existiera daria un 404 del enrutador en vez de la
      // redireccion de `PantallaDelPaso`, que es quien dice a donde se puede ir.
      ...TODOS_LOS_PASOS.map((paso) => ({
        path: RUTA_DEL_PASO[paso].slice(1),
        element: <PantallaDelPaso paso={paso} />,
      })),
      { path: '*', element: null },
    ],
  },
];

/**
 * El enrutador del portal. Se crea FUERA del render, como el cliente de consultas de `montaje.tsx`: dentro,
 * `StrictMode` lo crearia dos veces, cada uno escuchando el hash por su cuenta. Las pruebas crean el
 * suyo y lo `dispose()`an al acabar.
 */
export function crearEnrutador() {
  return createHashRouter(RUTAS);
}

export type Enrutador = ReturnType<typeof crearEnrutador>;
