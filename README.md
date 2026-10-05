# EPSA Motor - Sistema Web de Gestión Comercial y Control de Stock Multisede

Transformación digital de la gestión comercial de EPSA Motor - Grupo 7 (ISIL 2026-2).

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
- **Frontend / CI/CD:** Netlify

## 🌿 Convención de Ramas

- `main`: Producción
- `staging`: Entorno de pruebas / QA
- `develop`: Desarrollo activo
- `feature/HU-XXX`: Ramas por Historia de Usuario

---

## 🚀 Inicio local

1. Instalar dependencias:

   `npm ci`

2. Copiar `.env.example` a `.env` y completar las variables de Supabase.

3. Ejecutar la API:

   `npm run dev`

4. API local:

   `http://localhost:3000`

5. Ejecutar pruebas:

   `npm test`

6. Verificar compilación:

   `npm run build`

## 🔐 Seguridad

No utilizar una clave `service_role` en la API.

Las peticiones autenticadas transmiten el token del usuario a Supabase para aplicar RLS y los permisos correspondientes.

El archivo `.env` no debe versionarse.

---

## 📍 HU-026 - Administrar ubicaciones

Implementa el catálogo interno de ubicaciones y su administración.

Incluye:

- Consulta y filtrado de ubicaciones.
- Registro y edición.
- Activación y desactivación lógica.
- Validación de duplicados.
- Restricciones para unidades y traslados activos.
- Permisos para Gerente, Administradora y Vendedor.

Migración:

`supabase/migrations/202610030001_hu026_ubicaciones.sql`

Documentación:

`docs/HU-026.md`

Postman:

`docs/HU-026.postman_collection.json`

---

## 🧾 HU-034 - Registrar compra pendiente de factura

Implementa el registro y consulta de compras pendientes, manteniendo la continuidad posterior con la identificación de unidades.

Migración:

`supabase/migrations/202610040001_hu034_compra_pendiente.sql`

Debe aplicarse después de la migración de HU-026.

Documentación:

`docs/HU-034.md`

Postman:

`docs/HU-034.postman_collection.json`

---

## 🌐 Despliegue

El backend corresponde a una API Node.js/Express.

El despliegue del frontend en Netlify no implica automáticamente el despliegue de la API, por lo que el alojamiento del backend debe configurarse de manera independiente para los ambientes de integración y QA.