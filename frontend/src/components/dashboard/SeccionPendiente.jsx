// Sección que todavía no guarda su información en el sistema central
// Con la base conectada no se muestran datos de ejemplo: la sección avisa que aún no está disponible.
import { PageHeader, Vacio } from "../ui";

export default function SeccionPendiente({ titulo, texto }) {
  return (
    <div data-seccion-pendiente>
      <PageHeader titulo={titulo} />
      <Vacio titulo="Esta sección todavía no está disponible" texto={texto || "Se habilitará cuando su información se guarde en el sistema. Mientras tanto, puedes usar el resto del panel."} />
    </div>
  );
}
