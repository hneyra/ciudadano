import { zodResolver } from '@hookform/resolvers/zod';
import { Boton, Campo, Casilla, Etiqueta, Formulario } from '@kamayuk/ui';
import { useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { MEDIDAS_DE_CONTROL, Rotulo } from '../../piezas/Rotulo.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { MensajeDeError, Tarjeta, conError } from './piezas.tsx';
import { correoCompleto } from './vista.ts';

/**
 * **«Solo con mi correo»** (artboard, lineas 316-332): a donde se envia el comprobante, sin cuenta. El
 * error se borra al escribir y no se recalcula (`reValidateMode: 'onSubmit'`), como `onCorreo` del
 * artboard.
 */

interface ValoresDelCorreo {
  correo: string;
  avisarVencimiento: boolean;
}

export function SoloConMiCorreo() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelError = useId();

  const esquema = useMemo(
    () =>
      z.object({
        correo: z
          .string()
          .trim()
          .min(1, t('Escriba un correo para poder enviarle el comprobante.'))
          .refine(correoCompleto, t('Ese correo no parece completo. Revíselo: le enviaremos el comprobante ahí.')),
        avisarVencimiento: z.boolean(),
      }),
    [t],
  );

  const form = useForm<ValoresDelCorreo>({
    resolver: zodResolver(esquema),
    // Lo que ya se dio, si se vuelve a este paso desde «Pagar».
    defaultValues: { correo: estado.correo, avisarVencimiento: estado.avisarVencimiento },
    reValidateMode: 'onSubmit',
  });
  const error = form.formState.errors.correo?.message;

  const alEnviar = ({ correo, avisarVencimiento }: ValoresDelCorreo) => {
    despachar({ tipo: 'continuarConCorreo', correo, avisarVencimiento });
  };

  return (
    <Tarjeta
      titulo={t('Solo con mi correo')}
      texto={t(
        'Lo más rápido. No hace falta crear una cuenta; el comprobante le llega al correo y lo podrá descargar al terminar.',
      )}
      className="border-t-azul"
    >
      <Formulario form={form} alEnviar={alEnviar} className="[&_label]:mb-[6px]">
        <Controller
          control={form.control}
          name="correo"
          render={({ field }) => (
            <Etiqueta rotulo={<Rotulo>{t('Correo electrónico')}</Rotulo>}>
              <Campo
                {...field}
                type="email"
                autoComplete="email"
                placeholder={t('nombre@example.com')}
                onChange={(evento) => {
                  field.onChange(evento);
                  form.clearErrors('correo');
                }}
                {...conError(error !== undefined, idDelError)}
                className={MEDIDAS_DE_CONTROL}
              />
            </Etiqueta>
          )}
        />
        {error === undefined ? null : <MensajeDeError id={idDelError}>{error}</MensajeDeError>}

        <Controller
          control={form.control}
          name="avisarVencimiento"
          render={({ field }) => (
            // La etiqueta envuelve la casilla y su texto, como en el artboard (linea 328): pulsar el
            // texto la alterna. La caja con filo de `Casilla` se deja sin filo ni papel, como en el
            // paso 2, apuntando a su `data-slot`.
            <label className="mt-[14px] flex cursor-pointer items-start gap-[10px] [&_[data-slot=casilla-caja]]:border-0 [&_[data-slot=casilla-caja]]:bg-transparent [&_[data-slot=casilla-caja]]:p-0">
              <span className="mt-[2px] flex-[0_0_auto]">
                <Casilla
                  name={field.name}
                  checked={field.value}
                  onCheckedChange={(marcada) => field.onChange(marcada === true)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  className="size-[19px] cursor-pointer"
                />
              </span>
              <span className="text-[13.5px] leading-[1.5] text-pretty text-tinta-3">
                {t('Avisarme por correo cuando venza mi próxima cuota')}
              </span>
            </label>
          )}
        />

        <Boton type="submit" variante="primario" className="mt-[18px] min-h-[48px] w-full py-0 text-[16px]">
          {t('Continuar al pago')}
        </Boton>
      </Formulario>
    </Tarjeta>
  );
}
