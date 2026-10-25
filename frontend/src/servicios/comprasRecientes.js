// Compras abiertas o registradas desde este equipo
// La lista del servidor (HU-034) solo trae las compras pendientes de factura. Para que una compra no «desaparezca»
// después de registrar su factura, se recuerdan sus números en este navegador y se vuelven a consultar a la API:
// lo que se muestra siempre es el dato real y vigente de la base.
const CLAVE = "epsa-compras-recientes";
const MAXIMO = 30;

export function recordarCompra(codcom) {
  const id = String(codcom || "");
  if (!/^[1-9]\d*$/.test(id)) return;
  try {
    const lista = JSON.parse(localStorage.getItem(CLAVE) || "[]").filter((x) => x !== id);
    localStorage.setItem(CLAVE, JSON.stringify([id, ...lista].slice(0, MAXIMO)));
  } catch {}
}

export function comprasRecordadas() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "[]").filter((x) => /^[1-9]\d*$/.test(x)); } catch { return []; }
}

export function olvidarCompra(codcom) {
  try { localStorage.setItem(CLAVE, JSON.stringify(comprasRecordadas().filter((x) => x !== String(codcom)))); } catch {}
}
