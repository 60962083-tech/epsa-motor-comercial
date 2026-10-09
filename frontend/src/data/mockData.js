/**
 * mockData.js
 * Datos base de EPSA Motor. Los 8 modelos, precios "Desde" y fichas
 * técnicas se tomaron de https://torito.pe (catálogo oficial Torito).
 * Mientras el backend no esté publicado, la web lee estos datos y los
 * guarda en el navegador (ver src/store/appStore.jsx).
 */
const TORITO = "https://torito.pe/wp-content/uploads";
export const TORITO_ICONOS = {
  Motor: `${TORITO}/2025/06/icono-motor-1.svg`, Cilindrada: `${TORITO}/2025/06/cilindrada.svg`, Llantas: `${TORITO}/2025/06/llantas.svg`,
  Potencia: `${TORITO}/2025/06/potencia.svg`, Torque: `${TORITO}/2025/06/torque.svg`,
  motor: `${TORITO}/2025/06/motor-1.svg`, chasis: `${TORITO}/2025/06/icono-carroceria-2.svg`, consumo: `${TORITO}/2025/06/icono-consumo-1.svg`,
  dimensiones: `${TORITO}/2025/06/icono-dimesiones.svg`, electrico: `${TORITO}/2025/12/icono-sistema-electrico.svg`,
};
export const LOGO_TORITO = `${TORITO}/2026/01/logotipo-torito-bajaj-1.png`;
export const SELLO_BAJAJ = `${TORITO}/2025/12/bajaj-favorita-en-100-paises-125x53-1.png`;

// Cada modelo usa su foto real de torito.pe. Si la web oficial no responde, se usa la copia
// local /public/images/modelos/modelo-N.png (se crea con: npm run imagenes) y, si tampoco
// existe, una silueta neutra. No hay imágenes inventadas.
export const FAMILIAS = ["Motores 4 Válvulas", "Motores 2 Tiempos", "Motores Crom Plus"];

