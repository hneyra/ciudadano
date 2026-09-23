import type { ConfiguracionDeIdentidad, Identidad } from '@kamayuk/sesion';

import { configuracionDeLaPuerta, identidad } from './identidad.ts';

/**
 * **El canje silencioso: al recargar, se le pregunta al emisor si ya se habia entrado** (issue 35).
 *
 * <h2>El problema</h2>
 *
 * El token vive **solo en memoria** —la regla `token-en-almacenamiento` y la guarda
 * `verificaciones/el-token-vive-en-memoria.test.ts`—, asi que recargar la pagina lo pierde. En un
 * portal al que la gente llega de un enlace, recarga, o vuelve del banco, eso se vive como «me
 * echo». Guardar el token es justo lo prohibido; lo correcto es **volver a pedirlo sin molestar**
 * mientras la sesion del EMISOR siga viva, que es la que se guarda en su cookie y no en la nuestra.
 *
 * <h2>Como: un marco oculto con `prompt=none`, como el `check-sso` de keycloak-js</h2>
 *
 * Se abre un `<iframe>` invisible hacia la autorizacion del emisor con `prompt=none` (OIDC Core
 * §3.1.2.1): el emisor NO puede ensenar su formulario, asi que contesta al instante — con un `code`
 * si hay sesion, o con `error=login_required` (o uno de sus tres parientes) si no la hay. La vuelta
 * cae en `public/silencio.html`, que solo le pasa su barra de direcciones a esta ventana por
 * `postMessage`, y desde aqui se canjea como cualquier otro codigo.
 *
 * Marco y no redireccion de la pagina entera (decision del 2026-09-23): la pagina no se va, asi
 * que **no hay bucle posible** —nada vuelve a arrancar el portal—, no hay parpadeo de ida y vuelta,
 * y la barra de direcciones no cambia.
 *
 * <h2>Por que se compone aqui y no en `@kamayuk/sesion`</h2>
 *
 * La libreria no trae `prompt=none`, y la regla del repositorio es no tocarla. Lo que SI expone, se
 * usa: la configuracion de la puerta (`configuracionDeLaPuerta()`, el mismo realm, cliente, alcance
 * y retorno) y `fijarToken(token, idToken)`, que es lo que su propio canje llama al terminar —
 * token, `id_token` y `quienEntro()` quedan juntos, como tras una entrada con formulario—. Lo que no
 * expone (el reto S256, el base64url y el canje) se escribe aqui, pequeno y probado en
 * `silencio.test.ts`; son las mismas lineas que `paquetes/sesion/identidad.ts` de kamayuk-lib
 * `a6ea6fa`, y si un dia la libreria publica el canje silencioso, este archivo se borra.
 *
 * <h2>Nada va al almacenamiento</h2>
 *
 * El verificador PKCE y el `state` viven en la closure de `intentar()`: la pregunta y la respuesta
 * ocurren en la MISMA carga, asi que no hay rebote que sobrevivir y `sessionStorage` no hace falta.
 * La lista de lo que se guarda (`el-token-vive-en-memoria.test.ts`) no crece.
 *
 * <h2>Lo que no se hace</h2>
 *
 * Refrescar el token a mitad de sesion, y cerrar la del emisor: fuera del issue.
 */

/**
 * **Un texto que la PANTALLA traduce**: la clave es el castellano, como en todo el portal, y los
 * valores son sus huecos (revision del PR #45).
 *
 * Aqui no se traduce porque este archivo corre antes de montar y no arrastra React ni i18next (ver
 * `src/arranque.ts`); la pantalla hace `t(clave, valores)`. Que cada clave este en el locale lo
 * exige `verificaciones/el-locale-esta-completo.test.ts` por `clavesDelSilencio()`: `i18next-cli`
 * no ve un `t()` con una variable.
 */
export interface TextoDelSilencio {
  readonly clave: string;
  readonly valores?: Readonly<Record<string, string>>;
}

/** Lo que paso al preguntar. */
export type Silencio =
  | { readonly estado: 'identificado' }
  | { readonly estado: 'anonimo' }
  | FalloDelSilencio;

/** Por que no se pudo saber si habia sesion, dicho para la pantalla. */
export interface FalloDelSilencio {
  readonly estado: 'fallo';
  readonly motivo: TextoDelSilencio;
  readonly detalle: TextoDelSilencio;
}

/**
 * **Todo lo que el canje silencioso puede llegar a decir en pantalla**, en castellano y con sus
 * tildes: son textos del portal, no palabras del emisor (que solo entran por `{{descripcion}}`).
 *
 * Hablan del «sistema de identidad», como la frase de la pantalla que los recibe, y no del
 * «emisor»: quien los lee es un contribuyente, no quien opera Keycloak.
 */
