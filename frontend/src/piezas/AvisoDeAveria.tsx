import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * **El aviso de una averia**: la caja con el filo y el papel de `mal`, su titulo, y lo que se diga
 * debajo (issue 67).
 *
 * Lo usan «No se pudo abrir su sesion» (`src/aplicacion.tsx`, issue 13) y «No se pudo mostrar esta
 * pantalla» (`src/marco/NoSePudoMostrar.tsx`, issue 67). Hasta el issue 67 la caja vivia dentro del
 * primero. Las mismas clases lleva el aviso de `src/inicio.ts`, escrito con el DOM a pelo porque sale
 * justo cuando React puede no haber llegado.
 *
 * `alerta` le pone `role="alert"`: para lo que aparece EN LUGAR de lo que habia, que tiene que
 * anunciarse sin mover el foco.
 */
export function AvisoDeAveria({
  titulo,
  alerta = false,
  children,
}: {
  readonly titulo: string;
  readonly alerta?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div
      role={alerta ? 'alert' : undefined}
      className="max-w-[64ch] border border-mal-borde bg-mal-fondo p-[20px] text-[14px] leading-[1.6]"
    >
      <p className="m-0 font-bold text-mal-tinta">{titulo}</p>
      {children}
    </div>
  );
}

/** Lo que se puede hacer ante cualquier averia del portal: recargar, y si no, la ventanilla. */
export function RemedioDeLaAveria() {
  const { t } = useTranslation();
  return (
    <p className="mt-[10px] mb-0 text-tinta-2 text-pretty">
      {t(
        'Vuelva a cargar la página e inténtelo otra vez. Si sigue igual, puede consultar y pagar en la ventanilla de la municipalidad.',
      )}
    </p>
  );
}

/** El aviso solo en la pagina, centrado sobre el fondo: cuando no queda nada mas que dibujar. */
export function APantallaEntera({ children }: { readonly children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-fondo p-[30px]">{children}</div>;
}
