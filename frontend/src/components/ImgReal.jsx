// Imagen con respaldo local
import { useState } from "react";

export default function ImgReal({ src, local, alt = "", className = "", alternativa = null, ...resto }) {
  const fuentes = [src, local].filter(Boolean);
  const [paso, setPaso] = useState({ clave: "", n: 0 });
  const clave = fuentes.join("|");
  const n = paso.clave === clave ? paso.n : 0;
  if (n >= fuentes.length) return alternativa;
  return <img key={fuentes[n]} src={fuentes[n]} alt={alt} referrerPolicy="no-referrer" loading="lazy" onError={() => setPaso({ clave, n: n + 1 })} className={className} {...resto} />;
}
