import { Routes, Route } from "react-router-dom";

// --- Capa pública (visitantes) ---
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Modelos from "./pages/Modelos.HU-008";
import ModeloDetalle from "./pages/ModeloDetalle.HU-009";
import Nosotros from "./pages/Nosotros.HU-010";

// --- Capa interna (dashboard) ---
import DashboardLayout from "./components/dashboard/DashboardLayout";
import ProtectedRoute from "./components/dashboard/ProtectedRoute";
import Login from "./pages/dashboard/Login.HU-007";
import Prohibido from "./pages/dashboard/Prohibido.HU-007";
import Resumen from "./pages/dashboard/Resumen";
import Unidades from "./pages/dashboard/Unidades";
import VincularUnidad from "./pages/dashboard/VincularUnidad.HU-002";
import Techo from "./pages/dashboard/Techo.HU-004";
import Ubicaciones from "./pages/dashboard/Ubicaciones.HU-026";
import ModelosAdmin from "./pages/dashboard/ModelosAdmin.HU-012";
import Leads from "./pages/dashboard/Leads.HU-014";

/**
 * App.jsx
 * -----------------------------------------------------------------
 * Aquí viven TODAS las rutas del sitio. Se dividen en dos grupos:
 *
 * 1) Rutas públicas (/, /modelos, /modelos/:id, /nosotros):
 *    comparten el mismo Navbar y Footer de la web para clientes.
 *
 * 2) Rutas /dashboard/*: son privadas. Login y la vista 403 quedan
 *    fuera del layout con menú (no tendría sentido mostrar un menú
 *    de opciones a alguien que todavía no inició sesión). El resto
 *    vive dentro de <DashboardLayout>, que ya se encarga de exigir
 *    sesión iniciada (ver DashboardLayout.jsx). Las pantallas que
 *    solo pueden ver ciertos roles además se envuelven en
 *    <ProtectedRoute seccion="...">.
 * -----------------------------------------------------------------
 */
function SitioPublico() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/modelos" element={<Modelos />} />
          <Route path="/modelos/:id" element={<ModeloDetalle />} />
          <Route path="/nosotros" element={<Nosotros />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      {/* ---------- Dashboard: login y 403 van SIN el layout con menú ---------- */}
      <Route path="/dashboard/login" element={<Login />} />
      <Route path="/dashboard/403" element={<Prohibido />} />

      {/* ---------- Dashboard: todo lo demás va DENTRO del layout ---------- */}
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<Resumen />} />
        <Route path="unidades" element={<Unidades />} />
        <Route path="unidades/:id/vincular" element={<VincularUnidad />} />
        <Route path="unidades/:id/techo" element={<Techo />} />
        <Route path="ubicaciones" element={<ProtectedRoute seccion="ubicaciones"><Ubicaciones /></ProtectedRoute>} />
        <Route path="modelos" element={<ProtectedRoute seccion="modelos"><ModelosAdmin /></ProtectedRoute>} />
        <Route path="leads" element={<Leads />} />
      </Route>

      {/* ---------- Todo lo que no empiece con /dashboard es la web pública ---------- */}
      <Route path="/*" element={<SitioPublico />} />
    </Routes>
  );
}
