import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { ThemeProvider } from "./ThemeContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

/**
 * Punto de entrada de toda la aplicación.
 * El orden de los "Provider" importa: ThemeProvider y AuthProvider
 * envuelven a App para que CUALQUIER pantalla pueda usar
 * useTheme() y useAuth() sin tener que pasarse props a mano.
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>
);
