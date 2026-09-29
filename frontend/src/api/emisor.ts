import type { FallaDeLaPuerta, TextosDeLaPuerta, Vuelta } from '@kamayuk/sesion';

/**
 * **Lo que el sistema de identidad contesta, dicho UNA vez y para un contribuyente** (issue 56).
 *
 * <h2>El problema: dos traducciones del mismo error</h2>
 *
 * Hasta el issue 56 el portal tenia dos caminos de vuelta del emisor y cada uno decia sus errores a
 * su manera:
 *
 *   · **el canje silencioso** (issue 35, `silencio.ts`) los reescribia con claves del portal, con
 *     tildes y hablando del «sistema de identidad», que la pantalla pasaba por `t()`;
 *   · **la vuelta normal** (issue 13, `arranque.ts`) ensenaba tal cual el `motivo` y el `detalle` de
 *     `@kamayuk/sesion` —«El emisor no dejo entrar», sin tildes y en palabras de quien opera
 *     Keycloak— como VALORES de un `t()`, o sea sin traducir.
 *
 * Y el mismo `?error=access_denied` que el silencio contaba como «no se completo la entrada», la
 * vuelta lo ensenaba con otras palabras. Ahora las dos leen de aqui: `leerElError()` es la unica
 * funcion que convierte un `?error=` del emisor en lo que se dice, y `deLaVuelta()` la que convierte
 * lo que la libreria cuenta de un canje fallido. Y desde el issue 67, `deLaSonda()` la que convierte
 * lo que cuenta la IDA que no llego al emisor.
 *
 * <h2>Claves y no frases: aqui no se traduce</h2>
 *
 * Este archivo corre ANTES de montar —lo usan `arranque.ts` y `silencio.ts`— y no arrastra React ni
 * i18next. Lo que devuelve son claves con sus huecos (`TextoDelEmisor`); la pantalla hace
 * `t(clave, valores)`. Que cada clave este en el locale lo exige
 * `verificaciones/el-locale-esta-completo.test.ts` por `clavesDelEmisor()`: `i18next-cli` no ve un
 * `t()` con una variable.
 *
 * <h2>Lo que dijo el emisor NO llega a la pantalla (revision del PR #66)</h2>
 *
 * Ni el `error` ni el `error_description` de la vuelta se ensenan, **nunca**, ni siquiera como hueco
 * de una frase del portal. Viajan en la barra de direcciones, y la libreria no comprueba el `state`
 * en la rama de `?error=`: cualquiera puede fabricar un enlace
 * `…/portal/?error=x&error_description=Pague+al+999…` y el portal pintaria ese texto DENTRO del aviso
 * de la municipalidad. React lo escapa —no hay XSS—, pero es suplantacion con el escudo al lado. Asi
 * que el codigo solo ELIGE un texto del portal (`motivoDelError`), los que no se conocen caen en uno
 * generico, y la descripcion se tira.
 */

/**
 * **Un texto que la PANTALLA traduce**: la clave es el castellano, como en todo el portal, y los
 * valores son sus huecos.
 */
export interface TextoDelEmisor {
  readonly clave: string;
  readonly valores?: Readonly<Record<string, string>>;
}

/** Por que no se pudo abrir la sesion, dicho para la pantalla. */
export interface FalloDelEmisor {
  readonly estado: 'fallo';
  readonly motivo: TextoDelEmisor;
  readonly detalle: TextoDelEmisor;
}

/** La persona no quiso entrar, o no habia entrado: no es un fallo, y el portal se monta anonimo. */
export interface NoEntro {
  readonly estado: 'anonimo';
}

/**
 * **Todo lo que la vuelta del emisor puede llegar a decir en pantalla**, en castellano y con sus
 * tildes: son textos del portal, no palabras del emisor (que solo entran por sus huecos).
 *
 * Hablan del «sistema de identidad», como las frases de la pantalla que los recibe, y no del
 * «emisor»: quien los lee es un contribuyente, no quien opera Keycloak.
 */
