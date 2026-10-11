// Descarga las fotos de los modelos a public/images (npm run imagenes)
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { MODELOS, TORITO_ICONOS, LOGO_TORITO, SELLO_BAJAJ } from "../src/data/mockData.js";

const LISTA = [];
for (const m of MODELOS) {
  if (m.imagen && m.local) LISTA.push([m.imagen, m.local]);
  for (const [color, url] of Object.entries(m.fotosColor || {})) LISTA.push([url, `/images/modelos/${m.id}/${color.toLowerCase()}.png`]);
  (m.angulos360 || []).forEach((url, k) => LISTA.push([url, `/images/360/${m.id}/${String(k + 1).padStart(2, "0")}.png`]));
}
for (const [clave, url] of Object.entries(TORITO_ICONOS)) LISTA.push([url, `/images/iconos/${clave.toLowerCase()}.svg`]);
LISTA.push([LOGO_TORITO, "/images/marcas/torito.png"], [SELLO_BAJAJ, "/images/marcas/bajaj-100-paises.png"]);
LISTA.push(["https://epsamotor.com.pe/assets/media/images/RE_torito.png", "/images/nosotros/torito.png"]);

let ok = 0;
for (const [url, ruta] of LISTA) {
  const destino = `public${ruta}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (EPSA Motor build)", Referer: new URL(url).origin + "/" } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, Buffer.from(await r.arrayBuffer()));
    console.log("OK   ", destino); ok++;
  } catch (e) { console.log("FALLO", destino, "-", e.message); }
}
console.log(`\n${ok}/${LISTA.length} imágenes guardadas en public/images. Súbelas al repositorio para que Netlify las publique.`);
