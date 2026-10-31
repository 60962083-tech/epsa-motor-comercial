// Etiqueta de estado
const ESTILOS = {
  "Disponible": "bg-emerald-100 text-emerald-700",
  "Separada": "bg-amber-100 text-amber-700",
  "Pagada por recoger": "bg-sky-100 text-sky-700",
  "En preparación": "bg-violet-100 text-violet-700",
  "Vendida": "bg-slate-200 text-slate-600",
  "Pendiente de factura": "bg-slate-200 text-slate-600",
  "Publicado": "bg-emerald-100 text-emerald-700",
  "Borrador": "bg-amber-100 text-amber-700",
  "No publicado": "bg-slate-200 text-slate-700",
  "Activo": "bg-emerald-100 text-emerald-700",
  "Inactivo": "bg-slate-200 text-slate-600",
  "Nuevo": "bg-sky-100 text-sky-700",
  "En seguimiento": "bg-amber-100 text-amber-700",
};

export default function Badge({ estado }) {
  const clase = ESTILOS[estado] || "bg-slate-200 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-[12.5px] font-semibold ${clase}`}>
      {estado}
    </span>
  );
}