export const MODELOS = [
  {
    id: "torito-4v-gsl", codmod: "1", nombre: "Torito 4V GSL", familia: "Motores 4 Válvulas",
    estado: "Publicado", tipoMotor: "4 tiempos", combustible: "Gasolina", uso: "Pasajeros", tipoTecho: "Clásico",
    precioDesde: 17899, badges: ["NUEVO MODELO", "PRECIO DE LANZAMIENTO"],
    imagen: `${TORITO}/2025/04/1-5.png`, local: "/images/modelos/modelo-1.png",
    colores: ["Rojo", "Blanco", "Azul"],
    descripcion: "El Torito 4V GSL es el motocar a gasolina con motor de 4 válvulas: más potencia y torque para subir pendientes con carga completa, menor consumo y una conducción más estable. Pensado para el conductor que trabaja todos los días y necesita una herramienta confiable.",
    destacados: ["Motor 4 válvulas de 236.2 cc con 10.73 HP", "Torque de 20 Nm para pendientes y carga", "Velocidad máxima de 65 km/h", "Tanque de 8 litros de gasolina"],
    resumen: {"Motor": "4 tiempos, 4 válvulas", "Cilindrada": "236.2 cc", "Llantas": "Aro 8\" sin cámara", "Potencia": "10.73 HP", "Torque": "20 Nm"},
    specs: {
      motor: [["Motor", "4 tiempos, 4 válvulas, gasolina"], ["Cilindrada", "236.2 cc"], ["Diámetro × carrera", "67 mm × 67 mm"], ["Refrigeración", "Forzada por aire y aceite"], ["Transmisión", "Engranaje constante, manual: 4 marchas + 1 reversa"], ["Potencia máxima", "10.73 HP a 5,000 ± 250 RPM"], ["Torque máximo", "20 Nm a 3,500 RPM"]],
      chasis: [["Neumáticos", "4.00-8, 4/6 PR (los cuatro)"], ["Frenos", "Hidráulicos de zapata expansible, delantero y posterior"], ["Freno de estacionamiento", "Mecánico de zapata expansible en ruedas traseras"]],
      consumo: [["Velocidad máxima", "65 km/h"], ["Capacidad de tanque", "8 L (reserva 1.5 L)"]],
      dimensiones: [["Largo", "2,635 mm"], ["Ancho", "1,350 mm"], ["Alto", "1,710 mm"], ["Peso en vacío", "371 kg"], ["Peso máximo", "681 kg"]],
      electrico: [["Sistema eléctrico", "12 V DC"], ["Batería", "12 V, 32 Ah"], ["Faro delantero", "35/35 W"], ["Luz trasera / freno", "5/21 W o 5/18 W"]],
    },
  },
  {
    id: "torito-4v-glp", codmod: "2", nombre: "Torito 4V GLP", familia: "Motores 4 Válvulas",
    estado: "Publicado", tipoMotor: "4 tiempos", combustible: "GLP", uso: "Pasajeros", tipoTecho: "Clásico",
    precioDesde: 17899, badges: ["NUEVO MODELO", "PRECIO DE LANZAMIENTO"],
    imagen: `${TORITO}/2025/04/1-5.png`, local: "/images/modelos/modelo-2.png",
    colores: ["Rojo", "Blanco", "Azul"],
    descripcion: "El Torito 4V GLP combina el motor de 4 válvulas con un sistema dual GLP + gasolina. Ahorra en cada kilómetro con gas y conserva el respaldo de gasolina cuando lo necesites.",
    destacados: ["Sistema dual: tanque de GLP de 20.6 L + 3 L de gasolina", "Motor de 4 válvulas con 10.33 HP", "Torque de 18 Nm", "Ahorro diario frente a la gasolina"],
    resumen: {"Motor": "4 tiempos, 4 válvulas", "Cilindrada": "236.2 cc", "Llantas": "Aro 8\" sin cámara", "Potencia": "10.33 HP", "Torque": "18 Nm"},
    specs: {
      motor: [["Motor", "4 tiempos, 4 válvulas"], ["Combustible", "GLP con respaldo de gasolina"], ["Cilindrada", "236.2 cc"], ["Diámetro × carrera", "67 mm × 67 mm"], ["Refrigeración", "Forzada por aire y aceite"], ["Transmisión", "Engranaje constante, manual: 4 marchas + 1 reversa"], ["Potencia máxima", "10.33 HP a 5,000 ± 250 RPM"], ["Torque máximo", "18 Nm a 3,500 RPM"]],
      chasis: [["Neumáticos", "4.00-8, 4/6 PR (los cuatro)"], ["Frenos", "Hidráulicos de zapata expansible, delantero y posterior"], ["Freno de estacionamiento", "Mecánico de zapata expansible en ruedas traseras"]],
      consumo: [["Velocidad máxima", "65 km/h"], ["Capacidad de tanque", "20.6 L de GLP (16.5 L al 80%) + 3 L de gasolina"]],
      dimensiones: [["Largo", "2,635 mm"], ["Ancho", "1,350 mm"], ["Alto", "1,710 mm"], ["Peso en vacío", "386 kg"], ["Peso máximo", "696 kg"]],
      electrico: [["Sistema eléctrico", "12 V DC"], ["Batería", "12 V, 32 Ah"], ["Faro delantero", "35/35 W"], ["Luz trasera / freno", "5/21 W o 5/18 W"]],
    },
  },
  {
    id: "torito-4v-gnv", codmod: "9", nombre: "Torito 4V GNV", familia: "Motores 4 Válvulas",
    estado: "Publicado", tipoMotor: "4 tiempos", combustible: "GNV", uso: "Pasajeros", tipoTecho: "Clásico",
    precioDesde: 17899, badges: ["NUEVO MODELO", "PRECIO DE LANZAMIENTO"],
    imagen: `${TORITO}/2025/04/1-5.png`, local: "/images/modelos/modelo-9.png",
    colores: ["Rojo", "Blanco", "Azul"],
    descripcion: "Ahorro y tecnología para tu negocio. El Torito 4V GNV es la nueva generación de Torito: motor de 4 válvulas a gas natural, encendido instantáneo ISG, retroceso directo en el manubrio, triple filtrado de aceite y tablero con indicador de diagnóstico.",
    destacados: ["Motor 4 válvulas a GNV de 236.2 cc", "Encendido instantáneo ISG", "Retroceso directo en el manubrio", "Triple filtrado de aceite"],
    resumen: {"Motor": "4 tiempos, 4 válvulas", "Cilindrada": "236.2 cc", "Llantas": "Aro 8\" sin cámara", "Potencia": "9.79 HP", "Torque": "16.5 Nm"},
    specs: {
      motor: [["Motor", "4 tiempos, 4 válvulas, GNV"], ["Cilindrada", "236.2 cc"], ["Diámetro × carrera", "67 mm × 67 mm"], ["Refrigeración", "Forzada por aire y aceite"], ["Transmisión", "Engranaje constante, manual: 4 marchas + 1 reversa"], ["Potencia máxima", "9.79 HP a 5,000 ± 250 RPM"], ["Torque máximo", "16.5 Nm a 3,500 RPM"]],
      chasis: [["Neumáticos", "4.00-8, 4/6 PR, aro 8\" sin cámara"], ["Frenos", "Hidráulicos de zapata expansible, delantero y posterior"], ["Freno de estacionamiento", "Mecánico de zapata expansible en ruedas traseras"]],
      consumo: [["Velocidad máxima", "63 km/h"], ["Capacidad de tanque", "3 L de gasolina + cilindro de GNV"]],
      dimensiones: [["Largo", "2,635 mm"], ["Ancho", "1,350 mm"], ["Alto", "1,710 mm"], ["Peso en vacío", "397 kg"], ["Peso máximo", "707 kg"]],
      electrico: [["Sistema eléctrico", "12 V DC"], ["Batería", "12 V, 32 Ah"], ["Faro delantero", "35/35 W"], ["Luz trasera / freno", "5/21 W o 5/18 W"]],
    },
  },
  {
    id: "torito-250-4v-glp", codmod: "3", nombre: "Torito 250 4V GLP", familia: "Motores 4 Válvulas",
    estado: "Publicado", tipoMotor: "4 tiempos", combustible: "GLP", uso: "Pasajeros", tipoTecho: "Especial",
    precioDesde: 18299, badges: ["NUEVO MODELO"],
    imagen: `${TORITO}/2026/09/torito-250-4v-frontal-lateral-izq.png`, local: "/images/modelos/modelo-3.png",
    // Vista 360°: 8 fotos reales publicadas por torito.pe, en orden de giro.
    angulos360: ["frontal-lateral-izq", "lateral-izq", "posterior-lateral-izq", "posterior", "posterior-lateral-der", "lateral-der", "frontal-lateral-der", "frontal"].map((a) => `${TORITO}/2026/09/torito-250-4v-${a}.png`),
    colores: ["Rojo", "Blanco", "Azul"],
    descripcion: "El Torito 250 4V GLP lleva el motor de 4 válvulas a GLP con llantas aro 10 y suspensión delantera doble: más estabilidad y comodidad en cualquier ruta, con el ahorro del gas.",
    destacados: ["Llantas 4.00-10, aro 10\" sin cámara", "Suspensión delantera doble", "Motor 4 válvulas: 10.33 HP y 18 Nm", "Tanque de 20.6 L de GLP + 3 L de gasolina"],
    resumen: {"Motor": "4 tiempos, 4 válvulas", "Cilindrada": "236.2 cc", "Llantas": "Aro 10\" sin cámara", "Potencia": "10.33 HP", "Torque": "18 Nm"},
    specs: {
      motor: [["Motor", "4 tiempos, 4 válvulas"], ["Combustible", "GLP con respaldo de gasolina"], ["Cilindrada", "236.2 cc"], ["Diámetro × carrera", "67 mm × 67 mm"], ["Refrigeración", "Forzada por aire y aceite"], ["Transmisión", "Eje cardán (CV), engranaje constante, manual: 4 marchas + 1 reversa"], ["Potencia máxima", "10.33 HP a 5,000 ± 250 RPM"], ["Torque máximo", "18 Nm a 3,500 RPM"]],
      chasis: [["Neumáticos", "4.00-10, 4/10 PR (los cuatro)"], ["Suspensión", "Delantera doble"], ["Frenos", "Hidráulicos de zapata expansible, delantero y posterior"], ["Freno de estacionamiento", "Mecánico de zapata expansible en ruedas traseras"]],
      consumo: [["Velocidad máxima", "65 km/h"], ["Capacidad de tanque", "20.6 L de GLP (16.5 L al 80%) + 3 L de gasolina"]],
      dimensiones: [["Largo", "2,635 mm"], ["Ancho", "1,350 mm"], ["Alto", "1,710 mm"], ["Peso en vacío", "386 kg"], ["Peso máximo", "696 kg"]],
      electrico: [["Sistema eléctrico", "12 V DC"], ["Batería", "12 V, 32 Ah"], ["Faro delantero", "35/35 W"], ["Luz trasera / freno", "5/21 W o 5/18 W"]],
    },
  },
  {
    id: "torito-2t-ug-glp", codmod: "4", nombre: "Torito 2T UG GLP", familia: "Motores 2 Tiempos",
    estado: "Publicado", tipoMotor: "2 tiempos", combustible: "GLP", uso: "Pasajeros", tipoTecho: "Clásico",
    precioDesde: 14699, badges: [],
    imagen: `${TORITO}/2025/04/8.png`, local: "/images/modelos/modelo-4.png",
    fotosColor: { Rojo: `${TORITO}/2025/04/8.png`, Azul: `${TORITO}/2025/04/7-1.png` },
    colores: ["Rojo", "Azul"],
    descripcion: "Motor de 2 tiempos con GLP: la opción más económica para empezar a trabajar. Fácil de mantener, ligero y con bajo costo por kilómetro.",
    destacados: ["Motor de 2 tiempos de 145.45 cc", "8.58 HP y 15 Nm de torque", "Peso de solo 325 kg", "Precio de entrada accesible"],
    resumen: {"Motor": "2 tiempos", "Cilindrada": "145.45 cc", "Llantas": "4-8, aro de una pieza", "Potencia": "8.58 HP", "Torque": "15 Nm"},
    specs: {
      motor: [["Motor", "2 tiempos UG GLP"], ["Cilindrada", "145.45 cc"], ["Diámetro × carrera", "57 mm × 57 mm"], ["Bujía", "1 (Champion RL82C)"], ["Refrigeración", "Forzada por aire"], ["Embrague", "Multidisco húmedo"], ["Transmisión", "Manual, malla constante: 4 marchas + 1 reversa"], ["Potencia máxima", "8.58 HP a 5,000 ± 250 RPM"], ["Torque máximo", "15 Nm a 3,300 ± 250 RPM"]],
      chasis: [["Chasis", "Monocasco"], ["Neumáticos", "4-8, 4-6 PR, aro de una pieza"], ["Frenos", "Tambor de expansión hidráulica, delantero y posterior"], ["Freno de estacionamiento", "Zapata de expansión mecánica"], ["Presión de llantas", "Delantera 36 PSI · posterior 40 PSI"]],
      consumo: [["Velocidad máxima", "60 km/h"], ["Capacidad de tanque", "20.6 L"], ["Capacidad de escalada", "16% (9.1°) máx."]],
      dimensiones: [["Largo", "2,658 mm"], ["Ancho", "1,300 mm"], ["Alto", "1,700 mm"], ["Radio de giro", "2,880 mm"], ["Peso", "325 kg"]],
      electrico: [["Sistema eléctrico", "12 V CC"], ["Batería", "32 Ah (arranque eléctrico)"], ["Bocina", "12 V DC, tipo 2A"]],
    },
  },
  {
    id: "torito-2t-ug-gsl", codmod: "5", nombre: "Torito 2T UG GSL", familia: "Motores 2 Tiempos",
    estado: "Publicado", tipoMotor: "2 tiempos", combustible: "Gasolina", uso: "Pasajeros", tipoTecho: "Clásico",
    precioDesde: 12699, badges: [],
    imagen: `${TORITO}/2025/04/7-1.png`, local: "/images/modelos/modelo-5.png",
    fotosColor: { Rojo: `${TORITO}/2025/04/8.png`, Azul: `${TORITO}/2025/04/7-1.png` },
    colores: ["Rojo", "Azul"],
    descripcion: "El Torito más accesible de la línea. Motor 2 tiempos a gasolina, ideal para comenzar tu negocio de transporte con la menor inversión.",
    destacados: ["El precio más bajo de la línea", "8.44 HP y 17 Nm de torque", "Peso de 340 kg", "Mantenimiento sencillo"],
    resumen: {"Motor": "2 tiempos", "Cilindrada": "145.45 cc", "Llantas": "4-8 sin cámara", "Potencia": "8.44 HP", "Torque": "17 Nm"},
    specs: {
      motor: [["Motor", "2 tiempos UG GSL"], ["Cilindrada", "145.45 cc"], ["Diámetro × carrera", "57 mm × 57 mm"], ["Bujía", "1 (Champion RL82C)"], ["Refrigeración", "Forzada por aire"], ["Embrague", "Multidisco húmedo"], ["Transmisión", "Manual, malla constante: 4 marchas + 1 reversa"], ["Potencia máxima", "8.44 HP a 4,000 ± 250 RPM"], ["Torque máximo", "17 Nm a 3,000 ± 250 RPM"]],
      chasis: [["Chasis", "Monocasco"], ["Neumáticos", "4-8, 4-6 PR (sin cámara)"], ["Frenos", "Tambor de expansión hidráulica, delantero y posterior"], ["Freno de estacionamiento", "Zapata de expansión mecánica"], ["Presión de llantas", "Delantera 36 PSI · posterior 40 PSI"]],
      consumo: [["Velocidad máxima", "60 km/h"], ["Capacidad de tanque", "8 L"], ["Capacidad de escalada", "18% (10.2°) máx."]],
      dimensiones: [["Largo", "2,658 mm"], ["Ancho", "1,300 mm"], ["Alto", "1,700 mm"], ["Radio de giro", "2,880 mm"], ["Peso", "340 kg"]],
      electrico: [["Sistema eléctrico", "12 V CC"], ["Batería", "32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)"], ["Bocina", "12 V DC, tipo 2A"]],
    },
  },
  {
    id: "torito-crom-plus-gnv", codmod: "6", nombre: "Torito Crom Plus GNV", familia: "Motores Crom Plus",
    estado: "Publicado", tipoMotor: "4 tiempos", combustible: "GNV", uso: "Pasajeros", tipoTecho: "Especial",
    precioDesde: 17199, badges: [],
    imagen: `${TORITO}/2025/04/8.png`, local: "/images/modelos/modelo-6.png",
    fotosColor: { Rojo: `${TORITO}/2025/04/8.png`, Azul: `${TORITO}/2025/04/3-2.png` },
    colores: ["Rojo", "Azul"],
    descripcion: "El Crom Plus GNV es el motocar para quien quiere gastar menos: funciona con gas natural, el combustible más económico por kilómetro.",
    destacados: ["Motor de 198.88 cc", "Tanque de GNV de 30 L (4.5 kg)", "8.78 HP y 14.5 Nm", "El combustible más económico"],
    resumen: {"Motor": "4 tiempos", "Cilindrada": "198.88 cc", "Llantas": "4-8 sin cámara", "Potencia": "8.78 HP", "Torque": "14.5 Nm"},
    specs: {
      motor: [["Motor", "4 tiempos GNV"], ["Cilindrada", "198.88 cc"], ["Diámetro × carrera", "63.5 mm × 62.8 mm"], ["Bujía", "Doble bujía"], ["Refrigeración", "Forzada por aire y aceite"], ["Embrague", "Multidisco húmedo"], ["Transmisión", "Manual, malla constante: 4 marchas + 1 reversa"], ["Potencia máxima", "8.78 HP a 5,000 ± 250 RPM"], ["Torque máximo", "14.5 Nm a 3,500 ± 250 RPM"]],
      chasis: [["Neumáticos", "4.00-8, 6 PR, aro de una pieza"], ["Capacidad de escalada", "19% (10.8°) máx."]],
      consumo: [["Capacidad de tanque", "30 L / 4.5 kg de GNV (reserva 3 L)"]],
      dimensiones: [["Largo", "2,635 mm"], ["Ancho", "1,300 mm"], ["Alto", "1,710 mm"], ["Peso", "348 kg"]],
      electrico: [["Sistema eléctrico", "12 V CC"], ["Batería", "32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)"], ["Bocina", "12 V DC, tipo 2A"]],
    },
  },
  {
    id: "torito-crom-plus-glp", codmod: "7", nombre: "Torito Crom Plus GLP", familia: "Motores Crom Plus",
    estado: "Publicado", tipoMotor: "4 tiempos", combustible: "GLP", uso: "Pasajeros", tipoTecho: "Especial",
    precioDesde: 16999, badges: [],
    imagen: `${TORITO}/2025/04/646c02f5bcb15589337055.png`, local: "/images/modelos/modelo-7.png",
    fotosColor: { Rojo: `${TORITO}/2025/04/646c02f5bcb15589337055.png`, Azul: `${TORITO}/2025/04/3-2.png` },
    colores: ["Rojo", "Azul"],
    descripcion: "Crom Plus con GLP: equilibrio entre potencia y ahorro, con 9.32 HP y 16 Nm para el trabajo diario.",
    destacados: ["9.32 HP y 16 Nm de torque", "Opera con GLP", "Peso de 370 kg", "Excelente relación precio-rendimiento"],
    resumen: {"Motor": "4 tiempos", "Cilindrada": "198.88 cc", "Llantas": "4-8 sin cámara", "Potencia": "9.32 HP", "Torque": "16 Nm"},
    specs: {
      motor: [["Motor", "4 tiempos UG GLP"], ["Cilindrada", "198.88 cc"], ["Diámetro × carrera", "63.5 mm × 62.8 mm"], ["Bujía", "2 (Champion RG6HCC / Bosch UR6CC)"], ["Refrigeración", "Forzada por aire y aceite"], ["Embrague", "Multidisco húmedo (7 discos)"], ["Transmisión", "Engranaje constante, manual: 4 marchas + 1 reversa"], ["Potencia máxima", "9.32 HP a 5,000 ± 250 RPM"], ["Torque máximo", "16 Nm a 3,500 ± 250 RPM"]],
      chasis: [["Chasis", "Monocasco"], ["Neumáticos", "4-8, 4-6 PR (sin cámara)"], ["Frenos", "Tambor de expansión hidráulica, delantero y posterior"], ["Freno de estacionamiento", "Zapata de expansión mecánica"], ["Presión de llantas", "Delantera 36 PSI · posterior 40 PSI"], ["Capacidad de escalada", "16.5% (9.1°) máx."]],
      consumo: [["Velocidad máxima", "65 km/h"], ["Capacidad de tanque", "20.6 L de GLP + 3 L de gasolina"]],
      dimensiones: [["Largo", "2,635 mm"], ["Ancho", "1,300 mm"], ["Alto", "1,710 mm"], ["Radio de giro", "2,880 mm"], ["Peso", "370 kg"]],
      electrico: [["Sistema eléctrico", "12 V CC"], ["Batería", "32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)"], ["Bocina", "12 V DC, tipo 2A"]],
    },
  },
  {
    id: "torito-crom-plus-gsl", codmod: "8", nombre: "Torito Crom Plus GSL", familia: "Motores Crom Plus",
    estado: "Publicado", tipoMotor: "4 tiempos", combustible: "Gasolina", uso: "Pasajeros", tipoTecho: "Especial",
    precioDesde: 17199, badges: [],
    imagen: `${TORITO}/2025/04/3-2.png`, local: "/images/modelos/modelo-8.png",
    fotosColor: { Rojo: `${TORITO}/2025/04/646c02f5bcb15589337055.png`, Azul: `${TORITO}/2025/04/3-2.png` },
    colores: ["Rojo", "Azul"],
    descripcion: "Crom Plus a gasolina: la versión más potente de la familia, con 10.19 HP y 17.10 Nm de torque.",
    destacados: ["10.19 HP y 17.10 Nm de torque", "Opera con gasolina", "Peso de 348 kg", "Diseño Crom Plus"],
    resumen: {"Motor": "4 tiempos", "Cilindrada": "198.88 cc", "Llantas": "4-8 sin cámara", "Potencia": "10.19 HP", "Torque": "17.10 Nm"},
    specs: {
      motor: [["Motor", "4 tiempos UG a gasolina"], ["Cilindrada", "198.88 cc"], ["Diámetro × carrera", "63.5 mm × 62.8 mm"], ["Bujía", "2 (Champion RG6HCC / Bosch UR6CC)"], ["Refrigeración", "Forzada por aire y aceite"], ["Embrague", "Multidisco húmedo (7 discos)"], ["Transmisión", "Engranaje constante, manual: 4 marchas + 1 reversa"], ["Potencia máxima", "10.19 HP a 5,000 ± 250 RPM"], ["Torque máximo", "17.10 Nm a 3,500 ± 250 RPM"]],
      chasis: [["Chasis", "Monocasco"], ["Neumáticos", "4-8, 4-6 PR (sin cámara)"], ["Frenos", "Tambor de expansión hidráulica, delantero y posterior"], ["Freno de estacionamiento", "Zapata de expansión mecánica"], ["Presión de llantas", "Delantera 36 PSI · posterior 40 PSI"]],
      consumo: [["Velocidad máxima", "65 km/h"], ["Capacidad de tanque", "8 L"], ["Capacidad de escalada", "19% (10.8°) máx."]],
      dimensiones: [["Largo", "2,635 mm"], ["Ancho", "1,300 mm"], ["Alto", "1,710 mm"], ["Radio de giro", "2,880 mm"], ["Peso", "348 kg"]],
      electrico: [["Sistema eléctrico", "12 V CC"], ["Batería", "32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)"], ["Bocina", "12 V DC, tipo 2A"]],
    },
  },
];

