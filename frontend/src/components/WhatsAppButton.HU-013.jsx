// HU-013 · Botón de WhatsApp
import { IconWhatsapp } from "./Icons";
import { WHATSAPP_NUMERO } from "../lib/config";

export default function WhatsAppButton({ mensaje = "Hola, quisiera información sobre EPSA Motor.", className = "" }) {
  const url = `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`;
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
