import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCatalog } from "../store/catalogStore.jsx";
import Carousel from "../components/Carousel";
import { IconWhatsapp } from "../components/Icons";

// Diapositivas del carrusel, archivos en /public/images/carrusel/.
// La imagen es todo el contenido (sin texto ni degradado encima), así
// que cuando se reemplacen por fotos reales de EPSA Motor el mensaje
// ya viene en la foto misma. "to" es adónde lleva al hacer clic: la
// ficha de un modelo, el catálogo completo, otra sección de la web, o
// WhatsApp. Las que no tienen "to" no son clickeables.
const SLIDES = [
  { src: "/images/carrusel/carrusel-1.svg", alt: "Encuentra tu Torito ideal", to: "/modelos" },
  { src: "/images/carrusel/carrusel-4.svg", alt: "Torito RE Carga, para trabajo pesado", to: "/modelos/torito-re-carga" },
  { src: "/images/carrusel/carrusel-2.svg", alt: "Techo clásico o fibra deportiva", to: "/modelos" },
  { src: "/images/carrusel/carrusel-3.svg", alt: "Tres sedes en Lima y Callao", to: "/sedes" },
  { src: "/images/carrusel/carrusel-5.svg", alt: "Escríbenos por WhatsApp", to: "https://wa.me/51907721481" },
  { src: "/images/carrusel/carrusel-6.svg", alt: "Más de 12 años en el mercado", to: "/nosotros" },
];

// Número único de WhatsApp de EPSA Motor (mismo que usa WhatsAppButton.jsx)
const WHATSAPP_NUMERO = "51907721481";

/**
 * Home.jsx — página de inicio de la web pública
 * DEF-002: "Enviar consulta" arma el mensaje de WhatsApp y lo abre.
 * DEF-003: "Consultar por este modelo" llega con "?modelo=" en la URL
 * y esta página preselecciona el modelo y baja hasta el formulario.
 * OBS-003: solo se listan modelos en estado "Publicado".
 */
