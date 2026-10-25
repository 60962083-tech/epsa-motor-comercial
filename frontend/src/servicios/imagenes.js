// HU-036 · Fotos de cada modelo (galería)
// Hoy se guardan en este navegador: los enlaces en la lista y las fotos subidas en IndexedDB.
// Al conectar con la base: GET y POST /api/modelos/:id/imagenes (subida a Storage), PUT para orden,
// principal y color, PATCH para mostrar u ocultar, y POST /api/modelos/:id/imagenes/importar (torito.pe).
import { useMemo } from "react";
import { useApp } from "../store/appStore.jsx";
import { useAuth } from "../context/AuthContext";
import { MODELOS } from "../data/mockData";
import { comprimirImagen, guardarArchivoLocal, borrarArchivoLocal, validarFoto } from "../lib/archivos";
import { hoyLocal } from "../lib/validar";
import { siguienteId } from "../lib/sprint2";
import { ordenarFotos as ordenar } from "../lib/galeria";

export { aplicarGaleria } from "../lib/galeria";
export const MAX_FOTOS = 12;

// Enlace de una foto: https, con dominio y sin espacios
export function validarEnlaceFoto(url) {
  const t = String(url || "").trim();
  if (!t) return "Pega el enlace de la foto.";
  if (/\s/.test(t)) return "El enlace no puede tener espacios.";
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return "Usa un enlace que empiece con https://";
    if (!/\.[a-z]{2,}$/i.test(u.hostname) || u.username || u.password) return "Ese enlace no es válido.";
  } catch { return "Ese enlace no es válido."; }
  return "";
}

// Fotos oficiales conocidas de un modelo (las mismas que trae el script de torito.pe)
export function fotosOficiales(modeloId) {
  const m = MODELOS.find((x) => x.id === modeloId);
  if (!m) return [];
  const lista = [];
  if (m.imagen) lista.push({ url: m.imagen, color: m.colorFoto || (m.colores?.length === 1 ? m.colores[0] : "Rojo") });
  for (const [color, url] of Object.entries(m.fotosColor || {})) if (!lista.some((x) => x.url === url)) lista.push({ url, color });
  return lista;
}

