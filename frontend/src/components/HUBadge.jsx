/**
 * HUBadge.jsx
 * -----------------------------------------------------------------
 * Etiqueta visible (no solo en el código) que marca qué Historia de
 * Usuario corresponde a la pantalla que se está viendo. Existe
 * solo para que, al auditar, se pueda leer en el navegador "esto es
 * HU-008" sin tener que adivinar ni abrir el código.
 *
 * Se puede quitar de un sitio ya en producción simplemente borrando
 * <HUBadge .../> de la pantalla, o dejarla: no afecta ninguna
 * funcionalidad, es solo informativa.
 * -----------------------------------------------------------------
 */
export default function HUBadge({ code, titulo }) {
  return (
    <div
      className="fixed bottom-3 right-3 z-40 rounded-full bg-marino/90 px-3 py-1.5
                 text-[11.5px] font-semibold text-white shadow-lg backdrop-blur
                 dark:bg-marino-700/90 print:hidden"
      title={titulo}
    >
      {code}{titulo ? ` · ${titulo}` : ""}
    </div>
  );
}
