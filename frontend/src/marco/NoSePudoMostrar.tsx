import { Boton } from '@kamayuk/ui';
import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { AvisoDeAveria, RemedioDeLaAveria } from '../piezas/AvisoDeAveria.tsx';

/**
 * **«No se pudo mostrar esta pantalla»: lo que queda cuando algo revienta al DIBUJAR** (issue 67).
 *
 * Hasta el issue 67 un error de React despues de montar no lo recogia nadie fuera del enrutador:
 * React 19 desmonta la raiz entera y la pagina se queda en blanco. Y dentro del enrutador lo recogia
 * el limite por omision de React Router, en ingles y con la pila del error a la vista.
 *
 * Dice solo lo que se sabe: que esta pantalla no se pudo mostrar, y que hacer. No sabe si fue la red
 * —un trozo que no llego— o un fallo del portal, ni que paso con lo que la persona estaba haciendo,
 * asi que no lo dice. El mensaje del error tampoco: es para la consola, donde React ya lo deja.
 *
 * `recargar` es para las pruebas: `location.reload` no se puede espiar en jsdom.
 */
export function NoSePudoMostrar({ recargar = recargarLaPagina }: { readonly recargar?: () => void }) {
  const { t } = useTranslation();

  return (
    <AvisoDeAveria titulo={t('No se pudo mostrar esta pantalla')} alerta>
      <RemedioDeLaAveria />
      <Boton type="button" onClick={recargar} className="mt-[14px] min-h-[44px] px-5 py-0 text-[14.5px]">
        {t('Volver a cargar')}
      </Boton>
    </AvisoDeAveria>
  );
}

function recargarLaPagina(): void {
  window.location.reload();
}

interface PropsDelLimite {
  /** Lo que se dibuja en lugar de `children` si algo de dentro revienta al dibujar. */
  readonly alFallar: ReactNode;
  readonly children: ReactNode;
}

/**
 * **El limite de errores de la raiz** (issue 67), montado en `src/montaje.tsx` por fuera de todo lo
 * que el portal dibuja: el tema, el recorrido, el enrutador, la espera del canje.
 *
 * Una clase porque React solo recoge errores con `getDerivedStateFromError`, que no tiene gancho. No
 * se recupera sola: lo que revento volveria a reventar, y el remedio que ofrece el aviso es recargar.
 */
export class LimiteDeErrores extends Component<PropsDelLimite, { readonly fallo: boolean }> {
  override state = { fallo: false };

  static getDerivedStateFromError(): { readonly fallo: boolean } {
    return { fallo: true };
  }

  override render(): ReactNode {
    return this.state.fallo ? this.props.alFallar : this.props.children;
  }
}