export const TABS_TECNICOS = [
  { id: "motor", label: "Motor" },
  { id: "chasis", label: "Chasis y Carrocería" },
  { id: "consumo", label: "Consumo y Rendimiento" },
  { id: "dimensiones", label: "Dimensiones" },
  { id: "electrico", label: "Sistema eléctrico" },
];

export const FILTROS_CATALOGO = {
  tipoMotor: ["2 tiempos", "4 tiempos"],
  combustible: ["Gasolina", "GLP", "GNV"],
  uso: ["Pasajeros", "Carga"],
  tipoTecho: ["Clásico", "Especial", "Sin techo"],
};

// Opciones de techo y precios referenciales (calculadora de torito.pe).
export const OPCIONES_TECHO = [
  { id: "lona", nombre: "Lona", precio: 200 },
  { id: "basico", nombre: "Básico", precio: 2000 },
  { id: "superlujo", nombre: "Superlujo", precio: 3000 },
  { id: "deportivo", nombre: "Superlujo Deportivo", precio: 4000 },
];
export const CUOTAS_INICIAL = [20, 30, 40, 50];
export const PLAZOS = [6, 12, 18, 24, 30, 36];

export const formatoSoles = (n) => `S/ ${Number(n).toLocaleString("es-PE")}`;

const HORARIO_SEDE = "Lunes a Sábado de 9:00 AM a 5:00 PM";
const HORARIO_NOTA = "Domingos: consultar por WhatsApp o en sede";
export const UBICACIONES = [
  { id: 1, nombre: "Comas", tipo: "Sede propia", direccion: "Av. 22 de Agosto 852, Comas, Lima", telefono: "51907721481", correo: "inversionesepsamotor@gmail.com", horario: HORARIO_SEDE, horarioNota: HORARIO_NOTA, activo: true },
  { id: 2, nombre: "Ventanilla", tipo: "Sede propia", direccion: "Av. José Olaya Balandra Mz. Z, Lote 9, Ventanilla, Callao", telefono: "51907721481", correo: "inversionesepsamotor@gmail.com", horario: HORARIO_SEDE, horarioNota: HORARIO_NOTA, activo: true },
  { id: 3, nombre: "Puente Piedra", tipo: "Sede propia", direccion: "Asoc. de Viv. Los Rosales, Mz. C, Lote 9, Puente Piedra, Lima", telefono: "51907721481", correo: "inversionesepsamotor@gmail.com", horario: HORARIO_SEDE, horarioNota: HORARIO_NOTA, activo: true },
  { id: 4, nombre: "Crossland Ancón", tipo: "Almacén externo", direccion: "", telefono: "", correo: "", activo: true },
  { id: 5, nombre: "FIVESA", tipo: "Proveedor de techo", direccion: "", telefono: "", correo: "", activo: true },
  { id: 6, nombre: "JAVICAR", tipo: "Proveedor de techo", direccion: "", telefono: "", correo: "", activo: true },
  { id: 7, nombre: "FIBRAT", tipo: "Proveedor de techo", direccion: "", telefono: "", correo: "", activo: true },
];
export const TIPOS_UBICACION = ["Sede propia", "Almacén externo", "Proveedor de techo"];
// Etiquetas del backend (tipubi) ↔ etiquetas de la interfaz
export const TIPO_A_API = { "Sede propia": "Sede", "Almacén externo": "Almacen", "Proveedor de techo": "Proveedor" };
export const TIPO_DE_API = { Sede: "Sede propia", Almacen: "Almacén externo", Proveedor: "Proveedor de techo" };