export const TEXTOS_DEL_SILENCIO = {
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
  contesto: 'Contestó «{{error}}».',
  contestoConDescripcion: 'Contestó «{{error}}»: {{descripcion}}',
  accesoDenegado: 'No se completó la entrada',
  alcance: 'El alcance que se pide no existe en el sistema de identidad',
  cliente: 'El sistema de identidad no reconoce a este portal',
  problema: 'El sistema de identidad tuvo un problema',
  noDejo: 'El sistema de identidad no dejó entrar',
  inesperado: 'No se pudo preguntar al sistema de identidad',
  inesperadoDetalle: 'Algo falló al preparar la pregunta: {{mensaje}}',
} as const;

/** Las claves de `TEXTOS_DEL_SILENCIO`, para el inventario del locale. */
export function clavesDelSilencio(): readonly string[] {
  return [...new Set(Object.values(TEXTOS_DEL_SILENCIO))];
}

const texto = (clave: string, valores?: Readonly<Record<string, string>>): TextoDelSilencio =>
  valores === undefined ? { clave } : { clave, valores };

const fallo = (motivo: TextoDelSilencio, detalle: TextoDelSilencio): FalloDelSilencio => ({
  estado: 'fallo',
  motivo,
  detalle,
});

/**
 * **Lo que se dice si preguntar REVIENTA** —`crypto.subtle` que lanza, un `appendChild` que falla,
 * un `id_token` que no se deja leer— en vez de contestar (revision del PR #45).
 *
 * Lo usa `arrancar()` en su `catch`: sin el, la excepcion saltaba el `montar()` y la pagina se
 * quedaba en blanco, que es lo que el issue prohibe y lo que la libreria cerro en su canje
 * (`rentas#112`).
 */
export function falloInesperado(error: unknown): FalloDelSilencio {
  const mensaje = error instanceof Error ? error.message || error.name : String(error);
  return fallo(texto(TEXTOS_DEL_SILENCIO.inesperado), texto(TEXTOS_DEL_SILENCIO.inesperadoDetalle, { mensaje }));
}

/**
 * **La pagina de vuelta del marco**, relativa a la raiz de la aplicacion: `public/silencio.html`.
 *
 * Cabe en los `redirectUris` del client `kamayuk-portal` sin tocar el realm: medidos en
 * `infrastructure/despliegue/identidad/realm-kamayuk-ciudadano.json`, son `…/portal/*` en los tres
 * origenes. Y es otra pagina y no la del portal porque la del portal, cargada dentro del marco,
 * arrancaria el portal entero ahi dentro —con su propio intento silencioso—.
 */
export const PAGINA_DE_VUELTA = 'silencio.html';

/**
 * **Lo que se espera al emisor antes de darlo por caido.** Los ocho segundos de la sonda de
 * `@kamayuk/sesion` (`ESPERA_DE_LA_SONDA`, de `rentas#112`), por su mismo motivo: menos manda a la
 * pantalla de error a quien solo iba por un enlace lento; mas, y quien mira ya cree que esta roto.
 *
 * Un marco hacia un emisor apagado no avisa de nada —el navegador carga su pagina de error y la
 * ventana de arriba no se entera—, asi que el tope es la unica forma de saberlo.
 */
export const ESPERA_DEL_EMISOR = 8_000;

/**
 * **Los cuatro errores que dicen «no hay sesion»**, y no «algo fue mal» (OIDC Core §3.1.2.6).
 *
 * Con `prompt=none` el emisor contesta asi en vez de ensenar el formulario, el consentimiento o el
 * selector de cuenta. Ninguno es una averia: quien mira no habia entrado, y el portal se monta
 * anonimo para que decida si entra. Cualquier OTRO error si lo es, y se cuenta.
 */
const NO_HAY_SESION: ReadonlySet<string> = new Set([
  'login_required',
  'interaction_required',
  'consent_required',
  'account_selection_required',
]);

/** Los motivos que la libreria da a un `?error=` del emisor, dichos para un contribuyente. */
function motivoDelEmisor(error: string): TextoDelSilencio {
  switch (error) {
    case 'access_denied':
      return texto(TEXTOS_DEL_SILENCIO.accesoDenegado);
    case 'invalid_scope':
      return texto(TEXTOS_DEL_SILENCIO.alcance);
    case 'unauthorized_client':
    case 'invalid_client':
      return texto(TEXTOS_DEL_SILENCIO.cliente);
    case 'temporarily_unavailable':
    case 'server_error':
      return texto(TEXTOS_DEL_SILENCIO.problema);
    default:
      return texto(TEXTOS_DEL_SILENCIO.noDejo);
  }
}

