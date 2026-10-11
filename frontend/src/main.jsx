// Punto de entrada: monta la app con sus proveedores
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, MemoryRouter } from "react-router-dom";

const Router = import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : BrowserRouter;
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AppProvider } from "./store/appStore.jsx";
import FiltrosColor from "./components/FiltrosColor.jsx";

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