export function enlaceGoogleMaps(direccion) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}
export function enlaceMapaEmbebido(direccion) {
  return `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`;
}

// HU-004: configuración del techo de cada unidad. Los techos de fibra los instala un proveedor externo.
export const TIPOS_TECHO = ["Sin techo", "Lona", "Fibra Básico", "Fibra Superlujo", "Fibra Superlujo Deportivo"];
export const TECHO_REQUIERE_PROVEEDOR = (t) => String(t || "").startsWith("Fibra");
export const PROVEEDORES_TECHO = ["FIVESA", "JAVICAR", "FIBRAT"];
export const ESTADOS_PREPARACION = ["Sin preparar", "Pendiente de techo", "En preparación", "Lista para entrega"];

export const SEDES_ATENCION = ["Comas", "Ventanilla", "Puente Piedra"];
export const CANALES = ["WhatsApp", "Llamada", "Formulario web", "Visita a sede", "Facebook", "TikTok", "Referido"];
export const ESTADOS_LEAD = ["Nuevo", "En seguimiento", "Cotizado", "Cerrado ganado", "Perdido"];

// ---- Equipo ----
// Usuarios del panel (modo demostración). Cuentas de acceso por rol:
//   Gerente: geren / geren (también acepta gere / gere) · Administradora: admin / admin · Vendedor: vend / vend
// Los usuarios que el gerente crea en Equipo entran con su correo y su contraseña.
// En producción cada persona entra con su correo de Supabase Auth y el rol sale de la base de datos (HU-007).
export const EQUIPO = [
  { id: 1, nombre: "Flavio", correo: "gerencia@epsamotor.com.pe", usuario: "geren", clave: "geren", alias: [["gere", "gere"]], celular: "", rol: "gerente", sede: "Todas", activo: true, ausente: false, recibeLeads: false },
  { id: 2, nombre: "Deysi", correo: "admin@epsamotor.com.pe", usuario: "admin", clave: "admin", celular: "", rol: "administradora", sede: "Todas", activo: true, ausente: false, recibeLeads: false },
  { id: 3, nombre: "César", correo: "cesar@epsamotor.com.pe", usuario: "vend", clave: "vend", celular: "", rol: "vendedor", sede: "Comas", activo: true, ausente: false, recibeLeads: true },
  { id: 4, nombre: "Samuel", correo: "samuel@epsamotor.com.pe", clave: "", celular: "", rol: "vendedor", sede: "Ventanilla", activo: true, ausente: false, recibeLeads: true },
];

