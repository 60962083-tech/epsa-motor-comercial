import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { COLOR_HEX, COLORES, FAMILIAS, FILTROS_CATALOGO, formatoSoles } from "../../data/mockData";
import { soloDigitos } from "../../lib/validar";
import { Aviso, Campo, Modal, PageHeader, Tabla, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";
import ModeloImg from "../../components/ModeloImg";
import Badge from "../../components/Badge";
import { MODO_REAL } from "../../lib/config";

const slug = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const TABS = [{ id: "motor", t: "Motor" }, { id: "chasis", t: "Chasis" }, { id: "consumo", t: "Consumo y rendimiento" }, { id: "dimensiones", t: "Dimensiones" }, { id: "electrico", t: "Sistema eléctrico" }];
const NUEVO = { nombre: "", familia: FAMILIAS[0], tipoMotor: "4 tiempos", combustible: "Gasolina", uso: "Pasajeros", precioDesde: "", descripcion: "", imagen: "", colores: ["Rojo"], colorFoto: "Rojo", badges: "", destacadosTxt: "", cilindrada: "", potencia: "", torque: "", llantas: "", ...Object.fromEntries(TABS.map((t) => [`spec_${t.id}`, ""])) };
const aTexto = (filas = []) => filas.map(([k, v]) => `${k}: ${v}`).join("\n");
const aFilas = (txt) => txt.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(":"); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : [l, ""]; });

/** Reduce la foto subida (máx. 1000 px) para guardarla sin pesar demasiado. */
function leerFoto(file) {
  return new Promise((res, rej) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) return rej(new Error("Usa una imagen PNG, JPG o WEBP."));
    if (file.size > 6 * 1024 * 1024) return rej(new Error("La imagen pesa más de 6 MB."));
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1000 / Math.max(img.width, img.height));
        const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/webp", 0.85));
      };
      img.onerror = () => rej(new Error("No se pudo leer la imagen."));
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}

