// Vuelve a pedir los datos al API cada cierto tiempo y al volver a la pestaña
import { useEffect, useRef } from "react";

export default function useAutoRefresco(fn, ms = 30000, activo = true) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!activo) return;
    const correr = () => { if (document.visibilityState === "visible") ref.current(); };
    const t = setInterval(correr, ms);
    document.addEventListener("visibilitychange", correr);
    window.addEventListener("focus", correr);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", correr); window.removeEventListener("focus", correr); };
  }, [ms, activo]);
}
