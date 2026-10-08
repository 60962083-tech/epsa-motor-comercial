import { useState } from "react";
import { API_URL, SUPABASE_URL, MODO_REAL } from "../../lib/config";
import { leerSesion } from "../../lib/api";
import { Aviso, Card, PageHeader, Tabla, btnMini, useConfirm, useToast } from "../../components/ui";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";

/**
 * Integración con el backend de Michelle (Express + Supabase).
 * Muestra qué pantalla usa qué endpoint, qué ya está conectado y permite probar la conexión.
 */
const MAPA = [
  { modulo: "Login y permisos", hu: "HU-007", endpoint: "Supabase Auth + RPC hu007_usuario_actual()", estado: "conectado" },
  { modulo: "Catálogo y ficha pública", hu: "HU-008 / HU-009 / HU-012", endpoint: "GET /api/modelos (público)", estado: "conectado" },
  { modulo: "Ubicaciones", hu: "HU-026", endpoint: "GET · POST · PUT /api/ubicaciones · PATCH /:id/estado", estado: "conectado" },
  { modulo: "Compras a proveedor", hu: "HU-034", endpoint: "GET · POST /api/compras (Idempotency-Key) · GET /:id", estado: "conectado" },
  { modulo: "Factura e identificación", hu: "HU-002", endpoint: "PUT /:id/factura · GET · POST /:id/unidades", estado: "conectado" },
  { modulo: "Administrar modelos (crear/editar/publicar)", hu: "HU-012", endpoint: "Pendiente: POST/PUT /api/modelos, imagenmodelo", estado: "pendiente" },
  { modulo: "Sedes públicas (horario y teléfono)", hu: "HU-010", endpoint: "Pendiente: GET público de sede (horsed, telsed)", estado: "pendiente" },
  { modulo: "Leads y cotizaciones web", hu: "HU-013 / HU-014", endpoint: "Pendiente: POST /api/leads (tabla lead)", estado: "pendiente" },
  { modulo: "Seguimiento", hu: "HU-014", endpoint: "Pendiente: /api/leads/:id/seguimientos (seguimientolead)", estado: "pendiente" },
  { modulo: "Techo, preparación, recepción y traslados", hu: "HU-004", endpoint: "Pendiente: unidad (codtte, codepr, codubi) y movimientoubicacion", estado: "pendiente" },
  { modulo: "Ventas, separaciones y solicitudes web", hu: "Complemento", endpoint: "Pendiente: cliente, separacion, venta", estado: "pendiente" },
  { modulo: "Usuarios del panel (crear cuentas)", hu: "HU-007", endpoint: "Pendiente: POST /api/usuarios (Supabase Auth desde el backend)", estado: "pendiente" },
  { modulo: "Comprobantes manuales", hu: "Complemento", endpoint: "Pendiente: definir tabla y servicio de comprobantes", estado: "pendiente" },
];

async function probar(ruta, conToken) {
  const t0 = performance.now();
  try {
    const h = conToken ? { Authorization: `Bearer ${leerSesion()?.access_token || ""}` } : {};
    const r = await fetch(`${API_URL}${ruta}`, { headers: h });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, texto: `${r.status} ${r.ok ? "OK" : j.message || r.statusText}${Array.isArray(j.data) ? ` · ${j.data.length} registros` : ""}`, ms: Math.round(performance.now() - t0) };
  } catch {
    return { ok: false, texto: "Sin conexión (¿API apagada, URL incorrecta o CORS?)", ms: Math.round(performance.now() - t0) };
  }
}

