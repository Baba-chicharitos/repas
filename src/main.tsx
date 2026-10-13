import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Repas : erreur d’affichage", error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <div className="loading-screen">
        <h1>Impossible d’afficher cette page.</h1>
        <p>Vos données sauvegardées restent dans ce navigateur.</p>
        <button className="button" onClick={() => location.reload()}>
          Recharger
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
