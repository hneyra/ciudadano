import { zodResolver } from '@hookform/resolvers/zod';
import { formatearImporte } from '@kamayuk/formato';
import { Boton, Campo, Casilla, Etiqueta, Formulario, avisar, cn } from '@kamayuk/ui';
import { type ReactNode, useId, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { MEDIDAS_DE_CONTROL, Rotulo } from '../../piezas/Rotulo.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { cuenta, destinoAlEntrar, hayQuePagar } from '../../recorrido/recorrido.ts';

/**
 * **Paso 3 · Mis datos** (`diseno/Ciudadano.dc.html`: plantilla 311-354, logica 1177-1201).
 *
 * Antes de cobrar, a donde se envia el comprobante: solo un correo, o entrar con la cuenta para que el
 * pago quede en el historial. La cuenta es de demostracion: cualquier documento y clave entran.
 *
 * <h2>Dos formularios, cada uno con su error</h2>
 *
 * Cada tarjeta es un `Formulario` de `@kamayuk/ui` con su `useForm` y su esquema de `zod`: enviar una
 * no valida la otra, y el error sale en la suya. Como en «Buscar mi deuda», el mensaje no es el que
 * `CampoDelFormulario` pega al campo (11.5 px, sin `role`): el artboard lo pinta en 13.5 px con
 * `role="alert"` (lineas 326 y 347). Asi que cada campo se compone con `Controller` y `Etiqueta` —las
 * dos piezas con que `CampoDelFormulario` esta hecho— y apunta al mensaje con `aria-describedby` y
 * `aria-invalid`, que `CONTROL` pinta con filo `--mal-borde` y papel `--mal-campo` (el `IN_MAL` del
 * artboard).
 *
 * El error se borra al escribir y no se recalcula (`reValidateMode: 'onSubmit'`), como `onCorreo`,
 * `onLoginDoc` y `onLoginClave` del artboard.
 *
 * <h2>Lo que las acciones deciden, y lo que no</h2>
 *
 * La pantalla despacha `continuarConCorreo` o `entrar`; a donde lleva cada una lo dice el reductor.
 * Entrar sin nada que pagar lleva al historial y no a un «Pagar» vacio (`destinoAlEntrar`, nota del
 * revisor del issue 7), y por lo mismo el parrafo no dice «Va a pagar S/ …» sin seleccion
 * (`hayQuePagar`). El importe es `conAmnistia` de `cuenta`: aqui no se suma nada.
 *
 * **La clave no sale del formulario**: `entrar` no la lleva, y nada la escribe en `localStorage` ni
 * en `sessionStorage` (lo mide `Identificar.test.tsx`).
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · **El filo granate de «Con mi cuenta»** (`#A6093D`) no es token de `clasico`: es `--mal-tinta`, el
 *   mas cercano, calculado. Y el acero de «Solo con mi correo» es `--azul`. Los dos, con su porque, en
 *   `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 * · **Los campos vacios de la cuenta se pintan invalidos**; el artboard los deja con `IN`. Es el
 *   `aria-invalid` de arriba: sin el, el mensaje no pertenece a ningun campo.
 * · **«Olvidé mi clave · Crear una cuenta» son botones que avisan**, no `<a href="#">`: un enlace que
 *   no lleva a ningun sitio no es un enlace (jsx-a11y), y en la demostracion no hay a donde ir.
 * · **La casilla es `Casilla`** (Radix) sin su caja, dentro de un `<label>` que envuelve tambien el
 *   texto, como el del artboard: pulsar el texto la alterna.
 * · **Sin seleccion, el parrafo cambia** (nota del revisor): «Todavía no ha elegido qué pagar…».
 *
 * `03593174` y los puntos de la clave son DATO, como los ejemplos de «Buscar mi deuda»: no pasan por
 * `t()`. `nombre@example.com` si, porque se lee como una plantilla («nombre@…»), no como un dato
 * opaco (issue 51: el dominio de ejemplo era antes real y registrable; ahora es el reservado
 * `example.com` — RFC 2606 —, y la palabra que lo delataba como legible sigue siendo «nombre»).
 */

const EJEMPLO_DE_DOCUMENTO = '03593174';
const PUNTOS_DE_LA_CLAVE = '••••••••';

interface ValoresDelCorreo {
  correo: string;
  avisarVencimiento: boolean;
}

interface ValoresDeLaCuenta {
  documento: string;
  clave: string;
}

/** El correo esta completo si hay algo antes de la `@` y un punto despues (artboard, linea 1187). */
const correoCompleto = (correo: string): boolean => {
  const arroba = correo.indexOf('@');
  return arroba >= 1 && correo.lastIndexOf('.') > arroba;
};

/**
 * Una tarjeta: papel, filo de 3 px arriba, titulo y texto. El color del filo lo pone quien la usa, y
 * por `className` y no por una prop propia: `sin-colores-propios` lee `className` y `cn`, y un
 * `border-t-[#A6093D]` pasado como `filo="…"` seguia verde (medido).
 */
function Tarjeta({
  titulo,
  texto,
  className,
  children,
}: {
  readonly titulo: string;
  readonly texto: string;
  readonly className: string;
  readonly children: ReactNode;
}) {
  const idDelTitulo = useId();
  return (
    <section
      aria-labelledby={idDelTitulo}
      className={cn('min-w-0 border border-t-[3px] border-linea bg-superficie px-[22px] pt-[22px] pb-6', className)}
    >
      <h2 id={idDelTitulo} className="m-0 text-[18px] font-bold">
        {titulo}
      </h2>
      <p className="mt-2 mb-[18px] text-[14.5px] leading-[1.6] text-pretty text-tinta-3">{texto}</p>
      {children}
    </section>
  );
}

/** El mensaje bajo el campo (lineas 326 y 347). */
function MensajeDeError({ id, children }: { readonly id: string; readonly children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 mb-0 text-[13.5px] text-pretty text-mal-tinta">
      {children}
    </p>
  );
}

/** Lo que el campo lleva cuando esta mal: pintarse invalido y apuntar al mensaje. */
const conError = (mal: boolean, idDelError: string) =>
  mal ? { 'aria-invalid': true, 'aria-describedby': idDelError } : {};

function SoloConMiCorreo() {
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

function ConMiCuenta() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelError = useId();

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
    // A donde lleva lo decide el reductor; el aviso dice lo que va a pasar alli.
    const alHistorial = destinoAlEntrar(estado) === 'historial';
    despachar({ tipo: 'entrar' });
    avisar(alHistorial ? t('Bienvenida. Aquí están sus pagos.') : t('Bienvenida. Este pago quedará en su historial.'));
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
                placeholder={EJEMPLO_DE_DOCUMENTO}
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
          className="mt-[18px] min-h-[48px] w-full border-azul py-0 text-[16px] font-bold text-azul hover:border-azul hover:bg-info-fondo"
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

/** Se ve como los enlaces del artboard (`--azul`, subrayado al pasar) y es un boton: no lleva a ningun sitio. */
function EnlaceDeDemostracion({ alPulsar, children }: { readonly alPulsar: () => void; readonly children: ReactNode }) {
  return (
    <Boton
      type="button"
      variante="fantasma"
      tamano="menudo"
      onClick={alPulsar}
      className="inline p-0 align-baseline text-[13.5px] hover:bg-transparent hover:underline"
    >
      {children}
    </Boton>
  );
}

export function Identificar() {
  const { t } = useTranslation();
  const { estado } = useRecorrido();

  return (
    <div>
      <h1 className="m-0 mb-[6px] text-[24px] font-bold text-pretty text-azul">
        {t('¿A dónde le enviamos el comprobante?')}
      </h1>
      <p className="mt-0 mb-5 max-w-[66ch] text-[16px] leading-[1.6] text-pretty text-tinta-2">
        {hayQuePagar(estado)
          ? t(
              'Va a pagar {{importe}}. Necesitamos un correo para enviarle el comprobante. Si tiene cuenta, entre y le guardamos el pago en su historial.',
              { importe: formatearImporte(cuenta(estado).conAmnistia) },
            )
          : t('Todavía no ha elegido qué pagar. Si tiene cuenta, entre para ver sus pagos y sus comprobantes.')}
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(316px,1fr))] gap-[18px]">
        <SoloConMiCorreo />
        <ConMiCuenta />
      </div>
    </div>
  );
}
