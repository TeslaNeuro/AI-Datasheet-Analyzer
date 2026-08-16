/**
 * AI Datasheet Analyzer
 * Author: Arshia Keshvari (@TeslaNeuro)
 * License: MIT
 *
 * Application entry point — mounts the React tree and installs global
 * error handlers so client failures surface in the Vite terminal during
 * development.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installGlobalErrorHandlers } from "./lib/logError";
import "./styles.css";

installGlobalErrorHandlers();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
