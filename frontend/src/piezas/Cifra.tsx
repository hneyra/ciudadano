import { type Fecha, type Importe as ImporteDecimal, formatearFecha } from '@kamayuk/formato';
import { Importe, cn } from '@kamayuk/ui';
import { cva } from 'class-variance-authority';
import { useTranslation } from 'react-i18next';

import { FECHA_DE_CORTE } from '../datos/constantes.ts';

/**
 * **Una cifra del portal: `Importe` de `@kamayuk/ui`, con su fecha y la letra de su sitio** (issue 60).
 *
 * Hasta el issue 60 habia DOS componentes `Cifra` —uno en el paso 2, en negrita y de bloque; otro en
 * el paso 4, de peso normal— y un tercero, `ImporteDelServidor`, para la cifra que dice su fecha.
 * Los tres eran `Importe` envuelto en un `span` con clases. Ahora es uno:
 *
 *   · **La fecha**: por omision, la de corte de la demostracion (`FECHA_DE_CORTE`), implicita —la dice
 *     la banda del paso 2—. Con `conSuFecha`, se ensena al lado («al 16/09/2026»): cada importe del
 *     servidor trae la suya y el contrato permite que difieran. El rotulo se escribe con `t()` y no se
 *     deja el de la libreria, que dice «al …» sin pasar por el inventario de este portal.
 *   · **El peso**: `Importe` pinta su numero en seminegrita y no admite `className`; donde el artboard
 *     lo quiere en negrita o normal, se le cambia desde fuera con un selector de descendiente.
 *   · Lo demas —el tamano, el color, si es de bloque— lo pone quien la usa, con `className`.
 */

const peso = cva('', {
  variants: {
    peso: { negrita: '[&_span]:font-bold', normal: '[&_span]:font-normal' },
  },
});

export interface CifraProps {
  readonly valor: ImporteDecimal;
  /** A que fecha es la cifra. Por omision, la fecha de corte de la demostracion. */
  readonly aLaFecha?: Fecha;
  /** Si la fecha se ensena al lado. Si no, la dice otro (la banda del total, la cabecera). */
  readonly conSuFecha?: boolean;
  readonly peso?: 'negrita' | 'normal';
  readonly className?: string;
}

export function Cifra({ valor, aLaFecha = FECHA_DE_CORTE, conSuFecha = false, peso: elPeso, className }: CifraProps) {
  const { t } = useTranslation();
  return (
    <span className={cn(peso({ peso: elPeso }), className)}>
      {conSuFecha ? (
        <Importe
          valor={valor}
          fechaCalculo={aLaFecha}
          rotuloDeLaFecha={() => t('al {{fecha}}', { fecha: formatearFecha(aLaFecha) })}
        />
      ) : (
        <Importe valor={valor} fechaCalculo={aLaFecha} fechaImplicita />
      )}
    </span>
  );
}