// Equipo del proyecto (Proyecto Tecnológico · Grupo 7 · ISIL 2026-2)
export const EQUIPO_PROYECTO = [
  { nombre: "Harold Salazar Masgo", rol: "Product Owner", detalle: "Prioriza el backlog y valida cada historia con EPSA Motor." },
  { nombre: "Adrian Alejandro Dionicio Alcarraz", rol: "Scrum Master y DevOps", detalle: "Conduce el sprint, Jira, GitHub y el despliegue en Netlify." },
  { nombre: "Didier Andres Leguia Sandoval", rol: "Developer UX/UI y Frontend", detalle: "Web pública y panel de gestión (React, Vite y Tailwind)." },
  { nombre: "Michelle Adriana Alexys Fuentes Villaorduña", rol: "Developer Backend y Datos", detalle: "API Express con TypeScript y base de datos en Supabase." },
  { nombre: "Jazmin Reinoso Rojas", rol: "Developer QA e Integradora", detalle: "Pruebas de aceptación e integración de cada historia." },
];

// ---- Leads ----
const hoy = new Date();
const dia = (n) => new Date(hoy.getTime() - n * 86400000).toISOString().slice(0, 10);
const LEADS_BASE = [
  { id: 1, fecha: dia(0), contacto: "Carlos Ramírez", telefono: "987654321", canal: "Formulario web", modelo: "torito-4v-gsl", color: "Rojo", sede: "Comas", responsable: "César", estado: "Nuevo", nota: "" },
  { id: 2, fecha: dia(1), contacto: "María Torres", telefono: "955112233", canal: "WhatsApp", modelo: "torito-crom-plus-gnv", color: "Azul", sede: "Ventanilla", responsable: "Samuel", estado: "En seguimiento", nota: "Pidió crédito a 24 meses" },
  { id: 3, fecha: dia(2), contacto: "José Quispe", telefono: "944778899", canal: "Visita a sede", modelo: "torito-4v-gsl", color: "", sede: "Comas", responsable: "César", estado: "Cotizado", nota: "Cotización enviada" },
  { id: 4, fecha: dia(3), contacto: "Rosa Huamán", telefono: "933221100", canal: "Facebook", modelo: "torito-2t-ug-gsl", color: "Blanco", sede: "Puente Piedra", responsable: "Sin asignar", estado: "Nuevo", nota: "" },
  { id: 5, fecha: dia(4), contacto: "Pedro Salas", telefono: "922334455", canal: "Referido", modelo: "torito-250-4v-glp", color: "Rojo", sede: "Comas", responsable: "César", estado: "En seguimiento", nota: "" },
  { id: 6, fecha: dia(5), contacto: "Lucía Paredes", telefono: "911000222", canal: "WhatsApp", modelo: "torito-4v-glp", color: "", sede: "Ventanilla", responsable: "Samuel", estado: "Cerrado ganado", nota: "Entrega programada" },
  { id: 7, fecha: dia(6), contacto: "Julio Mendoza", telefono: "900555666", canal: "TikTok", modelo: "torito-4v-gsl", color: "Azul", sede: "Comas", responsable: "César", estado: "Perdido", nota: "Compró en otra marca" },
];
const NOM_L = ["Rafael Núñez","Sofía Campos","Walter Gil","Karen Ortiz","Daniel Pinto","Gloria Silva","Raúl Vera","Mónica Luna","Teo Aguilar","Pilar Rojas"];
const CAN_L = ["WhatsApp", "Formulario web", "Facebook", "Visita a sede", "TikTok", "Llamada", "Referido"];
const EST_L = ["Nuevo", "En seguimiento", "Cotizado", "Cerrado ganado", "Perdido"];
const LEADS_EXTRA = Array.from({ length: 26 }, (_, i) => ({
  id: 8 + i, fecha: dia(7 + i * 3), contacto: NOM_L[i % NOM_L.length], telefono: `9${(30000000 + i * 91317) % 100000000}`.slice(0, 9).padEnd(9, "1"),
  canal: CAN_L[i % CAN_L.length], modelo: MODELOS[(i * 5 + 2) % MODELOS.length].id, color: "", sede: SEDES_ATENCION[i % 3],
  responsable: ["César", "Samuel", "César", "Samuel", "Sin asignar"][i % 5], estado: EST_L[(i * 2) % 5], nota: "",
}));
export const LEADS = [...LEADS_BASE, ...LEADS_EXTRA];