// Galería de un modelo en el panel
export function useGaleria(modelo) {
  const { imagenes = [], urlsFotos = {}, agregar, actualizar, eliminar, configurar, config } = useApp();
  const { user } = useAuth();
  const id = modelo?.id;
  const fotos = useMemo(() => imagenes.filter((i) => i.modelo === id).sort(ordenar).map((i) => ({ ...i, src: i.url || urlsFotos[i.archivo] || "" })), [imagenes, id, urlsFotos]);
  const activas = fotos.filter((f) => f.activa);
  const publicado = modelo?.estado === "Publicado";
  const marcar = (detalle) => configurar({ galeriaEditada: { ...config?.galeriaEditada, [id]: true } }, `${modelo.nombre}: ${detalle}`);
  const siguienteOrden = () => fotos.reduce((mx, f) => Math.max(mx, f.orden), 0) + 1;
  const nuevaFoto = (extra, n) => ({ id: siguienteId(imagenes) + n, modelo: id, url: "", archivo: "", orden: siguienteOrden() + n, principal: false, color: "", activa: true, fecha: hoyLocal(), usuario: user.nombre, ...extra });
  const sinPrincipal = !activas.some((f) => f.principal);

  // Subir fotos desde la computadora
  async function subir(archivos) {
    const lista = [...archivos];
    if (!lista.length) return { error: "Elige al menos una foto." };
    if (fotos.length + lista.length > MAX_FOTOS) return { error: `Cada modelo admite hasta ${MAX_FOTOS} fotos. Quita alguna antes de subir más.` };
    for (const a of lista) { const e = validarFoto(a); if (e) return { error: e }; }
    let n = 0;
    for (const a of lista) {
      const blob = await comprimirImagen(a, { lado: 1600, calidad: 0.86 });
      const clave = `fotos/${id}/${Date.now()}-${n}.webp`;
      await guardarArchivoLocal(clave, blob);
      agregar("imagenes", nuevaFoto({ archivo: clave, origen: "Subida", nombre: a.name, principal: sinPrincipal && n === 0 }, n));
      n++;
    }
    marcar(`${n} foto(s) subida(s)`);
    return { ok: `${n === 1 ? "Foto subida" : `${n} fotos subidas`}. Elige su color si corresponde.` };
  }

  // Agregar por enlace
  function agregarEnlace(url, color = "") {
    const e = validarEnlaceFoto(url);
    if (e) return { error: e };
    const t = url.trim();
    if (fotos.some((f) => f.url === t)) return { error: "Esa foto ya está en la galería." };
    if (fotos.length >= MAX_FOTOS) return { error: `Cada modelo admite hasta ${MAX_FOTOS} fotos.` };
    agregar("imagenes", nuevaFoto({ url: t, origen: "Enlace", color, principal: sinPrincipal }, 0));
    marcar("foto agregada por enlace");
    return { ok: "Foto agregada." };
  }

  // Traer las fotos oficiales que falten
  const oficialesFaltantes = fotosOficiales(id).filter((o) => !fotos.some((f) => f.url === o.url));
  function importarOficiales(urls) {
    const elegidas = oficialesFaltantes.filter((o) => urls.includes(o.url));
    if (!elegidas.length) return { error: "Elige al menos una foto oficial." };
    if (fotos.length + elegidas.length > MAX_FOTOS) return { error: `Cada modelo admite hasta ${MAX_FOTOS} fotos.` };
    elegidas.forEach((o, n) => agregar("imagenes", nuevaFoto({ url: o.url, color: o.color, origen: "Oficial", principal: sinPrincipal && n === 0 }, n)));
    marcar(`${elegidas.length} foto(s) oficial(es) de torito.pe`);
    return { ok: `${elegidas.length === 1 ? "Foto oficial agregada" : `${elegidas.length} fotos oficiales agregadas`}.` };
  }

  // Elegir la principal
  function hacerPrincipal(f) {
    if (!f.activa) return { error: "Primero muestra esta foto en la web." };
    fotos.filter((x) => x.principal && x.id !== f.id).forEach((x) => actualizar("imagenes", x.id, { principal: false }));
    actualizar("imagenes", f.id, { principal: true });
    marcar("cambió la foto principal");
    return { ok: "Foto principal actualizada. Es la que se ve en el catálogo." };
  }

  // Color de la foto
  function cambiarColor(f, color) {
    actualizar("imagenes", f.id, { color });
    marcar(`foto ${color ? `del color ${color}` : "sin color"}`);
    return { ok: color ? `Al elegir ${color} en la web se verá esta foto.` : "Foto sin color asignado." };
  }

  // Mostrar u ocultar en la web
  function alternarActiva(f) {
    if (f.activa) {
      if (publicado && activas.length === 1) return { error: "Es la única foto visible de un modelo publicado. Agrega otra antes de ocultarla." };
      if (f.principal) return { error: "Es la foto principal. Elige otra como principal antes de ocultarla." };
    }
    actualizar("imagenes", f.id, { activa: !f.activa });
    marcar(f.activa ? "ocultó una foto" : "mostró una foto");
    return { ok: f.activa ? "La foto ya no se muestra en la web." : "La foto se muestra en la web." };
  }

  // Ordenar (antes o después)
  function mover(f, paso) {
    const i = fotos.findIndex((x) => x.id === f.id);
    const otra = fotos[i + paso];
    if (!otra) return { error: "" };
    actualizar("imagenes", f.id, { orden: otra.orden });
    actualizar("imagenes", otra.id, { orden: f.orden === otra.orden ? f.orden + paso : f.orden });
    marcar("cambió el orden de las fotos");
    return { ok: "" };
  }

  // Quitar de la galería
  async function quitar(f) {
    if (f.activa && publicado && activas.length === 1) return { error: "Es la única foto visible de un modelo publicado. Agrega otra antes de quitarla." };
    if (f.principal) {
      const otra = activas.find((x) => x.id !== f.id);
      if (otra) actualizar("imagenes", otra.id, { principal: true });
    }
    eliminar("imagenes", f.id);
    if (f.archivo) await borrarArchivoLocal(f.archivo);
    marcar("quitó una foto");
    return { ok: "Foto quitada de la galería." };
  }

  return { fotos, activas, oficialesFaltantes, subir, agregarEnlace, importarOficiales, hacerPrincipal, cambiarColor, alternarActiva, mover, quitar, max: MAX_FOTOS };
}