function base64url(bytes: Uint8Array): string {
  let texto = '';
  bytes.forEach((b) => (texto += String.fromCharCode(b)));
  return btoa(texto).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function aleatorio(largo: number): string {
  const bytes = new Uint8Array(largo);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** El reto S256: `BASE64URL(SHA256(ASCII(verificador)))`, RFC 7636 §4.2. */
async function reto(verificador: string): Promise<string> {
  const resumen = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador));
  return base64url(new Uint8Array(resumen));
}

const NO_CONTESTO = (espera: number): FalloDelSilencio =>
  fallo(
    texto(TEXTOS_DEL_SILENCIO.noContesto),
    texto(TEXTOS_DEL_SILENCIO.noContestoDetalle, { segundos: String(espera / 1000) }),
  );

/**
 * **Abre el marco y espera la contestacion de ESTA pregunta**, o `null` si no llega a tiempo.
 *
 * Tres comprobaciones, y cada una cierra una puerta distinta a un mensaje que no es nuestro:
 *
 *   · **el origen** es el del portal: `silencio.html` se sirve de aqui, y cualquier otra pagina que
 *     nos mande un `message` —un anuncio, otra pestana con `opener`— no lo es;
 *   · **la ventana** es la de NUESTRO marco, y no otra del mismo origen;
 *   · **el `state`** es el que se mando, que es lo que ata la vuelta a la ida: sin el, la puerta
 *     aceptaria un codigo que alguien nos hizo llegar.
 *
 * Lo que no pasa las tres se ignora y se sigue esperando. El marco y el oyente se quitan SIEMPRE.
 *
 * El tope no es suyo: es el `plazo` del intento entero (ver `intentar()`), y cuando vence se
 * devuelve `null`.
 */
function preguntarEnUnMarco(url: string, estado: string, plazo: AbortSignal): Promise<string | null> {
  return new Promise((resolver, rechazar) => {
    // Si el plazo ya vencio —el reto S256 corre bajo el mismo plazo y puede tardar mas—, el `abort`
    // ya paso y no se vuelve a disparar: escucharlo ahora seria esperar para siempre, con la pagina
    // en «Comprobando su sesion…» (ronda 2 del PR #45). No hay a quien esperar: ni se abre el marco.
    if (plazo.aborted) {
      resolver(null);
      return;
    }

    const marco = document.createElement('iframe');
    // Invisible y fuera del arbol de accesibilidad: no hay nada que ver ni que leer ahi dentro.
    marco.style.display = 'none';
    marco.setAttribute('aria-hidden', 'true');
    marco.tabIndex = -1;

    const escuchar = (evento: MessageEvent): void => {
      if (evento.origin !== window.location.origin) return;
      if (evento.source === null || evento.source !== marco.contentWindow) return;
      if (typeof evento.data !== 'string') return;
      if (new URLSearchParams(evento.data).get('state') !== estado) return;
      terminar(() => resolver(evento.data as string));
    };
    const vencido = (): void => terminar(() => resolver(null));
    let terminado = false;
    /** La UNICA salida: contestacion, plazo o excepcion, las tres quitan lo mismo. */
    function terminar(salir: () => void): void {
      if (terminado) return;
      terminado = true;
      plazo.removeEventListener('abort', vencido);
      window.removeEventListener('message', escuchar);
      marco.remove();
      salir();
    }

    // El oyente ANTES que el marco: un emisor rapido podria contestar antes de la linea siguiente.
    window.addEventListener('message', escuchar);
    plazo.addEventListener('abort', vencido);
    try {
      marco.src = url;
      document.body.appendChild(marco);
    } catch (error) {
      // Sin esto el ejecutor rechazaba, pero los dos oyentes quedaban vivos (ronda 2 del PR #45).
      terminar(() => rechazar(error));
    }
  });
}

/** Lo que el canje silencioso necesita: la configuracion de la puerta, y la puerta donde dejar el token. */
export interface ComoPreguntar {
  readonly configuracion: ConfiguracionDeIdentidad;
  readonly identidad: Pick<Identidad, 'fijarToken'>;
  /** El tope del intento ENTERO —marco y canje—; por omision, `ESPERA_DEL_EMISOR`. */
  readonly espera?: number;
}

