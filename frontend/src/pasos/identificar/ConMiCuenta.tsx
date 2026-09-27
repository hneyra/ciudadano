import { zodResolver } from '@hookform/resolvers/zod';
import { Boton, Campo, Etiqueta, Formulario, avisar, cn } from '@kamayuk/ui';
import { useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { MEDIDAS_DE_CONTROL, Rotulo } from '../../piezas/Rotulo.tsx';
import { botonConContorno } from '../../piezas/variantes.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { laDemostracion } from '../../recorrido/recorrido.ts';
import { EnlaceDeDemostracion, MensajeDeError, Tarjeta, conError } from './piezas.tsx';
import { laBienvenida } from './vista.ts';

/**
 * **«Con mi cuenta»** (artboard, lineas 334-352): entrar para que el pago quede en el historial. La
 * cuenta es de demostracion: cualquier documento y clave entran. El error se borra al escribir y no se
 * recalcula, como `onLoginDoc` y `onLoginClave` del artboard; los dos campos dicen lo mismo, y el
 * mensaje sale una vez.
 *
 * La clave no sale del formulario, los campos vacios se pintan invalidos y «Olvidé mi clave · Crear una
 * cuenta» son botones que avisan: el porque de cada cosa, en la cabecera de `Identificar.tsx`.
 */

const PUNTOS_DE_LA_CLAVE = '••••••••';

interface ValoresDeLaCuenta {
  documento: string;
  clave: string;
}

export function ConMiCuenta() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelError = useId();
  // Artboard, linea 340.
  const ejemploDeDocumento = laDemostracion(estado).ejemplos.cuenta;

  const esquema = useMemo(() => {
    const falta = t('Escriba su documento y su clave para entrar.');
    return z.object({
      documento: z.string().trim().min(1, falta),
      // La clave no se recorta: un espacio puede ser parte de ella (artboard, linea 1196).
      clave: z.string().min(1, falta),
    });
  }, [t]);

  const form = useForm<ValoresDeLaCuenta>({
    resolver: zodResolver(esquema),
    defaultValues: { documento: '', clave: '' },
    reValidateMode: 'onSubmit',
  });
  const { errors } = form.formState;
  // Los dos campos dicen lo mismo: el mensaje sale una vez.
  const error = errors.documento?.message ?? errors.clave?.message;

  const alEnviar = () => {
    // A donde lleva lo decide el reductor; el aviso dice lo que va a pasar alli, y se lee ANTES.
    const bienvenida = laBienvenida(estado, t);
    despachar({ tipo: 'entrar' });
    avisar(bienvenida);
  };

  return (
    <Tarjeta
      titulo={t('Con mi cuenta')}
      texto={t('Guarda este pago y todos los anteriores en un historial, con sus comprobantes siempre a mano.')}
      // El granate del artboard (`#A6093D`) no es token: `--mal-tinta` es el mas cercano, calculado en
      // `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
      className="border-t-mal-tinta"
    >
      <Formulario form={form} alEnviar={alEnviar} className="[&_label]:mb-[6px]">
        <Controller
          control={form.control}
          name="documento"
          render={({ field }) => (
            <Etiqueta rotulo={<Rotulo>{t('Documento de identidad')}</Rotulo>} className="mb-3">
              <Campo
                {...field}
                inputMode="numeric"
                autoComplete="username"
                placeholder={ejemploDeDocumento}
                onChange={(evento) => {
                  field.onChange(evento);
                  form.clearErrors();
                }}
                {...conError(errors.documento !== undefined, idDelError)}
                className={MEDIDAS_DE_CONTROL}
              />
            </Etiqueta>
          )}
        />
        <Controller
          control={form.control}
          name="clave"
          render={({ field }) => (
            <Etiqueta rotulo={<Rotulo>{t('Clave')}</Rotulo>}>
              <Campo
                {...field}
                type="password"
                autoComplete="current-password"
                placeholder={PUNTOS_DE_LA_CLAVE}
                onChange={(evento) => {
                  field.onChange(evento);
                  form.clearErrors();
                }}
                {...conError(errors.clave !== undefined, idDelError)}
                className={MEDIDAS_DE_CONTROL}
              />
            </Etiqueta>
          )}
        />
        {error === undefined ? null : <MensajeDeError id={idDelError}>{error}</MensajeDeError>}

        <Boton
          type="submit"
          // El contorno azul de «Crear mi cuenta», con el papel de los avisos informativos al pasar.
          className={cn(botonConContorno({ tono: 'azul' }), 'mt-[18px] min-h-[48px] w-full py-0 text-[16px] hover:bg-info-fondo')}
        >
          {t('Entrar y pagar')}
        </Boton>
      </Formulario>

      <p className="mt-3 mb-0 text-[13.5px] text-pretty text-tinta-3">
        <EnlaceDeDemostracion alPulsar={() => avisar(t('Abriría la recuperación de su clave.'))}>
          {t('Olvidé mi clave')}
        </EnlaceDeDemostracion>
        {' · '}
        <EnlaceDeDemostracion alPulsar={() => avisar(t('Abriría el registro de una cuenta nueva.'))}>
          {t('Crear una cuenta')}
        </EnlaceDeDemostracion>
      </p>
    </Tarjeta>
  );
}