export const SEGUIMIENTOS = [
  { id: 1, leadId: 2, fecha: dia(-1), tipo: "Llamada", detalle: "Confirmar documentos para crédito", responsable: "Samuel", hecho: false },
  { id: 2, leadId: 3, fecha: dia(0), tipo: "WhatsApp", detalle: "Preguntar si decidió la compra", responsable: "César", hecho: false },
  { id: 3, leadId: 5, fecha: dia(-2), tipo: "Visita", detalle: "Prueba de manejo en Comas", responsable: "César", hecho: false },
  { id: 4, leadId: 6, fecha: dia(3), tipo: "Llamada", detalle: "Coordinar entrega", responsable: "Samuel", hecho: true },
];

// Historial de ventas de ejemplo (últimos ~6 meses) para que los gráficos del panel tengan datos.
const NOMBRES = ["Lucía Paredes","Mario Díaz","Carmen Rojas","Julio Ñahui","Rosa Vega","Hugo Castillo","Ana Cruz","Beto Salas","Elena Ríos","Óscar Ponce","Nora Lazo","Iván Mora"];
const ETAPAS = ["Cotización", "Pedido registrado", "Pedido registrado", "Entregado", "Entregado", "Entregado"];
export const VENTAS = Array.from({ length: 34 }, (_, i) => {
  const m = MODELOS[(i * 3 + 1) % MODELOS.length];
  const pago = i % 3 === 0 ? "Pago al contado" : "Financiamiento";
  const total = m.precioDesde;
  return {
    id: i + 1, fecha: dia(i * 5 + (i % 4)), cliente: NOMBRES[i % NOMBRES.length], celular: `9${(11000000 + i * 137531) % 100000000}`.slice(0, 9).padEnd(9, "0"),
    documento: `DNI ${40000000 + i * 7919}`, modelo: m.id, pago, etapa: ETAPAS[i % ETAPAS.length],
    vendedor: ["César", "Samuel"][i % 2], sede: SEDES_ATENCION[i % 3], adelanto: pago === "Pago al contado" ? total : Math.round(total * 0.3), total,
  };
});