export default function Home() {
  const { modelos: MODELOS, ubicaciones: UBICACIONES } = useCatalog();
  const publicados = MODELOS.filter((m) => m.estado === "Publicado");
  const [params] = useSearchParams();
  const modeloUrl = params.get("modelo");

  const [form, setForm] = useState({
    nombre: "", contacto: "",
    modelo: modeloUrl || publicados[0]?.id || "",
    color: "",
    sede: UBICACIONES.find((u) => u.tipo === "Sede propia")?.nombre || "",
  });
  const [enviado, setEnviado] = useState(false);
  const consultaRef = useRef(null);

  const modeloSeleccionado = MODELOS.find((m) => m.id === form.modelo);
  const coloresDisponibles = modeloSeleccionado?.colores ?? [];

  // Si llegamos con ?modelo=xxx en la URL, bajamos directo al formulario.
  useEffect(() => {
    if (modeloUrl) {
      setForm((f) => ({ ...f, modelo: modeloUrl }));
      consultaRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [modeloUrl]);

  // Si cambia el modelo y el color elegido ya no aplica, se limpia.
  useEffect(() => {
    if (form.color && !coloresDisponibles.includes(form.color)) {
      setForm((f) => ({ ...f, color: "" }));
    }
  }, [form.modelo]); // eslint-disable-line react-hooks/exhaustive-deps

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function enviarConsulta(e) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.contacto.trim()) return;

    const nombreModelo = modeloSeleccionado?.nombre || form.modelo;
    const colorTexto = form.color ? ` en color ${form.color}` : "";
    const mensaje =
      `Hola, soy ${form.nombre}. Quisiera información sobre el ${nombreModelo}${colorTexto} ` +
      `(sede ${form.sede}). Mi contacto: ${form.contacto}.`;

    window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`, "_blank");
    setEnviado(true);
    setForm({ nombre: "", contacto: "", modelo: publicados[0]?.id || "", color: "", sede: form.sede });
  }

  return (
    <div className="fade-in">
      {/* ---------- Carrusel: a todo lo ancho, sin el margen del resto de la web ---------- */}
      <section>
        <Carousel slides={SLIDES} />
      </section>

      {/* Franja de transición: que el carrusel oscuro no corte en seco contra el blanco */}
      <div className="h-16 bg-gradient-to-b from-marino to-white dark:from-[#0b1220] dark:to-[#0b1220] sm:h-24" />

      {/* ---------- Catálogo (solo modelos Publicado) ---------- */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-marino dark:text-white">Modelos</h2>
          <Link to="/modelos" className="text-[14px] font-semibold text-marino-700 dark:text-white/70 hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {publicados.slice(0, 6).map((m) => (
            <Link
              key={m.id}
              to={`/modelos/${m.id}`}
              className="group overflow-hidden rounded-xl2 border border-slate-100 bg-white shadow-card transition hover:-translate-y-1 hover:shadow-cardHover dark:border-white/5 dark:bg-[#121a2b]"
            >
              <div className="overflow-hidden bg-marino-50 dark:bg-white/5">
                <img src={m.imagen} alt={m.nombre} className="aspect-[16/10] w-full object-cover transition group-hover:scale-105" />
              </div>
              <div className="p-5">
                <h3 className="text-[17px] font-semibold text-marino dark:text-white">{m.nombre}</h3>
                <p className="text-[12.5px] text-slate-400">{m.tipoMotor} · {m.combustible} · {m.uso}</p>
                <span className="mt-1 inline-block text-[13.5px] font-medium text-marino-700 dark:text-white/60">Ver ficha →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- Consulta (id="consulta": aquí ancla el botón de la ficha) ---------- */}
      <section id="consulta" ref={consultaRef} className="mx-auto max-w-6xl scroll-mt-20 px-6 pb-20">
        <div className="overflow-hidden rounded-xl2 shadow-cardHover lg:grid lg:grid-cols-[1fr_1.4fr]">
          {/* Panel izquierdo, decorativo, con el valor de la consulta */}
          <div className="relative hidden bg-gradient-to-br from-marino-700 to-marino p-8 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                <IconWhatsapp />
              </span>
              <h2 className="mt-4 text-2xl font-bold leading-snug">
                Cuéntanos qué buscas
              </h2>
              <p className="mt-2 text-[14.5px] text-white/70">
                Completa el formulario y te respondemos directo por WhatsApp, con tu
                consulta ya redactada, listo para enviar.
              </p>
            </div>
            <ul className="mt-8 space-y-2 text-[13.5px] text-white/75">
              <li>✓ Respuesta de un asesor real</li>
              <li>✓ Sin precios ni condiciones sin confirmar</li>
              <li>✓ Eliges la sede que te quede más cerca</li>
            </ul>
          </div>

          {/* Formulario */}
          <div className="bg-white p-8 dark:bg-[#121a2b]">
            <h2 className="text-xl font-bold text-marino dark:text-white lg:hidden">Consulta por un modelo</h2>
            <p className="mt-1 text-[13.5px] text-slate-500 lg:hidden">
              Te respondemos por WhatsApp, con tus datos ya completados.
            </p>

            <form onSubmit={enviarConsulta} className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label">Nombre</label>
                <input className="field-input" required value={form.nombre} onChange={(e) => actualizar("nombre", e.target.value)} />
              </div>
              <div>
                <label className="field-label">Contacto</label>
                <input className="field-input" required value={form.contacto} onChange={(e) => actualizar("contacto", e.target.value)} />
              </div>
              <div>
                <label className="field-label">Modelo de interés</label>
                <select className="field-input" value={form.modelo} onChange={(e) => actualizar("modelo", e.target.value)}>
                  {publicados.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Color de interés {coloresDisponibles.length === 0 && "(no disponible)"}</label>
                <select
                  className="field-input"
                  value={form.color}
                  onChange={(e) => actualizar("color", e.target.value)}
                  disabled={coloresDisponibles.length === 0}
                >
                  <option value="">Sin preferencia</option>
                  {coloresDisponibles.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Sede preferida</label>
                <select className="field-input" value={form.sede} onChange={(e) => actualizar("sede", e.target.value)}>
                  {UBICACIONES.filter((u) => u.tipo === "Sede propia").map((u) => (
                    <option key={u.id} value={u.nombre}>{u.nombre}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-whatsapp sm:col-span-2" type="submit">
                <IconWhatsapp /> Enviar consulta por WhatsApp
              </button>
            </form>

            {enviado && (
              <p className="mt-3 text-[13.5px] font-medium text-emerald-600">
                Se abrió WhatsApp con tu consulta lista para enviar. Si no se abrió solo, revisa que tu
                navegador no haya bloqueado la ventana emergente.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
