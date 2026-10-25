// Configuración · Roles y permisos (solo gerente)
// El gerente elige qué secciones del panel ve la administradora y el vendedor. Al desactivar una sección
// desaparece del menú de ese rol y su dirección queda bloqueada; lo que cada rol puede hacer dentro de una
// sección no cambia. El gerente siempre ve todo. Con la base conectada se guarda en Supabase.
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { GRUPOS_PANEL, ROLES_LIMITABLES } from "../../data/secciones";
import { permisosGuardarApi } from "../../lib/api";
import { MODO_REAL } from "../../lib/config";
import { mensajeError } from "../../lib/errores";
import { Aviso, Card, PageHeader, useToast } from "../../components/ui";

// ---------------------------------------------------------------------------------------------
// Interruptor accesible
// ---------------------------------------------------------------------------------------------
function Interruptor({ activo, onChange, deshabilitado, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} disabled={deshabilitado} onClick={() => onChange(!activo)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acento focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${activo ? "bg-emerald-500" : "bg-slate-300 dark:bg-white/20"}`}>
      <span className={`absolute left-0 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${activo ? "translate-x-6" : "translate-x-1"}`} aria-hidden="true" />
    </button>
  );
}

export default function RolesPermisos() {
  const { apagadas, setApagadas, permisos, cargarPermisos, cambiarPermisoLocal, rolPermite } = useAuth();
  const toast = useToast();
  const [rol, setRol] = useState("vendedor");
  const [guardando, setGuardando] = useState("");
  const [error, setError] = useState("");

  // Secciones que cada rol tiene por sistema (las demás no se pueden activar)
  const delRol = (r) => GRUPOS_PANEL.flatMap((g) => g.items).filter((i) => !i.fija && !i.soloGerente && rolPermite(r, i.seccion));
  const activa = (r, seccion) => !(apagadas[r] || []).includes(seccion);
  const conteo = (r) => { const s = delRol(r); return { activas: s.filter((i) => activa(r, i.seccion)).length, total: s.length }; };

  // ---------------------------------------------------------------------------------------------
  // Activar o desactivar: se ve al instante y se guarda; si falla, vuelve como estaba
  // ---------------------------------------------------------------------------------------------
  async function cambiar(item, nuevo) {
    setError("");
    const nombreRol = ROLES_LIMITABLES.find((x) => x.id === rol)?.nombre;
    if (!MODO_REAL) { cambiarPermisoLocal(rol, item.seccion, nuevo); toast(`${item.label} ${nuevo ? "activada" : "desactivada"} para ${nombreRol}`); return; }
    const antes = apagadas;
    const lista = new Set(apagadas[rol] || []);
    if (nuevo) lista.delete(item.seccion); else lista.add(item.seccion);
    setApagadas({ ...apagadas, [rol]: [...lista] });
    setGuardando(item.seccion);
    try {
      await permisosGuardarApi(nombreRol, item.seccion, nuevo);
      toast(`${item.label} ${nuevo ? "activada" : "desactivada"} para ${nombreRol}`);
      cargarPermisos();
    } catch (e) {
      setApagadas(antes);
      setError(e.detalle?.faltaSql ? "Los permisos todavía no se pueden guardar en el sistema. Avisa a quien administra la base de datos." : mensajeError(e));
    } finally { setGuardando(""); }
  }

  return (
    <div>
      <PageHeader titulo="Roles y permisos" subtitulo="Elige qué secciones del panel ve cada rol. Los cambios llegan solos al panel de cada persona en unos segundos." />
      {permisos.falta && <div className="mb-5"><Aviso tipo="aviso">Los permisos todavía no se pueden guardar en el sistema: por ahora cada rol ve sus secciones de siempre. Avisa a quien administra la base de datos.</Aviso></div>}
      {permisos.error && <div className="mb-5"><Aviso tipo="error">No se pudieron leer los permisos: {permisos.error} <button className="font-semibold underline" onClick={cargarPermisos}>Reintentar</button></Aviso></div>}

      {/* Roles */}
      <div className="mb-6 grid gap-4 md:grid-cols-3" role="tablist" aria-label="Rol">
        <div className="rounded-xl2 border border-slate-200 bg-marino p-5 text-white shadow-card dark:border-white/10">
          <p className="text-[13px] text-white/60">Gerente</p>
          <p className="mt-1 font-display text-[1.6rem] font-bold leading-none">Acceso total</p>
          <p className="mt-2 text-[13px] text-white/70">Ve y administra todas las secciones. No se puede limitar.</p>
        </div>
        {ROLES_LIMITABLES.map((r) => {
          const c = conteo(r.id);
          return (
            <button key={r.id} type="button" role="tab" aria-selected={rol === r.id} onClick={() => { setRol(r.id); setError(""); }} data-rol-permisos={r.id}
              className={`rounded-xl2 border-2 p-5 text-left shadow-card transition ${rol === r.id ? "border-marino-700 bg-white dark:border-white/60 dark:bg-[#121a2b]" : "border-transparent bg-white hover:border-slate-200 dark:bg-[#121a2b] dark:hover:border-white/15"}`}>
              <p className="text-[13px] text-slate-500">{r.nombre}</p>
              <p className="cifra mt-1 font-display text-[1.6rem] font-bold leading-none text-marino dark:text-white">{c.activas} de {c.total}</p>
              <p className="mt-2 text-[13px] text-slate-500">secciones activas</p>
            </button>
          );
        })}
      </div>

      {error && <div className="mb-4" role="alert"><Aviso tipo="error">{error}</Aviso></div>}

      {/* Secciones del rol elegido, por grupo */}
      <div className="grid gap-5 lg:grid-cols-2" data-permisos-de={rol}>
        {GRUPOS_PANEL.filter((g) => g.items.some((i) => !i.soloGerente)).map((g) => (
          <Card key={g.titulo}>
            <h2 className="mb-1 font-bold text-marino dark:text-white">{g.titulo}</h2>
            <ul className="divide-y divide-slate-100 dark:divide-white/10">
              {g.items.filter((i) => !i.soloGerente).map((i) => {
                const permitida = rolPermite(rol, i.seccion);
                const on = permitida && activa(rol, i.seccion);
                return (
                  <li key={i.seccion} className="flex items-center justify-between gap-4 py-3" data-permiso={i.seccion}>
                    <div className="min-w-0">
                      <p className={`text-[14.5px] font-semibold ${permitida ? "text-marino dark:text-white" : "text-slate-400"}`}>{i.label}</p>
                      <p className="text-[12.5px] text-slate-500">{!permitida ? "No disponible para este rol." : i.fija ? "Siempre visible." : i.descripcion}</p>
                    </div>
                    {permitida && !i.fija
                      ? <Interruptor activo={on} etiqueta={`${i.label} para ${rol}`} deshabilitado={Boolean(guardando) || permisos.falta} onChange={(v) => cambiar(i, v)} />
                      : <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-500 dark:bg-white/10 dark:text-white/60">{i.fija ? "Siempre" : "Sin acceso"}</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
      <p className="mt-5 text-[12.5px] text-slate-500">Desactivar una sección la quita del menú de ese rol y bloquea su dirección. Lo que el rol puede hacer dentro de las secciones activas no cambia.</p>
    </div>
  );
}
