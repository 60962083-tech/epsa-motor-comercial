// Dirección temporal (blob:) de un archivo guardado en este navegador
import { useEffect, useState } from "react";
import { leerArchivoLocal } from "../lib/archivos";

const cache = new Map();

export async function urlArchivoLocal(clave) {
  if (!clave) return "";
  if (cache.has(clave)) return cache.get(clave);
  const blob = await leerArchivoLocal(clave);
  if (!blob) return "";
  const url = URL.createObjectURL(blob);
  cache.set(clave, url);
  return url;
}

// Una sola clave
export default function useArchivoLocal(clave) {
  const [url, setUrl] = useState(() => cache.get(clave) || "");
  useEffect(() => {
    let vivo = true;
    if (!clave) { setUrl(""); return undefined; }
    urlArchivoLocal(clave).then((u) => vivo && setUrl(u));
    return () => { vivo = false; };
  }, [clave]);
  return url;
}

// Varias claves a la vez: { clave: url }
export function useArchivosLocales(claves) {
  const llave = [...new Set(claves.filter(Boolean))].sort().join("|");
  const [mapa, setMapa] = useState({});
  useEffect(() => {
    let vivo = true;
    const lista = llave ? llave.split("|") : [];
    Promise.all(lista.map(async (k) => [k, await urlArchivoLocal(k)])).then((pares) => vivo && setMapa(Object.fromEntries(pares.filter(([, u]) => u))));
    return () => { vivo = false; };
  }, [llave]);
  return mapa;
}
