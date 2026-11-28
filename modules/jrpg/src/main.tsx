import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@jforge/look/base.css";
import "@jforge/battle/screen.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
