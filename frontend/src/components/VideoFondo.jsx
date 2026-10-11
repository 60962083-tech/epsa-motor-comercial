// Video de fondo
export default function VideoFondo({ className = "", opacidad = "opacity-70" }) {
  const quieto = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {quieto ? (
        <img src="/videos/pista.jpg" alt="" className={`h-full w-full object-cover ${opacidad}`} />
      ) : (
        <video className={`h-full w-full object-cover ${opacidad}`} autoPlay muted loop playsInline preload="auto" poster="/videos/pista.jpg">
          <source src="/videos/pista.webm" type="video/webm" />
          <source src="/videos/pista.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
