import { Link } from "react-router-dom";
import MotoIllustration from "../components/MotoIllustration";

const MODELOS = [
  { id: "torito", nombre: "Torito" },
  { id: "cross", nombre: "Cross" },
  { id: "modelo-3", nombre: "Modelo 3" },
];

export default function Home() {
  return (
    <div className="fade-in">
      {/* Hero */}
      <section className="bg-gradient-to-b from-marino-50 to-white dark:from-[#0f1830] dark:to-[#0b1220]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-marino-700 dark:text-white/60">
              Distribuidor autorizado Bajaj
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-marino dark:text-white md:text-5xl">
              Encuentra una motocar para tu trabajo
            </h1>
            <p className="mt-4 max-w-md text-[15.5px] text-slate-600 dark:text-slate-400">
              Modelos y características sujetos a confirmación comercial.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/modelos" className="btn btn-primary">Ver modelos</Link>
              <a
                href="https://wa.me/51907721481"
                target="_blank" rel="noopener noreferrer"
                className="btn btn-whatsapp"
              >
                Escribir por WhatsApp
              </a>
            </div>
          </div>
          <div className="rounded-xl2 bg-white/60 p-8 shadow-card dark:bg-white/5">
            <MotoIllustration className="w-full" />
          </div>
        </div>
      </section>

      {/* Catálogo */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="text-2xl font-bold text-marino dark:text-white">Modelos</h2>
          <Link to="/modelos" className="text-[14px] font-semibold text-marino-700 dark:text-white/70 hover:underline">
            Ver todos →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODELOS.map((m) => (
            <Link
              key={m.id}
              to={`/modelos/${m.id}`}
              className="group rounded-xl2 border border-slate-100 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-cardHover dark:border-white/5 dark:bg-[#121a2b]"
            >
              <div className="overflow-hidden rounded-lg bg-marino-50 dark:bg-white/5">
                <MotoIllustration className="aspect-[4/3] w-full p-4 transition group-hover:scale-105" />
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-marino dark:text-white">{m.nombre}</h3>
              <span className="text-[13.5px] font-medium text-marino-700 dark:text-white/60">Ver ficha →</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Consulta */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-xl2 border border-marino-700/15 bg-white p-8 shadow-card dark:border-white/10 dark:bg-[#121a2b]">
          <h2 className="text-xl font-bold text-marino dark:text-white">Consulta por un modelo</h2>
          <form
            className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="lg:col-span-1">
              <label className="field-label">Nombre</label>
              <input className="field-input" required />
            </div>
            <div className="lg:col-span-1">
              <label className="field-label">Contacto</label>
              <input className="field-input" required />
            </div>
            <div className="lg:col-span-1">
              <label className="field-label">Modelo de interés</label>
              <select className="field-input">
                <option>Torito</option><option>Cross</option>
              </select>
            </div>
            <div className="lg:col-span-1">
              <label className="field-label">Sede preferida</label>
              <select className="field-input">
                <option>Comas</option><option>Ventanilla</option><option>Puente Piedra</option>
              </select>
            </div>
            <button className="btn btn-primary lg:col-span-1" type="submit">Enviar consulta</button>
          </form>
        </div>
      </section>
    </div>
  );
}
