import type { ReactNode } from 'react';

/**
 * La muestra de `sin-frases-temporales.test.ts` (issue 64): cada frase temporal, en un comentario y
 * marcada al final de su linea con el marcador que la prueba busca; y lo que se les parece y NO se
 * senala (otra palabra, una cadena, una plantilla, una expresion regular, el texto de un JSX, y la
 * palabra que significa «incluso»). La prueba exige que la guarda senale exactamente las lineas
 * marcadas.
 *
 * Compila, como el resto de `verificaciones/`. No la importa nadie.
 */

// Se senala: una por frase, y con mayusculas.
// hoy el reductor vale asi // SENALA
// Hoy tambien, con mayuscula // SENALA
// esto todavia no existe // SENALA
// y todavía con tilde // SENALA
// el campo ya no se usa // SENALA
// el campo ya   no se usa, con espacios // SENALA
// lo que esta entrega anade // SENALA
// por ahora vale asi // SENALA
// de momento no se mide // SENALA
// aún con tilde siempre es todavia // SENALA
// aun no se sabe // SENALA
// aun sin red, que tambien puede ser todavia // SENALA
/* un bloque en una linea: hoy */ // SENALA
/**
 * y un bloque de varias: la segunda linea dice hoy // SENALA
 */
export function conFrases(): string {
  const valor = 'uno'; // y detras de codigo, todavia // SENALA
  return valor;
}

export function enJsx(): ReactNode {
  return <p>{/* un comentario dentro del JSX dice hoy */}</p>; // SENALA
}

// No se senala: otra palabra que contiene la frase.
// un hoyo en la calle, ahoy, hoyuelo, yanomami, aunque, ayuno
// aun asi se lee; aun cuando falle; aun si no llega; aun mas; ni aun eso
// esta entregada, por ahorita, de momentos: son otras palabras

// No se senala: no son comentarios.
export const cadena = 'hoy todavia ya no';
export const plantilla = `por ahora ${cadena} de momento`;
export const patron = /aun no|hoy/;

export function textoDeJsx(): ReactNode {
  return <p>// hoy es texto de la pagina, no un comentario</p>;
}
