import { useState } from "react";
import MotoIllustration from "./MotoIllustration";

/**
 * Foto real del modelo. Orden: 1) foto real de ese color (torito.pe o /images/modelos/<id>/<color>.png),
 * 2) foto oficial torito.pe / backend, 3) copia local, 4) silueta neutra.
 */
export default function ModeloImg({ modelo, color, className = "", alt }) {
  const principal = modelo.imagenApi || modelo.imagen;
  const remotaColor = color && modelo.fotosColor?.[color];
  const localColor = color ? `/images/modelos/${modelo.id}/${color.toLowerCase()}.png` : null;
  const fuentes = [...new Set([remotaColor, localColor, principal, modelo.local].filter(Boolean))];
  const [paso, setPaso] = useState({ clave: "", n: 0 });
  const clave = fuentes.join("|");
  const n = paso.clave === clave ? paso.n : 0;
  if (n >= fuentes.length) return <MotoIllustration className={`${className} p-4 opacity-30`} />;
  return (
    <img
      key={fuentes[n]}
      src={fuentes[n]}
      alt={alt ?? modelo.nombre}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setPaso({ clave, n: n + 1 })}
      className={className}
    />
  );
}
