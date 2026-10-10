/**
 * Filtros SVG para mostrar la moto en otro color cuando no hay foto propia de ese color.
 *
 * Cada filtro mezcla los canales de color de la foto (feColorMatrix). Las filas suman 1, así que el blanco,
 * el negro y los grises quedan igual (techo blanco, llantas, vidrios) y solo cambia la pintura de color.
 * Así el amarillo sale amarillo de verdad, no un tono anaranjado como con hue-rotate.
 *
 * Se usa con `filter: url(#epsa-color-rojo-amarillo)` (ver filtroEntre en data/mockData.js).
 */
export const MATRICES_COLOR = {
  // Foto roja (la mayoría de fotos oficiales)
  "rojo-amarillo": "1 0 0 0 0  0.8 0.2 0 0 0  -0.2 0 1.2 0 0  0 0 0 1 0",
  "rojo-verde": "0 0.5 0.5 0 0  0.65 0.35 0 0 0  0.25 0 0.75 0 0  0 0 0 1 0",
  "rojo-azul": "0 0 1 0 0  0.35 0.65 0 0 0  0.85 0 0.15 0 0  0 0 0 1 0",
  "rojo-negro": "-0.2 0.6 0.6 0 0  -0.2 0.6 0.6 0 0  -0.2 0.6 0.6 0 0  0 0 0 1 0",
  // Foto azul (Crom Plus GLP y GSL)
  "azul-rojo": "0 0 1 0 0  0.5 0.5 0 0 0  1 0 0 0 0  0 0 0 1 0",
  "azul-amarillo": "0 0 1 0 0  0 0.2 0.8 0 0  1.2 0 -0.2 0 0  0 0 0 1 0",
  "azul-verde": "1 0 0 0 0  0 0.3 0.7 0 0  0.6 0.4 0 0 0  0 0 0 1 0",
  "azul-negro": "0.6 0.6 -0.2 0 0  0.6 0.6 -0.2 0 0  0.6 0.6 -0.2 0 0  0 0 0 1 0",
  // Foto amarilla
  "amarillo-rojo": "1 0 0 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 1 0",
  "amarillo-azul": "0 0 1 0 0  0.5 0 0.5 0 0  1 0 0 0 0  0 0 0 1 0",
  "amarillo-verde": "0 0 1 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0",
  "amarillo-negro": "-0.1 -0.1 1.2 0 0  -0.1 -0.1 1.2 0 0  -0.1 -0.1 1.2 0 0  0 0 0 1 0",
  // Foto verde
  "verde-rojo": "0 1 0 0 0  1 0 0 0 0  0 0 1 0 0  0 0 0 1 0",
  "verde-azul": "1 0 0 0 0  0.5 0.5 0 0 0  0 1 0 0 0  0 0 0 1 0",
  "verde-amarillo": "0 1 0 0 0  0.2 0.8 0 0 0  0 -0.2 1.2 0 0  0 0 0 1 0",
  "verde-negro": "0.6 -0.2 0.6 0 0  0.6 -0.2 0.6 0 0  0.6 -0.2 0.6 0 0  0 0 0 1 0",
};

export default function FiltrosColor() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        {Object.entries(MATRICES_COLOR).map(([id, valores]) => (
          <filter key={id} id={`epsa-color-${id}`} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
            <feColorMatrix type="matrix" values={valores} />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
