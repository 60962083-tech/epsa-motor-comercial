import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Carousel.jsx
 * Carrusel del banner de inicio, hecho a mano (sin librería). Pasa
 * sola cada 5 segundos, se mueve con flechas o puntos, y se pausa
 * con el mouse encima.
 *
 * Cada slide es { src, alt, to }. La imagen es el contenido, sin
 * texto superpuesto: cuando se reemplacen por las fotos reales,
 * el mensaje ya viene en la foto misma. "to" es adónde lleva al
 * hacer clic: si empieza con "/" usa el router interno (por ejemplo
 * la ficha de un modelo o el catálogo), si empieza con "http" abre
 * en una pestaña nueva (por ejemplo WhatsApp), y si no hay "to" el
 * slide no es clickeable.
 */
export default function Carousel({ slides }) {
  const [i, setI] = useState(0);
  const [pausado, setPausado] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (pausado) return;
    timer.current = setInterval(() => setI((n) => (n + 1) % slides.length), 5000);
    return () => clearInterval(timer.current);
  }, [pausado, slides.length]);

  function ir(n) {
    setI((n + slides.length) % slides.length);
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="relative h-[75vw] max-h-[680px] min-h-[420px] w-full sm:h-[52vw]">
        {slides.map((s, idx) => {
          const contenido = (
            <img
              src={s.src}
              alt={s.alt}
              className="absolute inset-0 h-full w-full object-cover"
            />
          );
          const clases = `absolute inset-0 transition-opacity duration-700 ${idx === i ? "opacity-100" : "pointer-events-none opacity-0"}`;

          if (s.to?.startsWith("http")) {
            return (
              <a key={s.src} href={s.to} target="_blank" rel="noopener noreferrer" className={clases}>
                {contenido}
              </a>
            );
          }
          if (s.to) {
            return (
              <Link key={s.src} to={s.to} className={clases}>
                {contenido}
              </Link>
            );
          }
          return (
            <div key={s.src} className={clases}>
              {contenido}
            </div>
          );
        })}
      </div>

      {/* Flechas */}
      <button
        onClick={() => ir(i - 1)}
        aria-label="Diapositiva anterior"
        className="absolute left-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur hover:bg-black/50 sm:left-6"
      >
        ‹
      </button>
      <button
        onClick={() => ir(i + 1)}
        aria-label="Siguiente diapositiva"
        className="absolute right-3 top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-black/30 text-white backdrop-blur hover:bg-black/50 sm:right-6"
      >
        ›
      </button>

      {/* Puntos */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
        {slides.map((_, idx) => (
          <button
            key={idx}
            onClick={() => ir(idx)}
            aria-label={`Ir a la diapositiva ${idx + 1}`}
            className={`h-2 rounded-full transition-all ${
              idx === i ? "w-6 bg-white" : "w-2 bg-white/50 hover:bg-white/80"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
