// Pantalla de error si algo falla
import { Component } from "react";
import { Link, useLocation } from "react-router-dom";
import { PantallaError } from "../pages/Errores";

class Interno extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[ErrorBoundary]", error?.message, error?.stack, info?.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <PantallaError codigo="500" titulo="Algo salió mal" texto="La pantalla tuvo un problema inesperado. Puedes volver al inicio sin perder nada.">
        <Link to="/" className="btn btn-primary" onClick={() => this.setState({ error: null })}>Ir al inicio</Link>
      </PantallaError>
    );
  }
}

export default function ErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <Interno key={pathname}>{children}</Interno>;
}
