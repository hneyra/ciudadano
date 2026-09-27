/**
 * **La muestra de `el-texto-del-dom-pasa-por-t.test.ts`** (revision del PR #66): cada forma de
 * escribir texto en la pagina sin React, una por linea y marcada con `// SENALA`, y al final las que se
 * le parecen y NO escriben texto. La prueba exige que la guarda senale exactamente las marcadas.
 *
 * Compila, como el resto de `verificaciones/`: la guarda la juzga con los tipos, y sin tipos no hay
 * muestra que valga. No la importa nadie.
 */

declare const caja: HTMLElement;
declare const nodo: Text;
declare const sinTipo: any; // eslint-disable-line @typescript-eslint/no-explicit-any
declare const texto: string;
declare const otraCaja: HTMLElement;

export function escribeTexto(): void {
  caja.textContent = 'hola'; // SENALA
  caja.innerHTML = '<b>hola</b>'; // SENALA
  caja.textContent += ' y adios'; // SENALA
  caja['textContent'] = 'hola'; // SENALA
  caja.innerText = // SENALA
    'partida en dos lineas';
  /* un comentario delante */ caja.outerHTML = 'hola'; // SENALA
  nodo.nodeValue = 'hola'; // SENALA
  nodo.data = 'hola'; // SENALA
  caja.title = 'hola'; // SENALA
  document.title = 'hola'; // SENALA
  sinTipo.textContent = texto; // SENALA
  caja.append('x'); // SENALA
  caja.prepend(texto); // SENALA
  caja.before('x'); // SENALA
  caja.after(otraCaja, 'x'); // SENALA
  caja.replaceChildren('x'); // SENALA
  caja.replaceWith('x'); // SENALA
  caja.append(sinTipo); // SENALA
  caja.append(new Text('x')); // SENALA
  caja.append(document.createTextNode('x')); // SENALA
  caja.insertAdjacentText('beforeend', 'hola'); // SENALA
  caja.insertAdjacentHTML('beforeend', 'hola'); // SENALA
  document.write('hola'); // SENALA
  caja.setHTMLUnsafe('hola'); // SENALA
  caja.setAttribute('aria-label', 'hola'); // SENALA
  caja.setAttribute('title', 'hola'); // SENALA
  caja.setAttribute(texto, 'hola'); // SENALA
}

export function noEscribeTexto(parametros: URLSearchParams, datos: FormData): void {
  caja.append(otraCaja);
  caja.replaceChildren();
  caja.replaceChildren(otraCaja, nodo);
  caja.setAttribute('role', 'alert');
  caja.setAttribute('aria-hidden', 'true');
  caja.className = 'm-0';
  parametros.append('a', 'b');
  datos.append('a', 'b');
  const objeto = { textContent: 'no es un nodo', title: 'tampoco' };
  objeto.textContent = 'sigue sin serlo';
  objeto.title = 'ni esto';
  if (caja.textContent === 'hola') caja.removeAttribute('title');
  // caja.textContent = 'solo se nombra en un comentario';
}
