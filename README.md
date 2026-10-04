# epsa-motor-comercial

Transformación digital de la gestión comercial de EPSA Motor - Grupo 7 (ISIL 2026-2)

# EPSA Motor - Sistema Web de Gestión Comercial y Control de Stock Multisede

Proyecto del curso **Proyecto Tecnológico (NRC 3710)** - Periodo Académico 2026-2.

## 👥 Equipo del Proyecto - Grupo 7

- **Product Owner:** Harold Salazar Masgo
- **Scrum Master & DevOps:** Adrian Alejandro Dionicio Alcarraz
- **Developer UX/UI & Frontend:** Didier Andres Leguia Sandoval
- **Developer Backend & Datos:** Michelle Adriana Alexys Fuentes Villaorduña
- **Developer QA e Integradora:** Jazmin Reinoso Rojas

## 🛠️ Stack Tecnológico

- **Gestión:** Jira Software Cloud
- **Base de Datos & Auth:** Supabase (PostgreSQL)
- **Backend:** Node.js + Express + TypeScript
- **Despliegue:** Netlify CI/CD

## 🌿 Convención de Ramas

- `main`: Producción
- `staging`: Entorno de Pruebas / QA
- `develop`: Desarrollo activo
- `feature/HU-XXX`: Ramas por Historia de Usuario

---

## Backend - HU-026 Administrar ubicaciones

Esta HU implementa el catálogo interno de ubicaciones y su administración desde el backend.

### Funcionalidades

- Consulta de ubicaciones.
- Filtro por activas/inactivas.
- Registro de nuevas ubicaciones.
- Edición de nombre, tipo y dirección.
- Activación y desactivación lógica.
- Validación de nombres duplicados normalizados.
- Restricción de desactivación cuando existen unidades o traslados activos.
- Autenticación con Supabase Auth.
- Permisos por rol:
  - Gerente: consulta y gestión.
  - Administradora: consulta y gestión.
  - Vendedor: solo consulta.

### Inicio local

1. Instalar dependencias:

   `npm ci`

2. Copiar `.env.example` a `.env` y completar las variables del proyecto de Supabase.

3. Aplicar la migración:

   `supabase/migrations/202610030001_hu026_ubicaciones.sql`

4. Ejecutar la API:

   `npm run dev`

5. La API estará disponible en:

   `http://localhost:3000`

6. Ejecutar las validaciones:

   `npm test`

   `npm run build`

### Seguridad

No usar una clave `service_role` en esta API.

Cada petición autenticada transmite el token del usuario a Supabase para que se apliquen RLS y los permisos correspondientes.

El archivo `.env` no debe versionarse.

### Documentación y QA

La documentación específica de la HU se encuentra en:

`docs/HU-026.md`

La colección de Postman para pruebas se encuentra en:

`docs/HU-026.postman_collection.json`

La pantalla del catálogo corresponde al frontend.

El login general corresponde a HU-007; HU-026 consume los tokens generados por Supabase Auth.

### Despliegue

La API es un servidor Node.js/Express.

El despliegue del frontend en Netlify no despliega automáticamente este backend, por lo que el equipo deberá definir el alojamiento de la API para el entorno de QA.