export const TEXTOS_DEL_EMISOR = {
  noContesto: 'El sistema de identidad no contestó',
  noContestoDetalle:
    'Le preguntamos si ya había entrado y no contestó en {{segundos}} s. Puede estar apagado o no ser alcanzable desde este equipo.',
  canjeNoLlego: 'La petición del canje no llegó a completarse. El sistema de identidad puede estar apagado o no ser alcanzable desde este equipo.',
  rechazo: 'El sistema de identidad rechazó el canje',
  rechazoDetalle: 'La petición del canje volvió con {{estado}}. Suele ser la dirección de retorno o el cliente.',
  sinToken: 'El sistema de identidad no devolvió ningún token',
  sinTokenDetalle: 'La respuesta del canje no trae «access_token».',
  sinCodigo: 'La respuesta no cuadra con la pregunta',
  sinCodigoDetalle: 'Volvió sin código y sin error.',
  alcance: 'El alcance que se pide no existe en el sistema de identidad',
  alcanceDetalle: 'Este portal pide un permiso que el sistema de identidad no tiene configurado.',
  cliente: 'El sistema de identidad no reconoce a este portal',
  clienteDetalle: 'El sistema de identidad no tiene registrado este portal, o no con esta dirección.',
  problema: 'El sistema de identidad tuvo un problema',
  problemaDetalle: 'Suele ser pasajero.',
  noDejo: 'El sistema de identidad no dejó entrar',
  noDejoDetalle: 'No dijo por qué.',
  inesperado: 'No se pudo preguntar al sistema de identidad',
  inesperadoDetalle: 'Algo falló al preparar la pregunta: {{mensaje}}',
  // ── Lo que solo le pasa a la vuelta normal (issue 56) ──────────────────────────────────────
  vueltaNoCuadra: 'La vuelta no cuadra con la ida',
  vueltaNoCuadraDetalle:
    'Volvió con un código que este equipo no pidió. Suele pasar al abrir un enlace de vuelta antiguo o en otra pestaña.',
  vueltaInesperada: 'No se pudo completar la entrada',
  vueltaInesperadaDetalle: 'Algo falló al leer la vuelta: {{mensaje}}',
  vueltaDesconocida: 'La vuelta no se pudo leer.',
  // ── La ida que no llega al formulario (issue 67): el aviso ENTERO, porque sale solo ──────────
  sondaNoLlega:
    'No pudimos llevarle al acceso: el sistema de identidad no contesta. Puede estar apagado o no ser alcanzable desde este equipo; vuelva a intentarlo en unos minutos.',
  sondaSinRespuesta:
    'No pudimos llevarle al acceso: el sistema de identidad no contestó en {{segundos}} s. Vuelva a intentarlo en unos minutos.',
  idaInesperada:
    'No pudimos llevarle al acceso: algo falló en este navegador al preparar la entrada. Vuelva a cargar la página e inténtelo otra vez.',
} as const;

/** Las claves de `TEXTOS_DEL_EMISOR`, para el inventario del locale. */
export function clavesDelEmisor(): readonly string[] {
  return [...new Set(Object.values(TEXTOS_DEL_EMISOR))];
}

export const texto = (clave: string, valores?: Readonly<Record<string, string>>): TextoDelEmisor =>
  valores === undefined ? { clave } : { clave, valores };

export const fallo = (motivo: TextoDelEmisor, detalle: TextoDelEmisor): FalloDelEmisor => ({
  estado: 'fallo',
  motivo,
  detalle,
});

