// HU-036 · Traer el catálogo oficial de torito.pe a la base (precios, colores y fotos de cada modelo)
// Compara cada modelo de la base con la ficha oficial de torito.pe y guarda las diferencias con la misma API del
// panel (PUT /api/modelos/:id y POST /api/modelos/:id/imagenes). No borra nada: completa precios y colores que
// están vacíos, agrega las fotos oficiales que faltan y desactiva solo las fotos de torito.pe que el modelo
// comparte con otro modelo distinto (las que hacían que la web mostrara la misma moto en varios modelos).
import { useMemo, useState } from "react";
import { CATALOGO_TORITO, claveModelo } from "../../data/catalogoTorito";
import { editarModeloApi as actualizarModeloApi } from "../../lib/api";
import { enlazarFotoModeloApi, estadoFotoModeloApi } from "../../servicios/central";
import { mensajeError } from "../../lib/errores";
import { formatoSoles } from "../../data/mockData";
import { Aviso, Modal } from "../ui";
import { Pill } from "./Sprint2";

const deTorito = (url) => /^https:\/\/torito\.pe\//i.test(String(url || ""));

// ---------------------------------------------------------------------------------------------
// Qué cambiaría en cada modelo
// ---------------------------------------------------------------------------------------------
export function planSincronizacion(modelos = []) {
  const oficialDe = (m) => CATALOGO_TORITO.find((o) => claveModelo(o.nombre) === claveModelo(m.nommod)) || null;
  // Fotos activas en uso y foto principal oficial de cada modelo de la base
  const usoFoto = new Map();
  for (const m of modelos) for (const i of m.imagenes || []) if (i.estimo !== false) usoFoto.set(i.urlimo, (usoFoto.get(i.urlimo) || 0) + 1);
  const principales = new Set(modelos.map((m) => oficialDe(m)?.fotos[0]).filter(Boolean));
  return modelos.map((m) => {
    const oficial = oficialDe(m);
    if (!oficial) return { m, oficial: null, cambios: [] };
    const imagenes = m.imagenes || [];
    const principal = oficial.fotos[0];
    // Una foto oficial extra no se agrega si es la principal de otro modelo (así ninguna moto se repite)
    const propia = (url) => url === principal || !principales.has(url);
    const cambios = [];
    if ((m.premod === null || m.premod === undefined || m.premod === "") && oficial.precio) cambios.push({ tipo: "precio", valor: oficial.precio, texto: `Precio ${formatoSoles(oficial.precio)}` });
    if (!(m.colores || []).length && oficial.colores.length) cambios.push({ tipo: "colores", valor: oficial.colores, texto: `Colores: ${oficial.colores.join(", ")}` });
    if (principal) {
      for (const i of imagenes.filter((x) => x.estimo !== false && deTorito(x.urlimo) && x.urlimo !== principal)) {
        if (usoFoto.get(i.urlimo) > 1 || !propia(i.urlimo)) cambios.push({ tipo: "quitar", imagen: i, texto: "Ocultar foto repetida" });
      }
      let orden = Math.max(0, ...imagenes.map((i) => Number(i.ordimo) || 0));
      for (const url of oficial.fotos.filter(propia)) {
        const existe = imagenes.find((i) => i.urlimo === url);
        if (existe && existe.estimo === false) cambios.push({ tipo: "activar", imagen: existe, texto: "Mostrar foto oficial" });
        if (!existe) cambios.push({ tipo: "foto", url, ordimo: url === principal && !imagenes.some((i) => i.estimo !== false && i.urlimo !== principal && !cambiaraQuitar(cambios, i)) ? 1 : ++orden, texto: "Agregar foto oficial" });
      }
    }
    return { m, oficial, cambios };
  });
}
const cambiaraQuitar = (cambios, i) => cambios.some((c) => c.tipo === "quitar" && c.imagen.codimo === i.codimo);

