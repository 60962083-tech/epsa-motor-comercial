// Filtros SVG para cambiar el color de la foto
export const MATRICES_COLOR = {
  "rojo-amarillo": "1 0 0 0 0  0.8 0.2 0 0 0  -0.2 0 1.2 0 0  0 0 0 1 0",
  "rojo-verde": "0 0.5 0.5 0 0  0.65 0.35 0 0 0  0.25 0 0.75 0 0  0 0 0 1 0",
  "rojo-azul": "0 0 1 0 0  0.35 0.65 0 0 0  0.85 0 0.15 0 0  0 0 0 1 0",
  "rojo-negro": "-0.2 0.6 0.6 0 0  -0.2 0.6 0.6 0 0  -0.2 0.6 0.6 0 0  0 0 0 1 0",
  "azul-rojo": "0 0 1 0 0  0.5 0.5 0 0 0  1 0 0 0 0  0 0 0 1 0",
  "azul-amarillo": "0 0 1 0 0  0 0.2 0.8 0 0  1.2 0 -0.2 0 0  0 0 0 1 0",
  "azul-verde": "1 0 0 0 0  0 0.3 0.7 0 0  0.6 0.4 0 0 0  0 0 0 1 0",
  "azul-negro": "0.6 0.6 -0.2 0 0  0.6 0.6 -0.2 0 0  0.6 0.6 -0.2 0 0  0 0 0 1 0",
  "amarillo-rojo": "1 0 0 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 1 0",
  "amarillo-azul": "0 0 1 0 0  0.5 0 0.5 0 0  1 0 0 0 0  0 0 0 1 0",
  "amarillo-verde": "0 0 1 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0",
  "amarillo-negro": "-0.1 -0.1 1.2 0 0  -0.1 -0.1 1.2 0 0  -0.1 -0.1 1.2 0 0  0 0 0 1 0",
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