/**
 * **Los errores que dicen «la persona no quiso entrar» o «no habia entrado»**, y no «algo fue mal».
 *
 *   · `access_denied` (RFC 6749 §4.1.2.1): quien mira dijo que no —cancelo en el formulario o nego
 *     el consentimiento—. Hasta el issue 56 acababa en «No se pudo abrir su sesion», que es un
 *     callejon sin salida para alguien que solo cambio de idea;
 *   · los cuatro de `prompt=none` (OIDC Core §3.1.2.6): el emisor contesta asi en vez de ensenar el
 *     formulario, el consentimiento o el selector de cuenta. Los da el canje silencioso, y si
 *     alguno llegara a la vuelta normal diria lo mismo: no hay sesion.
 *
 * Ninguno es una averia: el portal se monta anonimo y la persona decide si entra. Cualquier OTRO
 * error si lo es, y se cuenta.
 */
export const NO_QUISO_ENTRAR: ReadonlySet<string> = new Set([
  'access_denied',
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
]);

/**
 * Lo que se dice de un `?error=` que SI es una averia, segun el codigo de OAuth: **solo textos del
 * portal**. El codigo elige; no se ensena (ver la cabecera).
 */
function falloDelError(error: string): FalloDelEmisor {
  switch (error) {
    case 'invalid_scope':
      return fallo(texto(TEXTOS_DEL_EMISOR.alcance), texto(TEXTOS_DEL_EMISOR.alcanceDetalle));
    case 'unauthorized_client':
    case 'invalid_client':
      return fallo(texto(TEXTOS_DEL_EMISOR.cliente), texto(TEXTOS_DEL_EMISOR.clienteDetalle));
    case 'temporarily_unavailable':
    case 'server_error':
      return fallo(texto(TEXTOS_DEL_EMISOR.problema), texto(TEXTOS_DEL_EMISOR.problemaDetalle));
    default:
      return fallo(texto(TEXTOS_DEL_EMISOR.noDejo), texto(TEXTOS_DEL_EMISOR.noDejoDetalle));
  }
}

/**
 * **La unica traduccion de un `?error=` del emisor** (issue 56): la usan la vuelta normal
 * (`arranque.ts`) y el canje silencioso (`silencio.ts`).
 *
 * Recibe **solo el codigo**, y a proposito: el `error_description` no se le pasa, para que no haya
 * forma de que llegue a la pantalla (revision del PR #66).
 *
 * @param error el `error` de la vuelta. Elige el texto; no se ensena.
 */
export function leerElError(error: string): NoEntro | FalloDelEmisor {
  if (NO_QUISO_ENTRAR.has(error)) return { estado: 'anonimo' };
  return falloDelError(error);
}

/** El mensaje de una excepcion, para el hueco `{{mensaje}}`. */
function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message || error.name : String(error);
}

/**
 * **Lo que se dice si preguntar en silencio REVIENTA** —`crypto.subtle` que lanza, un `appendChild`
 * que falla, un `id_token` que no se deja leer— en vez de contestar (revision del PR #45).
 */
export function falloInesperado(error: unknown): FalloDelEmisor {
  return fallo(
    texto(TEXTOS_DEL_EMISOR.inesperado),
    texto(TEXTOS_DEL_EMISOR.inesperadoDetalle, { mensaje: mensajeDe(error) }),
  );
}

/**
 * **Lo que se dice si el canje de la vuelta normal REVIENTA** en vez de contestar (issue 56):
 * `sessionStorage` que lanza, un `id_token` que no se deja leer. Sin esto la excepcion saltaba el
 * montaje y la pagina se quedaba en blanco.
 */
export function vueltaInesperada(error: unknown): FalloDelEmisor {
  return fallo(
    texto(TEXTOS_DEL_EMISOR.vueltaInesperada),
    texto(TEXTOS_DEL_EMISOR.vueltaInesperadaDetalle, { mensaje: mensajeDe(error) }),
  );
}