export interface CanjeSilencioso {
  /**
   * Pregunta al emisor, UNA vez en la vida de la instancia: la segunda llamada —aunque la primera
   * no haya terminado— no abre otro marco y contesta `anonimo`. La instancia del portal es una por
   * carga (constante de modulo), asi que es un intento por carga, con la marca en memoria.
   */
  intentar(): Promise<Silencio>;
}

export function crearSilencio({ configuracion, identidad, espera = ESPERA_DEL_EMISOR }: ComoPreguntar): CanjeSilencioso {
  const { realm, cliente, alcance } = configuracion;
  const vuelta = configuracion.retorno + PAGINA_DE_VUELTA;
  let yaSePregunto = false;

  async function canjear(codigo: string, verificador: string, plazo: AbortSignal): Promise<Silencio> {
    let respuesta: Response;
    try {
      respuesta = await fetch(`${realm}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: cliente,
          code: codigo,
          // La MISMA vuelta que se pidio: el emisor la compara con la de la autorizacion.
          redirect_uri: vuelta,
          code_verifier: verificador,
        }).toString(),
        signal: plazo,
      });
    } catch {
      return plazo.aborted
        ? NO_CONTESTO(espera)
        : fallo(texto(TEXTOS_DEL_SILENCIO.noContesto), texto(TEXTOS_DEL_SILENCIO.canjeNoLlego));
    }
    if (!respuesta.ok) {
      return fallo(
        texto(TEXTOS_DEL_SILENCIO.rechazo),
        texto(TEXTOS_DEL_SILENCIO.rechazoDetalle, { estado: String(respuesta.status) }),
      );
    }
    const cuerpo = (await respuesta.json().catch(() => ({}))) as { access_token?: string; id_token?: string };
    if (cuerpo.access_token === undefined) {
      return fallo(texto(TEXTOS_DEL_SILENCIO.sinToken), texto(TEXTOS_DEL_SILENCIO.sinTokenDetalle));
    }
    identidad.fijarToken(cuerpo.access_token, cuerpo.id_token ?? null);
    return { estado: 'identificado' };
  }

  /**
   * La pregunta y el canje, bajo el plazo que `intentar()` arma. Sin un plazo UNICO, el canje
   * estrenaba el suyo despues de haber esperado ya hasta `espera` al marco, y el peor caso era el
   * doble (revision del PR #45).
   */
  async function preguntarYCanjear(plazo: AbortSignal): Promise<Silencio> {
    const verificador = aleatorio(64);
    const estado = aleatorio(24);
    const parametros = new URLSearchParams({
      response_type: 'code',
      // Dicho, y no heredado del emisor: `silencio.html` lee la busqueda, no el fragmento.
      response_mode: 'query',
      client_id: cliente,
      redirect_uri: vuelta,
      scope: alcance,
      state: estado,
      code_challenge: await reto(verificador),
      code_challenge_method: 'S256',
      prompt: 'none',
    });

    const busqueda = await preguntarEnUnMarco(
      `${realm}/protocol/openid-connect/auth?${parametros.toString()}`,
      estado,
      plazo,
    );
    if (busqueda === null) return NO_CONTESTO(espera);

    const contestacion = new URLSearchParams(busqueda);
    const error = contestacion.get('error');
    if (error !== null) {
      if (NO_HAY_SESION.has(error)) return { estado: 'anonimo' };
      const descripcion = contestacion.get('error_description');
      return fallo(
        motivoDelEmisor(error),
        descripcion === null
          ? texto(TEXTOS_DEL_SILENCIO.contesto, { error })
          : texto(TEXTOS_DEL_SILENCIO.contestoConDescripcion, { error, descripcion }),
      );
    }
    const codigo = contestacion.get('code');
    if (codigo === null) {
      return fallo(texto(TEXTOS_DEL_SILENCIO.sinCodigo), texto(TEXTOS_DEL_SILENCIO.sinCodigoDetalle));
    }
    return canjear(codigo, verificador, plazo);
  }

  return {
    async intentar(): Promise<Silencio> {
      if (yaSePregunto) return { estado: 'anonimo' };
      yaSePregunto = true;

      // Un solo plazo para todo: el reto, el marco y el canje. `setTimeout` y no
      // `AbortSignal.timeout` para que el reloj falso de las pruebas lo pueda adelantar.
      const plazo = new AbortController();
      const tope = setTimeout(() => plazo.abort(), espera);
      try {
        return await preguntarYCanjear(plazo.signal);
      } finally {
        clearTimeout(tope);
      }
    },
  };
}

/** El canje silencioso del portal: la misma puerta que `identidad.ts`, una vez por carga. */
export const silencio: CanjeSilencioso = crearSilencio({ configuracion: configuracionDeLaPuerta(), identidad });
