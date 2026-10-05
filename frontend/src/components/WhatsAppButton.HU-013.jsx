import { IconWhatsapp } from "./Icons";

// Número único de atención, tomado del sitio oficial de EPSA Motor.
const NUMERO = "51907721481";

/**
 * WhatsAppButton (HU-013)
 * -----------------------------------------------------------------
 * Arma el enlace wa.me con el número de la empresa y un mensaje
 * predeterminado que el cliente puede editar ANTES de enviarlo
 * (esto lo hace WhatsApp solo, nosotros solo prellenamos el texto).
 * No crea ningún lead automáticamente: el registro lo hace después
 * quien atiende, a mano, en la pantalla de Leads (HU-014).
 * -----------------------------------------------------------------
 */
export default function WhatsAppButton({ mensaje = "Hola, quisiera información sobre EPSA Motor.", className = "" }) {
  const url = `https://wa.me/${NUMERO}?text=${encodeURIComponent(mensaje)}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`btn btn-whatsapp ${className}`}
    >
      <IconWhatsapp /> Escribir por WhatsApp
    </a>
  );
}
