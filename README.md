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

Las rutas de usuarios usan la clave pública `SUPABASE_ANON_KEY` y transmiten el token del usuario para aplicar RLS y los permisos correspondientes. La integración servidor a servidor HU-030 usa `SUPABASE_SECRET_KEY`, una clave privilegiada equivalente a `service_role` que omite RLS. Se limita al backend y a las RPC técnicas de HU-030 desde nuestro código; no es una credencial de mínimo privilegio. Nunca debe llegar al navegador, Apps Script, Git, logs o respuestas HTTP. El actor `integracion.facturas@epsa.internal` se usa solo para auditoría y no inicia sesión.

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

## 🏍️ HU-002 - Completar identificación de motos compradas

Implementa la identificación individual de las motos pertenecientes a una compra previamente registrada.

Incluye:

- Registro de metadatos de la factura recibida.
- Identificación de unidades por lotes.
- Registro único de número de motor y chasis.
- Validación de modelo y color respecto a la compra original.
- Identificación parcial de una compra.
- Cálculo de unidades identificadas y pendientes.
- Prevención de unidades adicionales a la cantidad comprada.
- Detección de motor o chasis duplicado.
- Protección ante operaciones concurrentes.
- Permisos para Gerente y Administradora.
- Estado `Pendiente de identificación` para compras parcialmente identificadas.
- Identificación independiente de la recepción física, ubicación y disponibilidad de la unidad.

Migración:

`supabase/migrations/202610060001_hu002_identificacion_unidades.sql`

Debe aplicarse después de las migraciones de HU-026 y HU-034.

Documentación:

`docs/HU-002.md`

Postman:

`docs/HU-002.postman_collection.json`

La factura registrada funciona como fuente de información para validar la cantidad de motos de la compra.

La carga física del archivo de factura todavía requiere definir un mecanismo de almacenamiento privado y no forma parte de la implementación actual.

---

## 🌐 Despliegue

El backend corresponde a una API Node.js/Express.

El despliegue del frontend en Netlify no despliega automáticamente este backend. El equipo confirmó que Render aloja el backend y despliega la rama `develop`; su commit y variables vigentes deben revisarse en Render al preparar una integración.
