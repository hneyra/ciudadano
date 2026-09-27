import { Boton, cn } from '@kamayuk/ui';
import { useTranslation } from 'react-i18next';

/**
 * **«Reintentar la consulta»**: vuelve a pedir `GET /portal/situacion` (issues 27 y 49).
 *
 * `useLaSituacion` no reintenta solo —un 401 reintentado tres veces son tres 401—, y aqui manda quien
 * lee. Lo ofrecen el paso 2 (`FinalesDeLaConsulta.tsx`) y «Lo que queda pendiente» de «Mis pagos»,
 * que hasta el issue 60 lo escribian cada uno con sus clases.
 */
export function Reintentar({ alReintentar, className }: { readonly alReintentar: () => void; readonly className?: string }) {
  const { t } = useTranslation();
  return (
    <Boton type="button" onClick={alReintentar} className={cn('min-h-[44px] px-5 py-0 text-[14.5px]', className)}>
      {t('Reintentar la consulta')}
    </Boton>
  );
}
