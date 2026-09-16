// Viola: las peticiones pasan por «solicitar» del cliente, no por un `fetch` suelto.
//
// En este portal, ademas, no hay cliente: es solo demostracion y los datos salen de `src/datos/`.
// `SALVO_EN_ESTE_ARBOL` situa la excepcion en `[]`, asi que este `fetch` es rojo en cualquier
// directorio, tambien en el `src/api/` que `rentas` si exceptua.
export async function traerRecibos() {
  const respuesta = await fetch('/portal/api/v1/recibos');
  return respuesta.json();
}
