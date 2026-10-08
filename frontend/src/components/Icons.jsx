export const IconSun = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path strokeLinecap="round" d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
  </svg>
);
export const IconMoon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    <path d="M20.5 14.8A8.6 8.6 0 1 1 9.2 3.5a7 7 0 0 0 11.3 11.3Z" />
  </svg>
);
export const IconMenu = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconClose = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const IconPin = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </svg>
);
export const IconPhone = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.5 3.5h3l1.5 4-2 1.6a12 12 0 0 0 5.9 5.9l1.6-2 4 1.5v3c0 1-.9 1.8-1.9 1.6A17 17 0 0 1 4.9 5.4c-.2-1 .6-1.9 1.6-1.9Z" />
  </svg>
);
export const IconMail = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    <path strokeLinecap="round" d="m4.5 7 7.5 6 7.5-6" />
  </svg>
);
// Ícono del logo (solo el ala), recreado a partir del logo real de EPSA Motor.
// Vive también como archivo en /public/images/logo-icono.svg por si se
// necesita en algún lugar fuera de React (por ejemplo, metadatos o redes).
export const Logo = (p) => (
  <svg viewBox="0 0 132 116" {...p}>
    <path d="M58 10 C40 18 24 34 14 58 C30 52 44 50 56 54 C46 60 36 70 28 86 C42 80 54 78 64 82 C58 90 54 98 52 106 L64 100 C66 92 70 84 76 76 C70 74 66 70 64 64 C72 62 80 64 86 70 C84 56 78 40 66 26 C62 32 58 40 56 48 C54 36 54 24 58 10 Z" fill="#C8102E" />
    <path d="M78 10 C96 18 112 34 122 58 C106 52 92 50 80 54 C90 60 100 70 108 86 C94 80 82 78 72 82 C78 90 82 98 84 106 L72 100 C70 92 66 84 60 76 C66 74 70 70 72 64 C64 62 56 64 50 70 C52 56 58 40 70 26 C74 32 78 40 80 48 C82 36 82 24 78 10 Z" fill="currentColor" />
  </svg>
);
export const IconWhatsapp = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm0 18.2a8.1 8.1 0 0 1-4.2-1.1l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.6.8-.8 1-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.3.2-.3.5-.9.1-.1.1-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.1s.9 2.4 1.1 2.6c.1.2 1.9 2.9 4.5 4 .6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
);
export const IconLock = (p) => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6" {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);
export const IconAlert = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path strokeLinejoin="round" d="M12 3 2 20h20L12 3Z" />
    <path strokeLinecap="round" d="M12 10v4M12 17h.01" />
  </svg>
);
export const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
  </svg>
);

// Iconos para la sección "Tu socio en movilidad de trabajo" (Nosotros).
export const IconShield = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path strokeLinejoin="round" d="M12 3 4 6v6c0 4.6 3.4 7.8 8 9 4.6-1.2 8-4.4 8-9V6l-8-3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
  </svg>
);
export const IconMapArea = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path strokeLinejoin="round" d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
    <path strokeLinecap="round" d="M9 4v13M15 6.5v13" />
  </svg>
);
export const IconCreditCard = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <rect x="3" y="5.5" width="18" height="13" rx="2" />
    <path strokeLinecap="round" d="M3 9.5h18" />
    <path strokeLinecap="round" d="M6.5 14.5h4" />
  </svg>
);
export const IconDocument = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}>
    <path strokeLinejoin="round" d="M7 3h7l4 4v14H7z" />
    <path strokeLinecap="round" d="M14 3v4h4M9.5 13h5M9.5 16.5h5" />
  </svg>
);

// Iconos de redes sociales para el pie de página.
// TODO (Didier/Harold): hoy enlazan a "#" porque no encontré una cuenta
// oficial verificable de EPSA Motor en Facebook, Instagram ni TikTok.
// En cuanto el equipo confirme los usuarios reales, solo hay que
// cambiar el href en Footer.jsx (el ícono no necesita tocarse).
export const IconFacebook = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    <path d="M14 9h2.5V6.2h-2.5c-2.2 0-3.5 1.4-3.5 3.6V12H8v3h2.5v6.8h3V15H16l.5-3h-3V9.9c0-.6.3-.9 1-.9Z" />
  </svg>
);
export const IconInstagram = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const IconTiktok = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" {...p}>
    <path d="M16.5 3c.4 2 1.8 3.4 3.8 3.7v2.8c-1.4 0-2.7-.4-3.8-1.1v6.4c0 3-2.4 5.2-5.3 5.2S5.9 17.8 5.9 14.8c0-3 2.4-5.2 5.3-5.2.4 0 .8 0 1.2.1v2.9a2.4 2.4 0 1 0 1.7 2.3V3h2.4Z" />
  </svg>
);

/* ---- Íconos técnicos de la ficha (trazo simple, heredan el color del texto) ---- */
const Trazo = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>{children}</svg>
);
export const IconMotor = (p) => <Trazo {...p}><path d="M4 10h2l1.5-2h7L16 10h2v3h2v-2h1v6h-1v-2h-2v3h-3l-1.5 2h-5L6 18H4v-8Z" /><path d="M9 5h4M11 5v3" /></Trazo>;
export const IconPiston = (p) => <Trazo {...p}><rect x="7" y="3" width="10" height="8" rx="1.5" /><path d="M7 6h10M12 11v4M9 21l3-6 3 6" /></Trazo>;
export const IconLlanta = (p) => <Trazo {...p}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3" /><path d="M12 3.5V9M12 15v5.5M3.5 12H9M15 12h5.5" /></Trazo>;
export const IconRayo = (p) => <Trazo {...p}><path d="M13 2.5 4.5 13.5h6.5l-1 8 8.5-11h-6.5l1-8Z" /></Trazo>;
export const IconMedidor = (p) => <Trazo {...p}><path d="M3.5 16a8.5 8.5 0 1 1 17 0" /><path d="M12 16l4.5-5" /><circle cx="12" cy="16" r="1.2" fill="currentColor" /></Trazo>;
export const IconTanque = (p) => <Trazo {...p}><path d="M5 21V5a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v16M3.5 21h12" /><path d="M8 7h3M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8.5L18.5 6" /></Trazo>;
export const IconRegla = (p) => <Trazo {...p}><path d="M3.5 16.5 16.5 3.5l4 4L7.5 20.5l-4-4Z" /><path d="M7 13l2 2M10 10l2 2M13 7l2 2" /></Trazo>;
export const IconBateria = (p) => <Trazo {...p}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M7 7V5h3v2M14 7V5h3v2M7 13h3M15.5 11.5v3M14 13h3" /></Trazo>;
export const IconChasis = (p) => <Trazo {...p}><path d="M3 16V9.5L6 6h11l3 3.5V16" /><path d="M3 16h18" /><circle cx="6.5" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></Trazo>;
export const IconGiro = (p) => <Trazo {...p}><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></Trazo>;

/* ---- Íconos de interfaz (login, filtros) ---- */
export const IconOjo = (p) => <Trazo {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></Trazo>;
export const IconOjoTachado = (p) => <Trazo {...p}><path d="M3 3l18 18M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.6 6.6A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.3-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2" /></Trazo>;
export const IconBuscar = (p) => <Trazo {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.3-4.3" /></Trazo>;
export const IconFiltros = (p) => <Trazo {...p}><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></Trazo>;
export const IconFlecha = (p) => <Trazo {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Trazo>;
export const IconVolver = (p) => <Trazo {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Trazo>;