/**
 * **Lo que la libreria dice de una vuelta fallida, cambiado por claves del portal** (issue 56).
 *
 * `crearIdentidad` acepta sus textos como dato (kamayuk-lib#118), y el portal le pasa estos: cada
 * `motivo` y cada `detalle` sin datos es UNA CLAVE de `TEXTOS_DEL_EMISOR`, y los dos que llevan un
 * dato dentro devuelven **solo el dato** —el estado HTTP, el codigo de error—, para que
 * `deLaVuelta()` lo meta en el hueco de su clave. Asi la libreria no escribe ni una palabra que
 * llegue a la pantalla, y `t()` ve siempre una clave que esta en el locale.
 *
 * Los cinco del `?error=` se dan tambien, aunque la vuelta normal no los lee (el error se toma de la
 * barra, con `leerElError()`, porque la libreria pierde el codigo al traducirlo): sin ellos, la
 * libreria volveria a escribir su castellano en la `Vuelta`.
 *
 * `Omit` de los dos de la SONDA (`FallaDeLaPuerta.motivo`), que no son de la vuelta: esos son
 * `TEXTOS_DE_LA_SONDA`, y la puerta recibe los dos juntos (`TEXTOS_DE_LA_PUERTA_DEL_PORTAL`). Y
 * `satisfies` y no `Partial`: una frase NUEVA de la vuelta en la libreria deja este objeto corto y
 * `yarn typecheck` sale rojo, en vez de colarse en castellano de funcionario.
 */
export const TEXTOS_DE_LA_VUELTA = {
  noSeCompletoLaEntrada: TEXTOS_DEL_EMISOR.noDejo,
  elAlcanceNoExisteEnElEmisor: TEXTOS_DEL_EMISOR.alcance,
  elEmisorNoReconoceAlCliente: TEXTOS_DEL_EMISOR.cliente,
  elEmisorTuvoUnProblema: TEXTOS_DEL_EMISOR.problema,
  elEmisorNoDejoEntrar: TEXTOS_DEL_EMISOR.noDejo,
  elEmisorContesto: (error: string) => error,
  laVueltaNoCuadraConLaIda: TEXTOS_DEL_EMISOR.vueltaNoCuadra,
  elCodigoLlegoSinSuEstado: TEXTOS_DEL_EMISOR.vueltaNoCuadraDetalle,
  elEmisorNoContesto: TEXTOS_DEL_EMISOR.noContesto,
  elCanjeNoLlegoACompletarse: TEXTOS_DEL_EMISOR.canjeNoLlego,
  elEmisorRechazoElCanje: TEXTOS_DEL_EMISOR.rechazo,
  elCanjeVolvioCon: (estado: number) => String(estado),
  elEmisorNoDevolvioNingunToken: TEXTOS_DEL_EMISOR.sinToken,
  laRespuestaDelCanjeNoTraeElToken: TEXTOS_DEL_EMISOR.sinTokenDetalle,
} satisfies Omit<TextosDeLaPuerta, 'laPeticionNoLlegoACompletarse' | 'noContestoEn'>;

/**
 * **Una vuelta fallida de la libreria, dicha con claves del portal** (issue 56).
 *
 * Solo tiene sentido con `TEXTOS_DE_LA_VUELTA` puestos en la puerta (`identidad.ts`): entonces el
 * `motivo` es una clave conocida y el `detalle`, otra clave o el dato de su hueco. Un motivo que no
 * es ninguno de esos —una frase nueva de la libreria que el tipo no vio— **no se ensena**: se dice
 * que la vuelta no se pudo leer, con palabras del portal.
 */
