/**
 * Silueta lineal de un Torito (vista lateral). Se usa cuando una foto no carga y en estados vacíos.
 * Toma el color del texto (currentColor), así funciona igual sobre fondos claros y oscuros.
 */
export default function MotoIllustration({ className = "" }) {
  return (
    <svg viewBox="0 0 240 170" className={className} xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor"
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Torito (imagen referencial)">
      <ellipse cx="124" cy="143" rx="90" ry="5" fill="currentColor" stroke="none" opacity=".12" />
      <path d="M46 40 Q46 33 54 33 H168 Q178 33 181 41" />
      <path d="M46 40 L42 110 Q42 117 50 117 H60" />
      <path d="M54 40 V84 H104" opacity=".55" />
      <path d="M124 33 V96" />
      <path d="M94 117 H166 Q172 117 173 110 L176 98 H196" />
      <path d="M181 41 L190 80 Q203 85 206 99 L207 108" />
      <path d="M131 46 H172 L180 80" opacity=".55" />
      <path d="M182 112 Q184 104 194 104 Q205 104 207 112" />
      <circle cx="77" cy="121" r="16.5" />
      <circle cx="77" cy="121" r="5" />
      <circle cx="194.5" cy="125" r="12" />
      <circle cx="194.5" cy="125" r="3.8" />
      <path d="M168 84 l10 -3" opacity=".55" />
      <circle cx="203" cy="92" r="2.4" />
    </svg>
  );
}