export const METAS = [
  { id: 1, mes: hoy.toISOString().slice(0, 7), sede: "Comas", meta: 12, registradas: 4 },
  { id: 2, mes: hoy.toISOString().slice(0, 7), sede: "Ventanilla", meta: 10, registradas: 3 },
  { id: 3, mes: hoy.toISOString().slice(0, 7), sede: "Puente Piedra", meta: 8, registradas: 2 },
];

// ---- Inventario: 90 unidades generadas ----
const COLORES_U = ["Rojo", "Blanco", "Azul"];
const UBIC_U = ["Comas", "Ventanilla", "Puente Piedra", "Crossland Ancón", ""]; // "" = identificada, aún sin recepción física
const PREP_U = ["Lista para entrega", "En preparación", "Pendiente de techo", "Sin preparar"];
const TECHOS_U = ["Sin techo", "Lona", "Fibra Básico", "Fibra Superlujo", "Fibra Superlujo Deportivo"];
const DISP_U = ["Disponible", "Disponible", "Disponible", "Separada", "Vendida"];
export const UNIDADES = Array.from({ length: 90 }, (_, i) => {
  const m = MODELOS[i % MODELOS.length];
  const ubicacion = UBIC_U[[0, 1, 2, 0, 3, 1, 2, 0, 4, 1, 2][i % 11]];
  if (!ubicacion) {
    return { id: `MC-${String(i + 1).padStart(3, "0")}`, modelo: m.id, color: COLORES_U[i % 3], ubicacion: "", preparacion: "Sin preparar", techo: "Sin techo", proveedorTecho: "", estadoTecho: "", disponibilidad: "No disponible", motor: `BJM-${10200 + i * 3}`, chasis: `BJC-${88200 + i * 5}`, observaciones: [], historial: [{ fecha: dia(4), detalle: "Identificada; en camino desde Crosland" }] };
  }
  return {
    id: `MC-${String(i + 1).padStart(3, "0")}`,
    modelo: m.id,
    color: COLORES_U[i % 3],
    ubicacion,
    preparacion: PREP_U[i % 4],
    ...((t) => ({ techo: t, proveedorTecho: t.startsWith("Fibra") ? ["FIVESA", "JAVICAR", "FIBRAT"][i % 3] : "", estadoTecho: t === "Sin techo" ? "" : PREP_U[i % 4] === "Pendiente de techo" ? "Pendiente de instalación" : "Instalado" }))(TECHOS_U[(i + 1) % 5]),
    observaciones: [],
    disponibilidad: DISP_U[i % 5],
    motor: `BJM-${10200 + i * 3}`,
    chasis: `BJC-${88200 + i * 5}`,
    historial: [{ fecha: dia(20), detalle: "Recepción desde Crossland" }],
  };
});