export function deLaVuelta(vuelta: Extract<Vuelta, { estado: 'fallo' }>): FalloDelEmisor {
  switch (vuelta.motivo) {
    case TEXTOS_DEL_EMISOR.rechazo:
      return fallo(texto(TEXTOS_DEL_EMISOR.rechazo), texto(TEXTOS_DEL_EMISOR.rechazoDetalle, { estado: vuelta.detalle }));
    case TEXTOS_DEL_EMISOR.vueltaNoCuadra:
      return fallo(texto(TEXTOS_DEL_EMISOR.vueltaNoCuadra), texto(TEXTOS_DEL_EMISOR.vueltaNoCuadraDetalle));
    case TEXTOS_DEL_EMISOR.noContesto:
      return fallo(texto(TEXTOS_DEL_EMISOR.noContesto), texto(TEXTOS_DEL_EMISOR.canjeNoLlego));
    case TEXTOS_DEL_EMISOR.sinToken:
      return fallo(texto(TEXTOS_DEL_EMISOR.sinToken), texto(TEXTOS_DEL_EMISOR.sinTokenDetalle));
    default:
      return fallo(texto(TEXTOS_DEL_EMISOR.vueltaInesperada), texto(TEXTOS_DEL_EMISOR.vueltaDesconocida));
  }
}

/**
 * **La marca con la que la libreria cuenta que la sonda agoto su espera** (issue 67). La escribe
 * `TEXTOS_DE_LA_SONDA.noContestoEn` y la lee `deLaSonda()`; ningun navegador empieza asi un mensaje.
 */
const PLAZO_DE_LA_SONDA = 'plazo-de-la-sonda:';
const PLAZO_LEIDO = new RegExp(`^${PLAZO_DE_LA_SONDA}(\\d+(?:\\.\\d+)?)$`);

/**
 * **Los dos textos de la SONDA de `entrar()`**, que la libreria pone en `FallaDeLaPuerta.motivo`
 * cuando el navegador no dio palabras (issue 67).
 *
 * El `motivo` es un solo texto donde caben tres cosas: las palabras del navegador («Failed to fetch»,
 * «Load failed», las que sean), o uno de estos dos. Asi que estos no llevan frase, llevan algo que
 * `deLaSonda()` pueda reconocer SIN leer lo del navegador: la clave del aviso sin respuesta, y la
 * marca del plazo con sus segundos.
 */
export const TEXTOS_DE_LA_SONDA = {
  laPeticionNoLlegoACompletarse: TEXTOS_DEL_EMISOR.sondaNoLlega,
  noContestoEn: (segundos: number) => `${PLAZO_DE_LA_SONDA}${String(segundos)}`,
} satisfies Pick<TextosDeLaPuerta, 'laPeticionNoLlegoACompletarse' | 'noContestoEn'>;

/**
 * **Todo lo que la puerta del portal le da a `crearIdentidad`** (`identidad.ts`): la vuelta y la
 * sonda. `satisfies` el tipo ENTERO: una frase nueva de la libreria deja esto corto y
 * `yarn typecheck` sale rojo.
 */
export const TEXTOS_DE_LA_PUERTA_DEL_PORTAL = {
  ...TEXTOS_DE_LA_VUELTA,
  ...TEXTOS_DE_LA_SONDA,
} satisfies TextosDeLaPuerta;

/**
 * **La ida que no llego al sistema de identidad, dicha con una clave del portal** (issue 67).
 *
 * Solo el plazo tiene aviso propio, con los segundos que la marca trae; lo demas —el mensaje del
 * navegador, lo que no era un `Error`, una forma nueva que la libreria invente— es «no contesta». El
 * `motivo` se compara y **nunca se ensena**: son palabras del navegador, en ingles y de consola.
 */
export function deLaSonda(falla: FallaDeLaPuerta): TextoDelEmisor {
  const plazo = PLAZO_LEIDO.exec(falla.motivo);
  if (plazo?.[1] !== undefined) return texto(TEXTOS_DEL_EMISOR.sondaSinRespuesta, { segundos: plazo[1] });
  return texto(TEXTOS_DEL_EMISOR.sondaNoLlega);
}

/**
 * **La ida que REVIENTA antes de salir hacia el formulario** (issue 67): `sessionStorage` que no deja
 * guardar el verificador, un `crypto.subtle` que falta. La sonda ya contesto, asi que no es el
 * sistema de identidad: es este navegador.
 */
export const IDA_INESPERADA: TextoDelEmisor = texto(TEXTOS_DEL_EMISOR.idaInesperada);
