import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import { CotizarProvider } from "./components/CotizarModal";
import { ToastProvider, ConfirmProvider } from "./components/ui";
import Home from "./pages/Home";
import Modelos from "./pages/Modelos.HU-008";
import ModeloDetalle from "./pages/ModeloDetalle.HU-009";
import Nosotros from "./pages/Nosotros.HU-010";
import Sedes from "./pages/Sedes.HU-010";
import { NotFound, ErrorPorCodigo } from "./pages/Errores";

import DashboardLayout from "./components/dashboard/DashboardLayout";
import ProtectedRoute from "./components/dashboard/ProtectedRoute";
import Prohibido from "./pages/dashboard/Prohibido.HU-007";
import Resumen from "./pages/dashboard/Resumen";
import Leads from "./pages/dashboard/Leads.HU-014";
import Seguimiento from "./pages/dashboard/Seguimiento";
import Ventas from "./pages/dashboard/Ventas";
import Metas from "./pages/dashboard/Metas";
import ModelosAdmin from "./pages/dashboard/ModelosAdmin.HU-012";
import Inventario from "./pages/dashboard/Inventario.HU-004";
import Integracion from "./pages/dashboard/Integracion";
import FichaUnidad from "./pages/dashboard/FichaUnidad.HU-004";
import RegistrarCompra from "./pages/dashboard/RegistrarCompra.HU-034";
import Ubicaciones from "./pages/dashboard/Ubicaciones.HU-026";
import Compras from "./pages/dashboard/Compras.HU-034";
import CompraDetalle from "./pages/dashboard/CompraDetalle.HU-002";
import Equipo from "./pages/dashboard/Equipo";

/**
 * Rutas.
 *  - Web pública: /, /modelos, /modelos/:id, /nosotros, /sedes  (+ /error/:codigo y 404)
 *  - Panel interno: /admin  (el login vive en la misma dirección; no hay botón público para entrar)
 */
function SubirArriba() {
  const { pathname } = useLocation();
  useEffect(() => { try { window.scrollTo(0, 0); } catch { /* */ } }, [pathname]);
  return null;
}

function SitioPublico() {
  return (
    <CotizarProvider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/modelos" element={<Modelos />} />
            <Route path="/modelos/:id" element={<ModeloDetalle />} />
            <Route path="/nosotros" element={<Nosotros />} />
            <Route path="/sedes" element={<Sedes />} />
            <Route path="/error/:codigo" element={<ErrorPorCodigo />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </CotizarProvider>
  );
}

const P = ({ s, children }) => <ProtectedRoute seccion={s}>{children}</ProtectedRoute>;

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmProvider>
          <SubirArriba />
          <Routes>
            <Route path="/admin" element={<DashboardLayout />}>
              <Route index element={<Resumen />} />
              <Route path="leads" element={<P s="leads"><Leads /></P>} />
              <Route path="seguimiento" element={<P s="seguimiento"><Seguimiento /></P>} />
              <Route path="ventas" element={<P s="ventas"><Ventas /></P>} />
              <Route path="metas" element={<P s="metas"><Metas /></P>} />
              <Route path="modelos" element={<P s="modelos"><ModelosAdmin /></P>} />
              <Route path="inventario" element={<P s="inventario"><Inventario /></P>} />
              <Route path="inventario/:id" element={<P s="inventario"><FichaUnidad /></P>} />
              <Route path="ubicaciones" element={<P s="ubicaciones"><Ubicaciones /></P>} />
              <Route path="compras" element={<P s="compras"><Compras /></P>} />
              <Route path="compras/nueva" element={<P s="compras"><RegistrarCompra /></P>} />
              <Route path="compras/:id" element={<P s="compras"><CompraDetalle /></P>} />
              <Route path="equipo" element={<P s="equipo"><Equipo /></P>} />
              <Route path="integracion" element={<P s="integracion"><Integracion /></P>} />
              <Route path="403" element={<Prohibido />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
            <Route path="/dashboard/*" element={<Navigate to="/admin" replace />} />
            <Route path="/*" element={<SitioPublico />} />
          </Routes>
        </ConfirmProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
