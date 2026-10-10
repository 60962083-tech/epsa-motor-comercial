import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";

// La vista previa dentro de Claude no tiene rutas propias (vive en /artifact/…): ahí se usa un router en memoria.
// En Netlify / local se usa el router normal.
const Router = import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : BrowserRouter;
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AppProvider } from "./store/appStore.jsx";
import FiltrosColor from "./components/FiltrosColor.jsx";

// Punto de entrada. ThemeProvider, AuthProvider y AppProvider envuelven
// a App para que cualquier pantalla use useTheme()/useAuth()/useCatalog()
// sin pasar props a mano.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Router {...(import.meta.env.VITE_ROUTER === "memory" ? { initialEntries: [import.meta.env.VITE_INICIO || "/"] } : {})}>
      <ThemeProvider>
        <AuthProvider>
          <AppProvider>
            <FiltrosColor />
            <App />
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  </StrictMode>
);