export default function Integracion() {
  const { restablecer } = useApp();
  const { puede } = useAuth();
  const confirmar = useConfirm(); const toast = useToast();
  const [res, setRes] = useState({});
  const [probando, setProbando] = useState("");
  const pruebas = [
    ["raiz", "API en línea", "/", false],
    ["modelos", "Catálogo público (HU-012)", "/api/modelos", false],
    ["ubicaciones", "Ubicaciones con mi sesión (HU-026 + HU-007)", "/api/ubicaciones", true],
    ["compras", "Compras con mi sesión (HU-034)", "/api/compras?limite=5&offset=0", true],
  ];
  async function correr(k, ruta, token) { setProbando(k); const r = await probar(ruta, token); setRes((p) => ({ ...p, [k]: r })); setProbando(""); }

  return (
    <div>
      <PageHeader titulo="Integración con el backend" subtitulo="Qué pantalla usa qué servicio del backend de Michelle y qué falta conectar.">
        {!MODO_REAL && puede("accesos") && <button className="btn btn-secondary !py-2.5" onClick={async () => { if (await confirmar({ titulo: "Restablecer datos de demostración", texto: "Se borrarán los cambios hechos en este navegador (leads, ventas, modelos, compras…) y se cargarán los datos de ejemplo iniciales.", boton: "Restablecer", peligro: true })) { restablecer(); toast("Datos de demostración restablecidos"); } }}>Restablecer datos de demostración</button>}
      </PageHeader>
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Modo actual</p>
          <p className={`mt-1 text-2xl font-bold ${MODO_REAL ? "text-emerald-600" : "text-amber-600"}`}>{MODO_REAL ? "Conectado" : "Demostración"}</p>
          <p className="mt-1 text-[12.5px] text-slate-500">{MODO_REAL ? "Las pantallas con endpoint leen y escriben en Supabase a través de la API." : "Faltan variables en el archivo .env: todo funciona con datos locales del navegador."}</p>
        </Card>
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">API (VITE_API_URL)</p>
          <p className="mt-1 break-all font-mono text-[13px] text-marino dark:text-white">{API_URL || "— sin configurar —"}</p>
          <p className="mt-3 text-[12px] font-semibold uppercase tracking-wide text-slate-400">Supabase (VITE_SUPABASE_URL)</p>
          <p className="mt-1 break-all font-mono text-[13px] text-marino dark:text-white">{SUPABASE_URL || "— sin configurar —"}</p>
        </Card>
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Cómo conectar</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4 text-[13px] text-slate-600 dark:text-slate-300">
            <li>Michelle publica la API (Render, Railway u otro) con CORS habilitado.</li>
            <li>En Netlify: VITE_API_URL, VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.</li>
            <li>Volver a desplegar y probar aquí.</li>
          </ol>
        </Card>
      </div>

      <Card className="mb-6">
        <h2 className="font-bold text-marino dark:text-white">Probar conexión</h2>
        {!MODO_REAL && <div className="mt-3"><Aviso tipo="aviso">Las pruebas se habilitan cuando el .env tiene las tres variables.</Aviso></div>}
        <div className="mt-3 divide-y divide-slate-100 dark:divide-white/10">
          {pruebas.map(([k, t, ruta, token]) => (
            <div key={k} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="font-semibold text-marino dark:text-white">{t}</p><p className="font-mono text-[12px] text-slate-400">GET {ruta}{token ? " · con token" : ""}</p></div>
              <div className="flex items-center gap-3">
                {res[k] && <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${res[k].ok ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{res[k].texto} · {res[k].ms} ms</span>}
                <button className={btnMini} disabled={!MODO_REAL || probando === k} onClick={() => correr(k, ruta, token)}>{probando === k ? "Probando…" : "Probar"}</button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Tabla columnas={["Módulo", "HU", "Servicio del backend", "Estado"]}>
        {MAPA.map((m) => (
          <tr key={m.modulo}>
            <td className="px-4 py-3 font-semibold text-marino dark:text-white">{m.modulo}</td>
            <td className="whitespace-nowrap px-4 py-3">{m.hu}</td>
            <td className="px-4 py-3 font-mono text-[12.5px] text-slate-500">{m.endpoint}</td>
            <td className="px-4 py-3"><span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold ${m.estado === "conectado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{m.estado === "conectado" ? "Conectado" : "Falta endpoint"}</span></td>
          </tr>
        ))}
      </Tabla>
      <p className="mt-3 text-[12.5px] text-slate-400">«Conectado»: frontend y backend listos. «Falta endpoint»: la pantalla está completa en la web; falta el servicio del backend. Estos módulos funcionan completos en la web y guardan sus datos en el navegador hasta que el backend publique su servicio. El detalle de cada contrato está en docs/INTEGRACION-FRONTEND.md.</p>
    </div>
  );
}
