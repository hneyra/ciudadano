import { zodResolver } from '@hookform/resolvers/zod';
import {
  Boton,
  Campo,
  CampoDelFormulario,
  Desplegable,
  Etiqueta,
  Formulario,
  Opcion,
  avisar,
  cn,
} from '@kamayuk/ui';
import { useId, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { AvisoConFilo } from '../../piezas/AvisoConFilo.tsx';
import { AvisoDeAmnistia, QuePuedeHacerAqui } from '../../piezas/PortadaDelPortal.tsx';
import { MEDIDAS_DE_CONTROL, Rotulo } from '../../piezas/Rotulo.tsx';
import { useRecorrido } from '../../recorrido/ProveedorDelRecorrido.tsx';
import { type TipoDeDocumento, vivas } from '../../recorrido/recorrido.ts';

/**
 * **Paso 1 · Buscar mi deuda** (`diseno/Ciudadano.dc.html`: plantilla 121-180, `buscar()` 1002-1007 y
 * bloque 1080-1101).
 *
 * La persona escribe su codigo de contribuyente o su documento y llega a su deuda. Una busqueda
 * valida despacha `buscar` al recorrido —que pasa a `deudas`, y la ruta lo sigue— y avisa por
 * `avisar`. En la demostracion cualquier numero valido encuentra a la contribuyente de ejemplo.
 *
 * <h2>El formulario, y la pieza que NO es `CampoDelFormulario`</h2>
 *
 * `Formulario` con `react-hook-form` y `zod`. «Buscar por» es `CampoDelFormulario` con `Desplegable`.
 * El numero no puede serlo: `CampoDelFormulario` pinta el error PEGADO al campo, en 11.5 px, y el
 * artboard lo pinta como un bloque `role="alert"` bajo toda la fila (linea 148). Con los dos, el
 * mensaje saldria dos veces. Asi que el numero se compone con las mismas dos piezas con que
 * `CampoDelFormulario` esta hecho —`Controller` y `Etiqueta` de `@kamayuk/ui`—, sin el mensaje
 * pegado, y el campo apunta al bloque con `aria-describedby` y se marca `aria-invalid`: las dos
 * senales que la libreria exige siguen ahi.
 *
 * <h2>Lo que se aparta del artboard, y por que</h2>
 *
 * · **El campo con error se pinta invalido** (filo y papel de `CONTROL`); el artboard lo deja igual.
 *   Es el `aria-invalid` de arriba, que la libreria dibuja.
 * · **El filo de cada capacidad** (`#E4E4E4`) y **el filo tenue de la amnistia** (`#FAEBCC`) no son
 *   tokens: `--linea` y `--atencion-tinta` al 25 %. Estan en la tabla de
 *   `verificaciones/la-paleta-cuadra-con-el-artboard.test.ts`.
 * · **La sombra de la tarjeta** es `--shadow-sombra-1` y no el `rgba(0,0,0,.04)` literal.
 *
 * Los ejemplos del placeholder (`00000025673`, …) son DATO, como el documento de la barra: el mismo
 * numero en cualquier idioma. No pasan por `t()`.
 *
 * <h2>Esta pantalla es SOLO de demostracion (issue 28)</h2>
 *
 * Con plataforma, `buscar` deja de ser un paso alcanzable (`src/recorrido/recorrido.ts`) y el primer
 * paso es «Entrar»: el backend ya no ofrece buscar por documento —el ADR-0020 retiro
 * `GET /portal/deuda?doc=` por ser una enumeracion de contribuyentes— y un formulario que nadie
 * puede atender es peor que no tenerlo. Lo que las dos puertas de entrada comparten —«Qué puede
 * hacer aquí» y el aviso de la amnistia— esta en `src/piezas/PortadaDelPortal.tsx`.
 */

const TIPOS: readonly TipoDeDocumento[] = ['Código de contribuyente', 'DNI', 'RUC'];

/** El ejemplo de cada tipo (artboard, linea 1087). */
const EJEMPLO: Readonly<Record<TipoDeDocumento, string>> = {
  'Código de contribuyente': '00000025673',
  DNI: '03593174',
  RUC: '20525118447',
};

const esTipo = (valor: string): valor is TipoDeDocumento => TIPOS.some((tipo) => tipo === valor);

interface ValoresDeLaBusqueda {
  tipoDeDocumento: TipoDeDocumento;
  numero: string;
}

export function Buscar() {
  const { t } = useTranslation();
  const { estado, despachar } = useRecorrido();
  const idDelError = useId();

  const esquema = useMemo(
    () =>
      z.object({
        tipoDeDocumento: z.enum(['Código de contribuyente', 'DNI', 'RUC']),
        numero: z
          .string()
          .trim()
          .min(1, t('Escriba su código de contribuyente o su documento para poder buscar.'))
          .regex(/^[0-9]+$/, t('El código y el documento son solo números. Revise lo que escribió.')),
      }),
    [t],
  );

  const form = useForm<ValoresDeLaBusqueda>({
    resolver: zodResolver(esquema),
    defaultValues: { tipoDeDocumento: 'Código de contribuyente', numero: '' },
    // El artboard borra el error al escribir (linea 1089), no lo recalcula: con `onChange`, escribir
    // «12a» tras el error de vacio lo cambiaria por el otro en vez de quitarlo.
    reValidateMode: 'onSubmit',
  });
  const tipo = useWatch({ control: form.control, name: 'tipoDeDocumento' });
  const error = form.formState.errors.numero?.message;

  const rotuloDelTipo: Readonly<Record<TipoDeDocumento, string>> = {
    'Código de contribuyente': t('Código de contribuyente'),
    DNI: t('DNI'),
    RUC: t('RUC'),
  };
  const rotuloDelNumero: Readonly<Record<TipoDeDocumento, string>> = {
    'Código de contribuyente': t('Código de contribuyente'),
    DNI: t('Número de DNI'),
    RUC: t('Número de RUC'),
  };

  const alEnviar = ({ tipoDeDocumento, numero }: ValoresDeLaBusqueda) => {
    despachar({ tipo: 'buscar', tipoDeDocumento, numero });
    // Lo que queda por pagar es la deuda viva, y no los cuatro del artboard (linea 1006): tras
    // «Consultar otra deuda» lo pagado ya no esta pendiente (nota del revisor del issue 9). Buscar no
    // cambia `pagadas`, asi que contarla antes de despachar da lo mismo que despues.
    const pendientes = vivas(estado).length;
    avisar(
      pendientes === 0
        ? t('No encontramos conceptos pendientes.')
        : t('Encontramos {{count}} conceptos pendientes.', { count: pendientes }),
    );
  };

  return (
    <div>
      <div className="border border-linea bg-superficie shadow-sombra-1">
        <div className="px-[26px] pt-[26px] pb-[22px]">
          <h1 className="m-0 text-[27px] font-bold tracking-[-0.01em] text-pretty text-azul">
            {t('Consulte y pague sus tributos')}
          </h1>
          {/* `data-cuerpo`: el parrafo que mide `laLetraDibujadaCalzaConArial` (issue 36) como texto
              de CUERPO — `body` no sirve de selector para CDP: no tiene texto DIRECTO propio (todo
              esta en sus hijos) y `CSS.getPlatformFontsForNode` no informa ninguna fuente sobre el. */}
          <p
            data-cuerpo=""
            className="mt-[11px] mb-0 max-w-[64ch] text-[16px] leading-[1.6] text-pretty text-tinta-2"
          >
            {t(
              'Escriba su código de contribuyente o su documento de identidad. Verá lo que debe, con su vencimiento, y podrá pagar todo o solo lo que elija.',
            )}
          </p>

          <Formulario form={form} alEnviar={alEnviar}>
            <div className="mt-5 flex flex-wrap gap-[10px] [&_label]:mb-[6px]">
              <div className="min-w-0 flex-[0_0_210px]">
                <CampoDelFormulario<ValoresDeLaBusqueda, 'tipoDeDocumento'>
                  nombre="tipoDeDocumento"
                  rotulo={<Rotulo>{t('Buscar por')}</Rotulo>}
                >
                  {(campo) => (
                    <Desplegable
                      value={campo.value}
                      onValueChange={(valor) => {
                        if (!esTipo(valor)) return;
                        campo.onChange(valor);
                        // Cambiar de tipo vacia el numero y quita el error (artboard, linea 1085).
                        form.setValue('numero', '');
                        form.clearErrors();
                      }}
                      // A 210 px «Código de contribuyente» (187 px en Arial 15) no cabe junto al galon, y
                      // el `Select` de Radix lo partia en dos lineas: 67 px de alto, medido. El `select`
                      // nativo del artboard lo recorta; aqui se recorta con puntos suspensivos.
                      className={cn(MEDIDAS_DE_CONTROL, '[&>span]:truncate')}
                    >
                      {TIPOS.map((opcion) => (
                        <Opcion key={opcion} value={opcion}>
                          {rotuloDelTipo[opcion]}
                        </Opcion>
                      ))}
                    </Desplegable>
                  )}
                </CampoDelFormulario>
              </div>

              <Controller
                control={form.control}
                name="numero"
                render={({ field }) => (
                  <Etiqueta
                    rotulo={<Rotulo>{rotuloDelNumero[tipo]}</Rotulo>}
                    className="min-w-0 flex-[1_1_260px]"
                  >
                    <Campo
                      {...field}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder={EJEMPLO[tipo]}
                      onChange={(evento) => {
                        field.onChange(evento);
                        form.clearErrors('numero');
                      }}
                      {...(error === undefined ? {} : { 'aria-invalid': true, 'aria-describedby': idDelError })}
                      className={MEDIDAS_DE_CONTROL}
                    />
                  </Etiqueta>
                )}
              />

              <span className="flex flex-[0_0_auto] items-end">
                <Boton type="submit" variante="primario" className="min-h-[44px] px-[30px] py-0 text-[16px]">
                  {t('Buscar mi deuda')}
                </Boton>
              </span>
            </div>
          </Formulario>

          {error === undefined ? null : (
            <AvisoConFilo id={idDelError} role="alert" tono="mal" className="mt-4 px-4 py-[13px] leading-[1.55]">
              {error}
            </AvisoConFilo>
          )}

          <p className="mt-4 mb-0 text-[14px] text-pretty text-tinta-3">
            {t(
              'Su código de contribuyente figura en la cuponera del impuesto predial y en cualquier recibo anterior. Si no lo encuentra, busque por su DNI.',
            )}
          </p>
        </div>

        <QuePuedeHacerAqui />
      </div>

      <AvisoDeAmnistia />
    </div>
  );
}
