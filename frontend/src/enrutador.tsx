import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, type RouteObject, createHashRouter, useNavigate } from 'react-router-dom';

import { Marco } from './marco/Marco.tsx';
import { Buscar } from './pasos/buscar/Buscar.tsx';
import { Deudas } from './pasos/deudas/Deudas.tsx';
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

/**
 * El titulo de cada paso, para el marcador que lo ocupa hasta que llegue su pantalla (issues 6-10).
 * Son los encabezados del artboard: lineas 126, 224, 314, 360, 1276 y 570. El de `buscar` ya no lo
 * dibuja ningun marcador —su pantalla lleva el mismo `h1`— y sigue aqui para que el `switch` cubra
 * todos los pasos. El de `deudas` tampoco: es el `h1` de su pantalla (issue 6).
 */
function useTituloDelPaso(paso: Paso): string {
  const { t } = useTranslation();
  switch (paso) {
    case 'buscar':
      return t('Consulte y pague sus tributos');
    case 'deudas':
      return t('Lo que debe, por concepto');
    case 'identificar':
      return t('¿A dónde le enviamos el comprobante?');
    case 'pagar':
      return t('¿Cómo quiere pagar?');
    case 'comprobante':
      return t('Su pago se registró');
    case 'historial':
      return t('Mis pagos');
  }
}

/** (2) Cuando la URL nombra un paso: si es alcanzable el estado la sigue; si no, se redirige. */
function PantallaDelPaso({ paso }: { readonly paso: Paso }) {
  const { estado, despachar } = useRecorrido();
  const navegar = useNavigate();
  const titulo = useTituloDelPaso(paso);
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

  // Las pantallas que ya llegaron (issues 5 y 6); los demas pasos siguen con su marcador.
  if (paso === 'buscar') return <Buscar />;
  if (paso === 'deudas') return <Deudas />;

  return (
    <h1 className="m-0 text-[27px] font-bold text-azul" data-paso={paso}>
      {titulo}
    </h1>
  );
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