/** Modelos: crear, editar descripción/precio/colores/foto, publicar o retirar y eliminar (solo gerente). Todo se refleja en la web al instante. */
export default function ModelosAdmin() {
  const { modelos, publicos, apiModelos, sinFicha = [], unidades, agregar, actualizar, eliminar } = useApp();
  const ocultosPorSupabase = MODO_REAL && apiModelos ? modelos.filter((m) => m.estado === "Publicado" && !publicos.some((p) => p.id === m.id)) : [];
  const { puede } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const [q, setQ] = useState(""); const [est, setEst] = useState(""); const [fam, setFam] = useState("");
  const [modal, setModal] = useState(null); const [f, setF] = useState(NUEVO); const [err, setErr] = useState({});
  const [publicarYa, setPublicarYa] = useState(true);
  const editar = puede("modelos.editar");
  const publica = puede("modelos.publicar");

  const lista = useMemo(() => modelos.filter((m) => (!q || m.nombre.toLowerCase().includes(q.toLowerCase())) && (!est || m.estado === est) && (!fam || m.familia === fam)), [modelos, q, est, fam]);

  const faltantes = (m) => [!m.descripcion || m.descripcion.trim().length < 40 ? "descripción (mín. 40 caracteres)" : null, !m.precioDesde ? "precio" : null, !m.imagen && !m.local ? "imagen" : null, !m.colores?.length ? "al menos un color" : null].filter(Boolean);

  function abrir(m) {
    setErr({});
    setF(m ? {
      ...m, badges: (m.badges || []).join(", "), precioDesde: String(m.precioDesde),
      destacadosTxt: (m.destacados || []).join("\n"),
      cilindrada: m.resumen?.Cilindrada || "", potencia: m.resumen?.Potencia || "", torque: m.resumen?.Torque || "", llantas: m.resumen?.Llantas || "",
      ...Object.fromEntries(TABS.map((t) => [`spec_${t.id}`, aTexto(m.specs?.[t.id])])),
    } : NUEVO);
    setPublicarYa(true);
    setModal({ m });
  }
  async function subirFoto(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { const url = await leerFoto(file); setF((p) => ({ ...p, imagen: url, fotoNueva: true })); setErr((p) => ({ ...p, imagen: undefined })); }
    catch (er) { setErr((p) => ({ ...p, imagen: er.message })); }
    e.target.value = "";
  }
  function validarModelo() {
    const x = {};
    if (f.nombre.trim().length < 3) x.nombre = "Ingresa el nombre del modelo.";
    if (modelos.some((m) => m.nombre.toLowerCase() === f.nombre.trim().toLowerCase() && m.id !== modal.m?.id)) x.nombre = "Ya existe un modelo con ese nombre.";
    if (!(Number(f.precioDesde) > 0)) x.precioDesde = "Ingresa un precio mayor a 0.";
    if (f.descripcion.trim().length < 40) x.descripcion = "La descripción debe tener al menos 40 caracteres.";
    if (f.imagen && !/^(https?:\/\/|\/|data:image\/)/.test(f.imagen)) x.imagen = "Usa un enlace https://, una ruta /images/... o sube una foto.";
    if (!f.colores.length) x.colores = "Elige al menos un color.";
    if (!modal.m && publicarYa && publica && !f.imagen) x.imagen = "Para publicarlo en la web sube o enlaza una foto.";
    setErr(x); return Object.keys(x).length === 0;
  }
  function guardar(e) {
    e.preventDefault();
    if (!validarModelo()) return;
    const resumen = Object.fromEntries([["Motor", f.tipoMotor], ["Cilindrada", f.cilindrada], ["Llantas", f.llantas], ["Potencia", f.potencia], ["Torque", f.torque]].filter(([, v]) => String(v).trim()));
    const specs = Object.fromEntries(TABS.map((t) => [t.id, aFilas(f[`spec_${t.id}`] || "")]));
    if (!specs.motor.length) specs.motor = [["Tipo de motor", f.tipoMotor], ["Combustible", f.combustible]];
    const limpio = Object.fromEntries(Object.entries(f).filter(([k]) => !k.startsWith("spec_") && !["destacadosTxt", "cilindrada", "potencia", "torque", "llantas", "fotoNueva", "imagenApi"].includes(k)));
    // Colores ordenados como en la web y portada válida (si quitas un color, deja de verse en la web)
    limpio.colores = COLORES.filter((c) => f.colores.includes(c));
    if (!limpio.colores.includes(limpio.colorPortada)) limpio.colorPortada = limpio.colores[0];
    const fotoCambio = f.fotoNueva || (modal.m && f.imagen !== modal.m.imagen);
    if (fotoCambio) { limpio.fotosColor = {}; limpio.fotoPropia = true; limpio.local = ""; }
    if (modal.m) limpio.editadoEnPanel = true;
    const datos = {
      ...limpio, nombre: f.nombre.trim(), precioDesde: Number(f.precioDesde), descripcion: f.descripcion.trim(),
      badges: f.badges.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
      destacados: f.destacadosTxt.split("\n").map((l) => l.trim()).filter(Boolean), resumen, specs,
    };
    if (modal.m) { actualizar("modelos", modal.m.id, datos, `Modelo editado: ${datos.nombre}`); toast(modal.m.estado === "Publicado" ? "Cambios guardados: ya se ven en la web" : "Cambios guardados"); }
    else {
      let id = slug(datos.nombre); if (modelos.some((m) => m.id === id)) id = `${id}-${Date.now().toString().slice(-4)}`;
      const estado = publicarYa && publica ? "Publicado" : "Borrador";
      agregar("modelos", { ...datos, id, codmod: String(Date.now()).slice(-6), estado, local: "", creadoEnPanel: true, fotoPropia: true, fotosColor: {} }, `Modelo creado${estado === "Publicado" ? " y publicado" : ""}: ${datos.nombre}`);
      toast(estado === "Publicado" ? `${datos.nombre} creado y ya visible en la web` : "Modelo creado como borrador. Publícalo para que aparezca en la web.");
    }
    setModal(null);
  }

  async function alternar(m) {
    if (m.estado !== "Publicado") {
      const f2 = faltantes(m);
      if (f2.length) return toast(`No se puede publicar: falta ${f2.join(", ")}.`, "error");
      actualizar("modelos", m.id, { estado: "Publicado" }, `Modelo publicado: ${m.nombre}`); toast(`${m.nombre} ya está visible en la web`);
    } else {
      if (!(await confirmar({ titulo: "Retirar de la web", texto: `${m.nombre} dejará de verse en el catálogo público. Podrás publicarlo otra vez.`, boton: "Retirar" }))) return;
      actualizar("modelos", m.id, { estado: "Borrador" }, `Modelo retirado: ${m.nombre}`); toast(`${m.nombre} se retiró de la web`);
    }
  }
  async function borrar(m) {
    const n = unidades.filter((u) => u.modelo === m.id).length;
    if (!(await confirmar({ titulo: "Eliminar modelo", texto: `Se eliminará ${m.nombre} del catálogo y desaparecerá de la web.${n ? ` Tiene ${n} unidades en inventario que conservarán su registro.` : ""} Esta acción no se puede deshacer.`, boton: "Eliminar", peligro: true }))) return;
    eliminar("modelos", m.id, `Modelo eliminado: ${m.nombre}`); toast("Modelo eliminado");
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <PageHeader titulo="Modelos" subtitulo="Lo que publiques, edites o elimines aquí cambia al instante en la web de clientes.">
        {editar && <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Nuevo modelo</button>}
      </PageHeader>
      {MODO_REAL && (
        <div className="mb-4 space-y-2" data-diagnostico-modelos>
          {!apiModelos
            ? <Aviso tipo="error">No se pudo leer GET /api/modelos. Mientras tanto, la web muestra el catálogo guardado en este navegador.</Aviso>
            : <Aviso tipo="info">Conectado a Supabase: {apiModelos.length} modelo(s) publicados. La web muestra los que también tienen ficha aquí (precio, colores y datos técnicos).</Aviso>}
          {sinFicha.length > 0 && <Aviso tipo="aviso">Publicados en Supabase sin ficha en la web: <b>{sinFicha.map((x) => x.nommod).join(", ")}</b>. Créalos aquí con el mismo nombre para que aparezcan en la web.</Aviso>}
          {ocultosPorSupabase.length > 0 && <Aviso tipo="aviso">No se ven en la web porque no están publicados en Supabase: <b>{ocultosPorSupabase.map((m) => m.nombre).join(", ")}</b>. Publícalos en Supabase o ejecuta docs/supabase-modelos-catalogo.sql.</Aviso>}
        </div>
      )}
      <div className="mb-5 grid gap-3 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#121a2b] sm:grid-cols-3">
        <div><label className="field-label">Buscar</label><input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del modelo" /></div>
        <div><label className="field-label">Estado</label><select className="field-input" value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todos</option><option>Publicado</option><option>Borrador</option></select></div>
        <div><label className="field-label">Familia</label><select className="field-input" value={fam} onChange={(e) => setFam(e.target.value)}><option value="">Todas</option>{FAMILIAS.map((x) => <option key={x}>{x}</option>)}</select></div>
      </div>
      {lista.length === 0 ? <Vacio titulo="No hay modelos" texto="Crea un modelo nuevo o cambia los filtros." /> : (
        <Tabla columnas={["Modelo", "Familia", "Motor", "Desde", "Unidades", "Estado", "Acciones"]}>
          {lista.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-3"><div className="flex items-center gap-3"><ModeloImg modelo={m} className="h-12 w-16 shrink-0 rounded-md bg-marino-50 object-contain" /><div><p className="font-semibold text-marino dark:text-white">{m.nombre}</p><p className="max-w-[240px] truncate text-[12px] text-slate-400">{m.descripcion}</p></div></div></td>
              <td className="px-4 py-3">{m.familia}</td>
              <td className="px-4 py-3">{m.tipoMotor} · {m.combustible}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatoSoles(m.precioDesde)}</td>
              <td className="px-4 py-3">{unidades.filter((u) => u.modelo === m.id).length}</td>
              <td className="px-4 py-3"><Badge estado={m.estado} /></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                {m.estado === "Publicado" && <Link className={btnMini} to={`/modelos/${m.id}`} target="_blank">Ver en la web</Link>}
                {editar && <button className={btnMini} onClick={() => abrir(m)}>Editar</button>}
                {publica && <button className={btnMini} onClick={() => alternar(m)}>{m.estado === "Publicado" ? "Retirar" : "Publicar"}</button>}
                {puede("eliminar") && <button className={btnMiniPeligro} onClick={() => borrar(m)}>Eliminar</button>}
              </div></td>
            </tr>
          ))}
        </Tabla>
      )}
      {!editar && <p className="mt-3 text-[12.5px] text-slate-400">Tu rol puede consultar el catálogo, pero no modificarlo.</p>}
      {editar && !puede("eliminar") && <p className="mt-3 text-[12.5px] text-slate-400">Eliminar modelos es una acción exclusiva de la gerencia.</p>}

      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.m ? `Editar ${modal.m.nombre}` : "Nuevo modelo"} ancho="max-w-3xl"
        confirmarGuardar={modal?.m
          ? { titulo: "¿Guardar los cambios?", texto: modal.m.estado === "Publicado" ? `${modal.m.nombre} está publicado: los cambios se verán al instante en la web de clientes.` : "Los cambios se guardarán en el catálogo. El modelo sigue como borrador hasta que lo publiques.", boton: "Guardar cambios", validar: validarModelo }
          : { titulo: "¿Crear este modelo?", texto: publicarYa && publica ? "Se creará y aparecerá en la web de clientes al instante." : "Se creará como borrador. Para que aparezca en la web, publícalo desde la lista.", boton: "Crear modelo", validar: validarModelo }}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-mod" className="btn btn-primary !py-2">Guardar</button></>}>
        <form id="f-mod" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombre" error={err.nombre}><input id="mod-nombre" className="field-input" maxLength={60} value={f.nombre} onChange={set("nombre")} /></Campo>
          <Campo etiqueta="Precio desde (S/)" error={err.precioDesde}><input id="mod-precio" className="field-input" inputMode="numeric" maxLength={6} value={f.precioDesde} onChange={(e) => setF({ ...f, precioDesde: soloDigitos(e.target.value, 6).replace(/^0+/, "") })} /></Campo>
          <Campo etiqueta="Familia"><select className="field-input" value={f.familia} onChange={set("familia")}>{FAMILIAS.map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo etiqueta="Tipo de motor"><select className="field-input" value={f.tipoMotor} onChange={set("tipoMotor")}>{FILTROS_CATALOGO.tipoMotor.map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo etiqueta="Combustible"><select className="field-input" value={f.combustible} onChange={set("combustible")}>{FILTROS_CATALOGO.combustible.map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo etiqueta="Uso"><select className="field-input" value={f.uso} onChange={set("uso")}>{FILTROS_CATALOGO.uso.map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo etiqueta="Descripción (se muestra en la web)" error={err.descripcion} className="sm:col-span-2"><textarea id="mod-desc" rows={4} className="field-input" value={f.descripcion} onChange={set("descripcion")} /></Campo>
          <Campo etiqueta="Foto del modelo" error={err.imagen} className="sm:col-span-2" ayuda="Sube la foto en el primer color marcado (ideal: rojo, fondo transparente). Para los demás colores la web ajusta el tono de la foto.">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="grid h-28 w-36 shrink-0 place-items-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-white/15 dark:bg-white/5">
                {f.imagen ? <ModeloImg modelo={{ ...f, id: "vista", local: "" }} className="h-full w-full object-contain" /> : <span className="px-2 text-center text-[12px] text-slate-400">Sin foto</span>}
              </div>
              <div className="flex-1 space-y-2">
                <input className="field-input" value={f.imagen?.startsWith("data:") ? "(foto subida desde tu computadora)" : f.imagen} readOnly={f.imagen?.startsWith("data:")} onChange={set("imagen")} placeholder="https://torito.pe/wp-content/uploads/…png" />
                <div className="flex flex-wrap gap-2">
                  <label className={`${btnMini} cursor-pointer`}>Subir foto<input id="mod-foto" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={subirFoto} /></label>
                  {f.imagen && <button type="button" className={btnMiniPeligro} onClick={() => setF({ ...f, imagen: "" })}>Quitar foto</button>}
                </div>
              </div>
            </div>
          </Campo>
          <Campo etiqueta="Etiquetas" ayuda="Separadas por coma. Ej: NUEVO MODELO, PRECIO DE LANZAMIENTO" className="sm:col-span-2"><input className="field-input" value={f.badges} onChange={set("badges")} /></Campo>
          <div className="grid gap-4 sm:col-span-2 sm:grid-cols-4">
            <Campo etiqueta="Cilindrada"><input className="field-input" value={f.cilindrada} onChange={set("cilindrada")} placeholder="236.2 cc" /></Campo>
            <Campo etiqueta="Potencia"><input className="field-input" value={f.potencia} onChange={set("potencia")} placeholder="10.73 HP" /></Campo>
            <Campo etiqueta="Torque"><input className="field-input" value={f.torque} onChange={set("torque")} placeholder="20 Nm" /></Campo>
            <Campo etiqueta="Llantas"><input className="field-input" value={f.llantas} onChange={set("llantas")} placeholder="4.00-8" /></Campo>
          </div>
          <Campo etiqueta="Puntos destacados" ayuda="Uno por línea. Se muestran en la ficha del modelo." className="sm:col-span-2"><textarea rows={3} className="field-input" value={f.destacadosTxt} onChange={set("destacadosTxt")} /></Campo>
          <details className="rounded-lg border border-slate-200 p-3 sm:col-span-2 dark:border-white/10">
            <summary className="cursor-pointer text-[13.5px] font-semibold text-marino dark:text-white">Ficha técnica (5 pestañas de la web)</summary>
            <p className="mt-1 text-[12px] text-slate-400">Una característica por línea con el formato <b>Nombre: valor</b>. Ej: Cilindrada: 236.2 cc</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {TABS.map((t) => <Campo key={t.id} etiqueta={t.t}><textarea rows={4} className="field-input font-mono text-[12.5px]" value={f[`spec_${t.id}`] || ""} onChange={set(`spec_${t.id}`)} /></Campo>)}
            </div>
          </details>
          <Campo etiqueta="Colores ofrecidos" error={err.colores} className="sm:col-span-2" ayuda="Solo los colores marcados se ven en la web, en Cotizar y en Compras.">
            <div className="flex flex-wrap gap-2">{COLORES.map((c) => (
              <label key={c} data-color={c} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium ${f.colores.includes(c) ? "border-marino-700 bg-marino-700 text-white" : "border-slate-200 dark:border-white/15"}`}>
                <input type="checkbox" className="sr-only" checked={f.colores.includes(c)} onChange={() => setF({ ...f, colores: f.colores.includes(c) ? f.colores.filter((x) => x !== c) : [...f.colores, c] })} />
                <span className="h-3.5 w-3.5 rounded-full ring-1 ring-black/15" style={{ background: COLOR_HEX[c] }} />{c}</label>
            ))}</div>
          </Campo>
          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[220px_1fr] sm:items-start">
            <Campo etiqueta="¿De qué color es la foto?" ayuda="Desde ese color la web pinta los demás.">
              <select id="mod-color-foto" className="field-input" value={f.colorFoto || "Rojo"} onChange={set("colorFoto")}>{COLORES.map((c) => <option key={c}>{c}</option>)}</select>
            </Campo>
            <div>
              <span className="field-label">Así se verá en la web</span>
              <div className="flex flex-wrap gap-2" data-vista-colores>
                {COLORES.filter((c) => f.colores.includes(c)).map((c) => (
                  <figure key={c} className="w-[92px] rounded-lg bg-escenario p-1.5 text-center dark:bg-escenario-oscuro">
                    {f.imagen || f.local ? <ModeloImg modelo={{ ...f, id: "vista", fotosColor: f.fotoNueva ? {} : f.fotosColor, imagenApi: undefined }} color={c} className="h-14 w-full object-contain" /> : <div className="h-14" />}
                    <figcaption className="mt-1 flex items-center justify-center gap-1 text-[11.5px] font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: COLOR_HEX[c] }} />{c}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </div>
          {!modal?.m && publica && (
            <label className="flex items-center gap-2 text-[14px] font-medium sm:col-span-2"><input id="mod-publicar" type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={publicarYa} onChange={(e) => setPublicarYa(e.target.checked)} />Publicar en la web al guardar</label>
          )}
        </form>
      </Modal>
    </div>
  );
}
