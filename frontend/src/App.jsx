// Rutas de la web pública y del panel
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { MODO_REAL } from "./lib/config";
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
import Facturas from "./pages/dashboard/Facturas";
import FichaUnidad from "./pages/dashboard/FichaUnidad.HU-004";
import RegistrarCompra from "./pages/dashboard/RegistrarCompra.HU-034";
import Ubicaciones from "./pages/dashboard/Ubicaciones.HU-026";
import Compras from "./pages/dashboard/Compras.HU-034";
import CompraDetalle from "./pages/dashboard/CompraDetalle.HU-002";
import Equipo from "./pages/dashboard/Equipo";
import RolesPermisos from "./pages/dashboard/RolesPermisos";
import SeccionPendiente from "./components/dashboard/SeccionPendiente";
import OpinionesAdmin from "./pages/dashboard/Opiniones";
import Disponibilidad from "./pages/dashboard/Disponibilidad.HU-001";
import Movimientos from "./pages/dashboard/Movimientos.HU-003";
import Separaciones from "./pages/dashboard/Separaciones.HU-005";
import Preparacion from "./pages/dashboard/Preparacion.HU-033";
// Sprint 2 conectado a la base central (con la API configurada reemplaza a la vista previa)
import DisponibilidadCentral from "./pages/dashboard/DisponibilidadCentral.HU-001";
import InventarioCentral from "./pages/dashboard/InventarioCentral.HU-004";
import FichaCentral from "./pages/dashboard/FichaCentral.HU-004";
import MovimientosCentral from "./pages/dashboard/MovimientosCentral.HU-003";
import PreparacionCentral from "./pages/dashboard/PreparacionCentral.HU-033";
import FacturasRecibidas from "./pages/dashboard/FacturasRecibidas.HU-030";
import FacturaRecibida from "./pages/dashboard/FacturaRecibida.HU-030";

// Al cambiar de página, vuelve arriba
function SubirArriba() {
  const { pathname } = useLocation();
  useEffect(() => { try { window.scrollTo(0, 0); } catch {} }, [pathname]);
  return null;
}

// Web pública: menú, páginas y pie de página
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

// Ruta del panel protegida por rol
const P = ({ s, children }) => <ProtectedRoute seccion={s}>{children}</ProtectedRoute>;

// Rutas
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
              {/* Seguimiento, ventas, facturas de venta, metas y opiniones aún no tienen su parte en la base:
                  con la base conectada avisan que no están disponibles (sin datos de ejemplo) */}
              <Route path="seguimiento" element={<P s="seguimiento">{MODO_REAL ? <SeccionPendiente titulo="Seguimiento" /> : <Seguimiento />}</P>} />
              <Route path="ventas" element={<P s="ventas">{MODO_REAL ? <SeccionPendiente titulo="Ventas a clientes" /> : <Ventas />}</P>} />
              <Route path="disponibilidad" element={<P s="disponibilidad">{MODO_REAL ? <DisponibilidadCentral /> : <Disponibilidad />}</P>} />
              {/* HU-005 ya no es del Sprint 2: solo en la vista previa */}
              <Route path="separaciones" element={MODO_REAL ? <Navigate to="/admin/disponibilidad" replace /> : <P s="separaciones"><Separaciones /></P>} />
              <Route path="movimientos" element={<P s="movimientos">{MODO_REAL ? <MovimientosCentral /> : <Movimientos />}</P>} />
              <Route path="preparacion" element={<P s="preparacion">{MODO_REAL ? <PreparacionCentral /> : <Preparacion />}</P>} />
              <Route path="metas" element={<P s="metas">{MODO_REAL ? <SeccionPendiente titulo="Metas" /> : <Metas />}</P>} />
              <Route path="modelos" element={<P s="modelos"><ModelosAdmin /></P>} />
              <Route path="inventario" element={<P s="inventario">{MODO_REAL ? <InventarioCentral /> : <Inventario />}</P>} />
              <Route path="inventario/:id" element={<P s="inventario">{MODO_REAL ? <FichaCentral /> : <FichaUnidad />}</P>} />
              <Route path="ubicaciones" element={<P s="ubicaciones"><Ubicaciones /></P>} />
              <Route path="compras" element={<P s="compras"><Compras /></P>} />
              <Route path="compras/nueva" element={<P s="compras"><RegistrarCompra /></P>} />
              <Route path="compras/:id" element={<P s="compras"><CompraDetalle /></P>} />
              <Route path="equipo" element={<P s="equipo"><Equipo /></P>} />
              <Route path="permisos" element={<P s="permisos"><RolesPermisos /></P>} />
              <Route path="facturas" element={<P s="facturas">{MODO_REAL ? <SeccionPendiente titulo="Facturas y clientes" /> : <Facturas />}</P>} />
              <Route path="facturas-recibidas" element={<P s="facturasRecibidas"><FacturasRecibidas /></P>} />
              <Route path="facturas-recibidas/:id" element={<P s="facturasRecibidas"><FacturaRecibida /></P>} />
              <Route path="opiniones" element={<P s="opiniones">{MODO_REAL ? <SeccionPendiente titulo="Opiniones de clientes" texto="Las opiniones se publicarán en la web cuando se guarden en el sistema. Mientras tanto, la web no muestra opiniones." /> : <OpinionesAdmin />}</P>} />
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