// Unidades de la compra #2 ya identificadas (HU-002): nacen "No disponible" y sin ubicación hasta su recepción.
const IDENT_C2 = Array.from({ length: 6 }, (_, i) => ({ nummotuni: `CPG-${40100 + i * 7}`, chauni: `CPC-${77300 + i * 9}`, codmod: "6", coluni: "Azul", fecreguni: dia(5) }));
UNIDADES.push(...IDENT_C2.map((u, i) => ({
  id: `MC-${String(91 + i).padStart(3, "0")}`, codcom: "2", modelo: "torito-crom-plus-gnv", color: "Azul",
  ubicacion: i < 3 ? "Crossland Ancón" : "", preparacion: i < 3 ? "Pendiente de techo" : "Sin preparar", techo: i < 3 ? "Fibra Superlujo" : "Sin techo", proveedorTecho: i < 3 ? "JAVICAR" : "", estadoTecho: i < 3 ? "Pendiente de instalación" : "", observaciones: [],
  disponibilidad: "No disponible", motor: u.nummotuni, chasis: u.chauni,
  historial: [{ fecha: dia(5), detalle: "Identificada en compra #2 (HU-002)" }, ...(i < 3 ? [{ fecha: dia(3), detalle: "Recepción física en Crossland Ancón" }] : [])],
})));

// ---- Compras a proveedor (modo demostración; mismo contrato que /api/compras) ----
export const COMPRAS = [
  { id: 1, codcom: "1", codmod: "1", nommod: "Torito 4V GSL", colcom: "Rojo", cancom: 20, cantidad_pendiente: 0, estcom: "Identificada", feccom: dia(30), horcom: "10:15", codusu: "Gerencia",
    factura: { codfac: "1", emisor: "Crosland Perú S.A.C.", numero: "F001-004512", fecha_emision: dia(28), cantidad_motos: 20, archivo_adjuntado: false }, unidades: [] },
  { id: 2, codcom: "2", codmod: "6", nommod: "Torito Crom Plus GNV", colcom: "Azul", cancom: 10, cantidad_pendiente: 4, estcom: "Pendiente de identificación", feccom: dia(8), horcom: "11:40", codusu: "Administración",
    factura: { codfac: "2", emisor: "Crosland Perú S.A.C.", numero: "F001-004598", fecha_emision: dia(6), cantidad_motos: 10, archivo_adjuntado: false }, unidades: IDENT_C2 },
  { id: 3, codcom: "3", codmod: "3", nommod: "Torito 250 4V GLP", colcom: "Blanco", cancom: 6, cantidad_pendiente: 6, estcom: "Pendiente de factura", feccom: dia(1), horcom: "09:20", codusu: "Administración", factura: null, unidades: [] },
];

// ---- Roles (HU-007) ----
// "puede": secciones del menú. "permisos": acciones. El gerente tiene todas ("*").
// La administradora gestiona catálogo, compras, facturas e inventario, pero no elimina,
// no administra sedes/ubicaciones ni usuarios, no fija metas y no emite comprobantes.
// El vendedor atiende leads, seguimiento y ventas, y consulta lo demás.
export const ROLES = {
  gerente: {
    nombre: "Gerente",
    puede: ["resumen", "leads", "seguimiento", "ventas", "metas", "modelos", "inventario", "ubicaciones", "compras", "equipo", "integracion"],
    permisos: ["*"],
    descripcion: "Acceso total: crea, edita, desactiva y elimina. Administra sedes, usuarios y metas, y emite comprobantes manuales.",
  },
  administradora: {
    nombre: "Administradora",
    puede: ["resumen", "leads", "seguimiento", "ventas", "metas", "modelos", "inventario", "ubicaciones", "compras", "equipo", "integracion"],
    permisos: ["ver", "crear", "editar", "mover", "modelos.editar", "modelos.publicar", "compras.registrar", "compras.factura", "unidades.gestionar", "unidades.trasladar", "leads.ausencia"],
    descripcion: "Edita modelos y sus descripciones, registra compras, facturas e identificación, y gestiona el inventario. No elimina, no edita sedes ni usuarios.",
  },
  vendedor: {
    nombre: "Vendedor",
    puede: ["resumen", "leads", "seguimiento", "ventas", "modelos", "inventario", "ubicaciones", "compras"],
    permisos: ["ver", "crear", "unidades.observar"],
    descripcion: "Atiende leads, seguimiento y ventas. Consulta modelos, inventario y ubicaciones; en la ficha de una unidad solo deja observaciones comerciales.",
  },
};