// ---------------------------------------------------------------------------------------------
// Ventana: revisar y aplicar
// ---------------------------------------------------------------------------------------------
export default function SincronizarTorito({ abierto, modelos, onClose, onHecho }) {
  const plan = useMemo(() => (abierto ? planSincronizacion(modelos || []) : []), [abierto, modelos]);
  const conCambios = plan.filter((p) => p.cambios.length);
  const [elegidos, setElegidos] = useState(null);
  const [estado, setEstado] = useState({ corriendo: false, hecho: false, resultados: {} });
  const marcados = elegidos ?? new Set(conCambios.map((p) => String(p.m.codmod)));
  if (!abierto) return null;

  function alternar(codmod) {
    const s = new Set(marcados);
    if (s.has(codmod)) s.delete(codmod); else s.add(codmod);
    setElegidos(s);
  }
  function cerrar() { setElegidos(null); setEstado({ corriendo: false, hecho: false, resultados: {} }); onClose(); }

  async function aplicar() {
    setEstado({ corriendo: true, hecho: false, resultados: {} });
    const resultados = {};
    for (const p of conCambios.filter((x) => marcados.has(String(x.m.codmod)))) {
      const id = String(p.m.codmod);
      try {
        const datos = {};
        for (const c of p.cambios) { if (c.tipo === "precio") datos.premod = c.valor; if (c.tipo === "colores") datos.colores = c.valor; }
        if (Object.keys(datos).length) await actualizarModeloApi(id, datos);
        // Primero las fotos oficiales nuevas y después se ocultan las repetidas: el modelo nunca queda sin foto
        for (const c of p.cambios.filter((x) => x.tipo === "foto")) await enlazarFotoModeloApi(id, c.url, c.ordimo);
        for (const c of p.cambios.filter((x) => x.tipo === "activar")) await estadoFotoModeloApi(id, c.imagen.codimo, true);
        for (const c of p.cambios.filter((x) => x.tipo === "quitar")) await estadoFotoModeloApi(id, c.imagen.codimo, false);
        resultados[id] = { ok: true };
      } catch (e) { resultados[id] = { ok: false, error: mensajeError(e) }; }
      setEstado({ corriendo: true, hecho: false, resultados: { ...resultados } });
    }
    setEstado({ corriendo: false, hecho: true, resultados });
    onHecho?.();
  }

  const fallas = Object.values(estado.resultados).filter((r) => !r.ok).length;
  return (
    <Modal abierto onClose={estado.corriendo ? () => {} : cerrar} titulo="Traer datos de torito.pe" ancho="max-w-2xl" sinAvisoCambios confirmarGuardar={false}
      pie={estado.hecho
        ? <button className="btn btn-primary !py-2" onClick={cerrar}>Listo</button>
        : <><button className="btn btn-secondary !py-2" onClick={cerrar} disabled={estado.corriendo}>Cancelar</button>
          <button className="btn btn-primary !py-2" onClick={aplicar} disabled={estado.corriendo || marcados.size === 0} data-aplicar-torito>{estado.corriendo ? "Guardando…" : `Aplicar en ${marcados.size} modelo${marcados.size === 1 ? "" : "s"}`}</button></>}>
      <div className="space-y-4" data-sincronizar-torito>
        <p className="text-[13.5px] text-slate-600 dark:text-white/70">Completa cada modelo con su ficha oficial de torito.pe: precio y colores si están vacíos, y sus fotos oficiales. No cambia lo que ya editaste ni borra fotos subidas por el equipo.</p>
        {estado.hecho && <Aviso tipo={fallas ? "aviso" : "ok"}>{fallas ? `Se guardaron los cambios, salvo en ${fallas} modelo${fallas === 1 ? "" : "s"}. Revisa el detalle.` : "Listo: la web ya muestra los datos de torito.pe."}</Aviso>}
        {conCambios.length === 0 ? <Aviso tipo="ok">Todos los modelos ya tienen su precio, colores y fotos oficiales.</Aviso> : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-white/10 dark:border-white/10">
            {conCambios.map(({ m, cambios }) => {
              const id = String(m.codmod); const r = estado.resultados[id];
              return (
                <li key={id} className="flex items-start gap-3 px-4 py-3" data-torito-modelo={m.nommod}>
                  <input type="checkbox" className="mt-1 h-4 w-4" checked={marcados.has(id)} disabled={estado.corriendo || estado.hecho} onChange={() => alternar(id)} aria-label={`Actualizar ${m.nommod}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-marino dark:text-white">{m.nommod}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {resumen(cambios).map((t) => <Pill key={t} tono="marino">{t}</Pill>)}
                    </div>
                    {r && !r.ok && <p className="mt-1 text-[12.5px] font-medium text-acento">{r.error}</p>}
                  </div>
                  {r && <Pill tono={r.ok ? "verde" : "rojo"}>{r.ok ? "Guardado" : "No se guardó"}</Pill>}
                </li>
              );
            })}
          </ul>
        )}
        {plan.some((p) => !p.oficial) && <p className="text-[12.5px] text-slate-500">Sin ficha oficial: {plan.filter((p) => !p.oficial).map((p) => p.m.nommod).join(", ")}. Esos modelos no se tocan.</p>}
      </div>
    </Modal>
  );
}

// Cambios agrupados para leerlos rápido
function resumen(cambios) {
  const fotos = cambios.filter((c) => c.tipo === "foto" || c.tipo === "activar").length;
  const quitar = cambios.filter((c) => c.tipo === "quitar").length;
  return [
    ...cambios.filter((c) => c.tipo === "precio" || c.tipo === "colores").map((c) => c.texto),
    ...(fotos ? [`${fotos} foto${fotos === 1 ? "" : "s"} oficial${fotos === 1 ? "" : "es"}`] : []),
    ...(quitar ? [`Ocultar ${quitar} foto${quitar === 1 ? "" : "s"} repetida${quitar === 1 ? "" : "s"}`] : []),
  ];
}
