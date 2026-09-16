import { useTranslation } from 'react-i18next';

import { AvisoConFilo } from './AvisoConFilo.tsx';

/**
 * **El pago con plataforma es una demostracion, y se dice** (issue 28).
 *
 * <h2>Que hay detras, medido</h2>
 *
 * El portal ya lee la deuda de verdad (`GET /portal/situacion`), pero **no hay endpoint de cobro**:
 * la decision D-14 sigue abierta y no existe ni la orden de pago ni la pasarela. Los pasos «Pagar» y
 * «Comprobante» dibujan el recorrido entero —los cuatro medios, el resumen, el recibo— y no envian
 * nada a ningun sitio.
 *
 * <h2>Por que un aviso permanente y no uno que se cierra</h2>
 *
 * Porque lo que hay que impedir es que alguien crea que pago. Un aviso que se cierra se cierra, y lo
 * que queda debajo es una pantalla con un boton verde que dice «Pagar con tarjeta» y un recibo con
 * un numero de operacion: la conclusion honesta de quien lo lea es que su deuda esta saldada, y con
 * esa conclusion se deja de ir a la ventanilla. Por eso va arriba, en los DOS pasos, sin cierre, y
 * el boton de confirmar lo repite en su propio texto — que es lo ultimo que se lee antes de pulsar.
 *
 * **Sin `role`**, como la amnistia y por el mismo motivo (`AvisoConFilo`): esta en la pantalla desde
 * que se dibuja y no es la consecuencia de nada que la persona acabe de hacer, asi que una region
 * viva no tendria nada que anunciar. Se lee en su sitio, que es el primero.
 */
export function AvisoDePagoSimulado() {
  const { t } = useTranslation();

  return (
    <AvisoConFilo tono="atencion" className="mb-[18px] px-[18px] py-[15px] leading-[1.6]">
      <strong>{t('El pago en línea todavía no está disponible: esta pantalla es una demostración.')}</strong>{' '}
      {t(
        'Puede recorrerla entera, pero no se cobra nada y su deuda no cambia. Para pagar de verdad, acérquese con su documento a la ventanilla de la municipalidad.',
      )}
    </AvisoConFilo>
  );
}
