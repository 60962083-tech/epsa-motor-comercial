// Foto del modelo (con su color)
import { useState } from "react";
import MotoIllustration from "./MotoIllustration";
import { filtroEntre } from "../data/mockData";

export function fotoDeColor(modelo, color) {
  const c = color || modelo.colorPortada || modelo.colores?.[0];
  const propia = c && modelo.fotosColor?.[c];
  if (propia) return { src: propia, filtro: "" };
  const conRoja = modelo.fotosColor?.Rojo;
  const src = conRoja || modelo.imagenApi || modelo.imagen;
  const colorDeLaFoto = conRoja ? "Rojo" : modelo.colorFoto || "Rojo";
  return { src, filtro: filtroEntre(colorDeLaFoto, c) };
}

export default function ModeloImg({ modelo, color, className = "", alt }) {
  const { src, filtro } = fotoDeColor(modelo, color);
  const fuentes = [...new Set([src, modelo.imagenApi || modelo.imagen, modelo.local].filter(Boolean))];
  const [paso, setPaso] = useState({ clave: "", n: 0 });
  const clave = fuentes.join("|");
  const n = paso.clave === clave ? paso.n : 0;
  if (n >= fuentes.length) return <MotoIllustration className={`${className} p-4 opacity-30`} />;
  return (
    <img
      key={fuentes[n]}
      src={fuentes[n]}
      alt={alt ?? `${modelo.nombre}${color ? ` color ${color}` : ""}`}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setPaso({ clave, n: n + 1 })}
      className={`${className} transition-[filter] duration-300`}
      style={filtro && n === 0 ? { filter: filtro } : undefined}
      data-color={color || ""}
    />
  );
}
