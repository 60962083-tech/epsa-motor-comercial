import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { CatalogProvider } from "./store/catalogStore.jsx";

// Punto de entrada. ThemeProvider, AuthProvider y CatalogProvider envuelven
// a App para que cualquier pantalla use useTheme()/useAuth()/useCatalog()
// sin pasar props a mano.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CatalogProvider>
            <App />
          </CatalogProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
