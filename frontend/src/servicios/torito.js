// HU-036 · Información de torito.pe leída en vivo
// Supabase lee la web oficial desde el servidor (docs/supabase-torito-en-vivo.sql) y el panel saca de cada página
// el precio, los colores, la descripción, la ficha técnica y las fotos. Con eso arma la misma ficha que guarda la
// API de modelos. Si torito.pe no responde, el panel usa la ficha oficial que ya trae (data/catalogoTorito.js).
import { paginaToritoApi } from "../lib/api";
import { CATALOGO_TORITO } from "../data/catalogoTorito";
import { COLORES, MODELOS } from "../data/mockData";
import { fichaATexto, textoAFicha } from "../lib/fichaModelo";

// Página de cada modelo en torito.pe (vínculo explícito, no por parecido del nombre)
export const PAGINA_TORITO = {
  "Torito 4V GSL": "torito-4v-gsl",
  "Torito 4V GLP": "torito-4v-glp",
  "Torito 4V GNV": "torito-4v-gnv",
  "Torito 250 4V GLP": "torito-250-4v-glp",
  "Torito Crom Plus GNV": "4t-gnv",
  "Torito Crom Plus GLP": "4t-plus-glp",
  "Torito Crom Plus GSL": "4t-plus-gsl",
  "Torito 2T UG GLP": "2t-ug-glp",
  "Torito 2T UG GSL": "2t-ug-gsl",
};
const FAMILIAS = ["Motores 4 Válvulas", "Motores 2 Tiempos", "Motores Crom Plus"];
// Familia en la base (tipomotocar) para crear un modelo nuevo
export const CODTMO = { "Motores 2 Tiempos": "2", "Motores 4 Válvulas": "3", "Motores Crom Plus": "4" };
// Página de torito.pe de un modelo de la base: la guardada en su ficha o la de la lista de arriba
export const paginaDe = (m) => textoAFicha(m?.carmod).generales.paginaTorito || PAGINA_TORITO[m?.nommod] || "";
// «MAXIMA 4V GLP» → «Torito Maxima 4V GLP»
const nombreModelo = (t) => {
  const n = limpio(t).split(" ").map((w) => (/\d|^(GLP|GNV|GSL|UG)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(" ");
  return /^torito\b/i.test(n) ? n : `Torito ${n}`;
};
const SECCION = [[/motor/, "motor"], [/chasis|carroceria/, "chasis"], [/consumo|rendimiento/, "consumo"], [/dimension/, "dimensiones"], [/electric/, "electrico"]];

// ---------------------------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------------------------
const doc = (html) => new DOMParser().parseFromString(String(html || ""), "text/html");
const limpio = (t) => String(t || "").replace(/\s+/g, " ").trim();
const sinTildes = (t) => limpio(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
// «DIÁMETRO × CARRERA» → «Diámetro × carrera»
const oracion = (t) => { const s = limpio(t).toLocaleLowerCase("es"); return s.charAt(0).toLocaleUpperCase("es") + s.slice(1); };
// «s/.17,899» o «S/ 17,899.00» → 17899
const precioDe = (t) => { const m = String(t || "").match(/\d[\d,]*(?:\.\d+)?/); const n = Math.round(Number((m?.[0] || "").replace(/,/g, ""))); return n > 0 ? n : null; };
const colorDe = (texto) => COLORES.find((c) => sinTildes(texto).includes(sinTildes(c))) || null;
// Color por tono, si la foto no dice el color en su nombre
const TONOS = { Rojo: [255, 0, 0], Azul: [0, 156, 230], Verde: [129, 215, 66], Amarillo: [238, 238, 34], Negro: [0, 0, 0] };
function colorPorTono(hex) {
  const m = String(hex || "").match(/#([0-9a-f]{6})/i);
  if (!m) return null;
  const v = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return Object.entries(TONOS).sort(([, a], [, b]) => a.reduce((s, x, i) => s + (x - v[i]) ** 2, 0) - b.reduce((s, x, i) => s + (x - v[i]) ** 2, 0))[0][0];
}
const sinWebp = (u) => String(u || "").replace(/\.(png|jpe?g)\.webp$/i, ".$1");

// ---------------------------------------------------------------------------------------------
// Página «Productos»: nombre, familia, precio, foto y etiquetas de cada modelo
// ---------------------------------------------------------------------------------------------
export function leerListado(html) {
  return [...doc(html).querySelectorAll("article.products-page-item")].map((a) => {
    const slug = (a.querySelector('a[href*="/producto/"]')?.getAttribute("href") || "").match(/\/producto\/([^/]+)/)?.[1] || "";
    return {
      slug,
      nombre: limpio(a.querySelector(".item-product-title-text")?.textContent),
      familia: limpio(a.querySelector(".item-product-category")?.textContent),
      precio: precioDe(a.querySelector("._price")?.textContent),
      imagen: sinWebp(a.querySelector("img")?.getAttribute("src")),
      etiquetas: [...a.querySelectorAll(".item-product-categorie")].map((e) => limpio(e.textContent).toUpperCase()).filter(Boolean),
    };
  }).filter((p) => p.slug);
}

// ---------------------------------------------------------------------------------------------
// Página de un modelo: precio, descripción, colores con su foto, resumen, destacados y ficha técnica
// ---------------------------------------------------------------------------------------------
export function leerProducto(html) {
  const d = doc(html);
  const principal = d.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";
  // Colores: cada uno trae sus fotos de 360°; la primera es la foto de ese color
  const fotosColor = {};
  for (const li of d.querySelectorAll(".product-detail-360-colors .product-detail-360-item")) {
    let fotos = [];
    try { fotos = JSON.parse(li.getAttribute("data-frames") || "[]"); } catch { fotos = []; }
    const color = colorDe(fotos[0] || "") || colorPorTono(li.querySelector("._circle")?.getAttribute("style"));
    if (color && fotos[0] && !fotosColor[color]) fotosColor[color] = fotos[0];
  }
  // Ficha técnica por pestañas (Motor, Chasis y carrocería, Consumo y rendimiento, Dimensiones, Sistema eléctrico)
  const titulos = [...d.querySelectorAll(".product-detail-details-link-text")].map((e) => sinTildes(e.textContent));
  const specs = { motor: [], chasis: [], consumo: [], dimensiones: [], electrico: [] };
  [...d.querySelectorAll(".product--detail-tab-content")].forEach((tab, i) => {
    const clave = SECCION.find(([re]) => re.test(titulos[i] || ""))?.[1];
    if (!clave) return;
    for (const li of tab.querySelectorAll("li")) {
      const k = oracion(li.querySelector("._title")?.textContent);
      const v = limpio(li.querySelector("._text")?.textContent);
      if (!k || !v) continue;
      // «Largo: 2,635 mm – Ancho: 1,350 mm – Alto: 1,710 mm» se separa en tres datos
      const partes = v.split(/\s+[–-]\s+/).map((x) => x.match(/^([^:]{2,30}):\s*(.+)$/)).filter(Boolean);
      if (partes.length > 1) partes.forEach((p) => specs[clave].push([oracion(p[1]), limpio(p[2])]));
      else specs[clave].push([k, v]);
    }
  });
  // Resumen de la cabecera (motor, cilindrada, llantas, potencia, torque)
  const resumen = {};
  for (const it of d.querySelectorAll(".product-detail-characteristics-list-item")) {
    const k = oracion(it.querySelector(".product-detail-characteristics-list-item-title-text")?.textContent);
    const v = limpio(it.querySelector(".product-detail-characteristics-list-item-text")?.textContent);
    if (k && v && !resumen[k]) resumen[k] = v;
  }
  // Destacados: los títulos de la sección de tecnología
  let destacados = [];
  const script = [...d.querySelectorAll("script")].map((s) => s.textContent).find((t) => t.includes("listImagesDesktop"));
  const json = script?.match(/listImagesDesktop\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  try { destacados = JSON.parse(json || "[]").map((x) => oracion(x.title)).filter(Boolean).slice(0, 4); } catch { destacados = []; }
  const descripcion = limpio([...d.querySelectorAll(".product-detail-banner-description p")].map((p) => p.textContent).join(" "))
    || limpio(d.querySelector(".product-detail-characteristics-text")?.textContent);
  return {
    precio: precioDe(d.querySelector(".product-detail-price ._price, ._price")?.textContent),
    descripcion, principal, colorFoto: colorDe(principal) || Object.keys(fotosColor)[0] || "",
    fotosColor, colores: COLORES.filter((c) => fotosColor[c]), resumen, destacados, specs,
  };
}

// ---------------------------------------------------------------------------------------------
// Catálogo en vivo con la misma forma que CATALOGO_TORITO (para revisar y guardar con la API)
// ---------------------------------------------------------------------------------------------
export async function catalogoEnVivo(modelosBase = []) {
  const listado = leerListado(await paginaToritoApi("/productos/"));
  if (!listado.length) throw new Error("La página de productos de torito.pe no trajo modelos.");
  // Páginas de torito.pe que ya tienen su modelo en la base
  const enBase = new Map(modelosBase.map((m) => [paginaDe(m), m]).filter(([slug]) => slug));
  const nombreDeSlug = Object.fromEntries(Object.entries(PAGINA_TORITO).map(([n, slug]) => [slug, n]));
  // Las páginas de los modelos se leen a la vez (más rápido); la que falle usa la ficha guardada
  const paginas = await Promise.all(listado.map((item) => paginaToritoApi(`/producto/${item.slug}/`).then(leerProducto).catch(() => null)));
  const catalogo = [];
  const fallas = [];
  for (const [i, item] of listado.entries()) {
    const nombre = nombreDeSlug[item.slug] || enBase.get(item.slug)?.nommod || nombreModelo(item.nombre);
    const base = CATALOGO_TORITO.find((o) => o.nombre === nombre) || { nombre, precio: null, colores: [], descripcion: "", fotos: [] };
    const ref = MODELOS.find((m) => m.nombre === nombre) || {};
    const p = paginas[i];
    if (!p) fallas.push(nombre);
    // Sin su página, se usa lo de la lista (precio, foto y etiquetas) y la ficha oficial guardada
    const nombreTxt = `${nombre} ${p?.resumen?.Motor || ""}`;
    const familia = FAMILIAS.includes(item.familia) ? item.familia
      : ref.familia || (/crom/i.test(nombre) ? "Motores Crom Plus" : /\b2t\b/i.test(nombre) ? "Motores 2 Tiempos" : "Motores 4 Válvulas");
    const ficha = {
      familia,
      tipoMotor: /2\s*tiempos|\b2t\b/i.test(nombreTxt) ? "2 tiempos" : /4\s*tiempos|4v|v[aá]lvulas|crom/i.test(nombreTxt) ? "4 tiempos" : ref.tipoMotor || "4 tiempos",
      combustible: /\bglp\b/i.test(nombre) ? "GLP" : /\bgnv\b/i.test(nombre) ? "GNV" : "Gasolina",
      uso: ref.uso || (/carga/i.test(item.familia) ? "Carga" : "Pasajeros"), tipoTecho: ref.tipoTecho || "",
      badges: item.etiquetas.length ? item.etiquetas : ref.badges || [],
      destacados: p?.destacados?.length ? p.destacados : ref.destacados || [],
      resumen: p && Object.keys(p.resumen).length ? p.resumen : ref.resumen || {},
      specs: p && Object.values(p.specs).some((x) => x.length) ? p.specs : ref.specs || {},
      colorFoto: p?.colorFoto || ref.colorFoto || colorDe(item.imagen) || "",
      paginaTorito: item.slug,
    };
    const fotos = [...new Set([p?.principal || item.imagen, ...Object.values(p?.fotosColor || {})].filter((u) => /^https:\/\//i.test(String(u || ""))))];
    ficha.fotosColor = p && Object.keys(p.fotosColor).length
      ? { ...(p.principal && p.colorFoto ? { [p.colorFoto]: p.principal } : {}), ...p.fotosColor }
      : fotos[0] ? { [ficha.colorFoto || base.colores[0] || "Rojo"]: fotos[0] } : {};
    const texto = fichaATexto(ficha);
    const descripcion = p?.descripcion && p.descripcion.length >= 40 ? p.descripcion
      : base.descripcion || `${nombre}: motocar Torito Bajaj de la familia ${familia}. Consulta precio, colores y financiamiento con un asesor de EPSA Motor.`;
    catalogo.push({
      nombre, slug: item.slug, enVivo: true, codtmo: CODTMO[familia] || "3",
      precio: p?.precio || item.precio || base.precio,
      colores: p?.colores?.length ? p.colores : base.colores.length ? base.colores : [colorDe(item.imagen)].filter(Boolean),
      descripcion, ficha: texto,
      datos: texto.split("\n").filter((l) => /^[^:]+:\s*\S/.test(l) && !/:\s*https:\/\//.test(l)).length,
      fotos: fotos.length ? fotos : base.fotos,
    });
  }
  // Modelos del panel que torito.pe ya no muestra en su lista: se conserva su ficha oficial guardada
  for (const base of CATALOGO_TORITO) if (!catalogo.some((o) => o.nombre === base.nombre)) { catalogo.push(base); fallas.push(base.nombre); }
  return { catalogo, fallas, leido: new Date().toISOString() };
}
