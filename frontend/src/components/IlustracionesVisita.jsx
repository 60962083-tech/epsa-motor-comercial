// Ilustraciones propias de «Qué traer a tu visita» (Sedes). Colores de la marca: marino #0e2c52 y acento #c62828.
const MARINO = "#0e2c52";
const ACENTO = "#c62828";
const GRIS = "#c9d3e0";
const LINEA = "#e3e8ef";

// Silueta de persona para la foto de un documento
function Silueta({ x, y, w, h }) {
  const cx = x + w / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="5" fill="#eef2f7" />
      <circle cx={cx} cy={y + h * 0.38} r={w * 0.2} fill={GRIS} />
      <path d={`M${x + w * 0.16} ${y + h} c0 -${h * 0.3} ${w * 0.68} -${h * 0.3} ${w * 0.68} 0`} fill={GRIS} />
    </g>
  );
}

// Torito de perfil, simplificado
function Torito({ x, y, s = 1, color = MARINO }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 30 V10 Q6 4 12 4 H40 Q46 4 48 10 L54 22 Q56 26 56 30 H50" />
      <path d="M22 4 V30 M6 30 H14 M30 30 H42" />
      <circle cx="22" cy="31" r="6" fill="#fff" />
      <circle cx="46" cy="31" r="6" fill="#fff" />
    </g>
  );
}

export function IlustracionDni() {
  return (
    <svg viewBox="0 0 240 140" role="img" aria-label="Dos documentos de identidad" className="h-full w-full">
      <g transform="rotate(-9 92 76)">
        <rect x="34" y="34" width="132" height="84" rx="10" fill="#fff" stroke={LINEA} strokeWidth="2" />
        <rect x="34" y="34" width="132" height="16" rx="8" fill={GRIS} />
      </g>
      <g transform="rotate(5 140 72)">
        <rect x="68" y="26" width="146" height="92" rx="11" fill="#fff" stroke={LINEA} strokeWidth="2" />
        <path d="M68 37 Q68 26 79 26 H203 Q214 26 214 37 V44 H68 Z" fill={MARINO} />
        <text x="80" y="40" fill="#fff" fontFamily="Barlow Condensed, Arial Narrow, sans-serif" fontWeight="700" fontSize="12" letterSpacing="1.5">DNI</text>
        <circle cx="202" cy="35" r="4" fill={ACENTO} />
        <Silueta x={80} y={54} w={36} h={46} />
        <rect x="126" y="58" width="72" height="7" rx="3.5" fill={MARINO} opacity=".85" />
        <rect x="126" y="72" width="56" height="6" rx="3" fill={GRIS} />
        <rect x="126" y="85" width="64" height="6" rx="3" fill={GRIS} />
        <rect x="126" y="98" width="38" height="6" rx="3" fill={GRIS} />
      </g>
    </svg>
  );
}

export function IlustracionRecibo() {
  return (
    <svg viewBox="0 0 240 140" role="img" aria-label="Recibo de luz o agua" className="h-full w-full">
      <g transform="rotate(3 120 74)">
        <path d="M74 14 H166 V120 l-9.2 -6 -9.2 6 -9.2 -6 -9.2 6 -9.2 -6 -9.2 6 -9.2 -6 -9.2 6 -9.2 -6 -9.2 6 Z" fill="#fff" stroke={LINEA} strokeWidth="2" strokeLinejoin="round" />
        {/* Foco y gota */}
        <g transform="translate(86 23)">
          <circle cx="8" cy="8" r="11" fill="#fef3c7" />
          <path d="M8 0 a8 8 0 0 1 4.8 14.4 V17 H3.2 V14.4 A8 8 0 0 1 8 0 Z" fill="#fbbf24" />
          <rect x="3.6" y="18.2" width="8.8" height="2.6" rx="1.3" fill="#94a3b8" />
          <rect x="4.6" y="21.8" width="6.8" height="2.4" rx="1.2" fill="#94a3b8" />
        </g>
        <path d="M118 25 q6 8 6 12 a6 6 0 0 1 -12 0 q0 -4 6 -12 Z" fill="#38bdf8" />
        <rect x="86" y="54" width="68" height="6" rx="3" fill={GRIS} />
        <rect x="86" y="66" width="52" height="6" rx="3" fill={GRIS} />
        <rect x="86" y="78" width="60" height="6" rx="3" fill={GRIS} />
        <line x1="86" y1="94" x2="154" y2="94" stroke={LINEA} strokeWidth="2" strokeDasharray="4 4" />
        <text x="86" y="110" fill={MARINO} fontFamily="Barlow Condensed, Arial Narrow, sans-serif" fontWeight="700" fontSize="15">S/ 48.90</text>
      </g>
      <g transform="translate(160 86)">
        <circle cx="16" cy="16" r="16" fill="#10b981" />
        <path d="M9 16.5 l4.8 4.8 L23.5 11" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export function IlustracionCotizacion() {
  return (
    <svg viewBox="0 0 240 140" role="img" aria-label="Celular con la cotización enviada por WhatsApp" className="h-full w-full">
      <g transform="rotate(-4 120 70)">
        <rect x="80" y="6" width="80" height="128" rx="13" fill={MARINO} />
        <rect x="85" y="15" width="70" height="110" rx="7" fill="#efeae2" />
        <rect x="85" y="15" width="70" height="16" rx="7" fill="#128c7e" />
        <rect x="85" y="24" width="70" height="7" fill="#128c7e" />
        <circle cx="94" cy="23" r="4" fill="#fff" opacity=".9" />
        <rect x="101" y="20.5" width="30" height="5" rx="2.5" fill="#fff" opacity=".8" />
        {/* Mensaje enviado: la cotización */}
        <rect x="98" y="38" width="52" height="46" rx="7" fill="#d9fdd3" />
        <Torito x={103} y={42} s={0.42} />
        <rect x="103" y="64" width="40" height="4.5" rx="2.25" fill={GRIS} />
        <rect x="103" y="72" width="28" height="4.5" rx="2.25" fill={GRIS} />
        <path d="M134 78.5 l2.2 2.2 4.2 -4.4 M138 78.5 l2.2 2.2 4.2 -4.4" fill="none" stroke="#53bdeb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Respuesta del asesor */}
        <rect x="90" y="90" width="44" height="18" rx="6" fill="#fff" />
        <rect x="95" y="95" width="30" height="4" rx="2" fill={GRIS} />
        <rect x="95" y="101" width="20" height="4" rx="2" fill={LINEA} />
      </g>
      <g transform="translate(160 84)">
        <circle cx="16" cy="16" r="16" fill="#25d366" />
        <path d="M9 16 L23 9.5 L18.5 23.5 L15.5 17.5 Z" fill="#fff" stroke="#fff" strokeWidth="1.2" strokeLinejoin="round" />
      </g>
      <circle cx="58" cy="40" r="5" fill={ACENTO} opacity=".18" />
      <circle cx="186" cy="34" r="8" fill={MARINO} opacity=".08" />
    </svg>
  );
}
