
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { initializeFirebaseAnalytics } from "./lib/firebase";
  import "./styles/index.css";

  void initializeFirebaseAnalytics();
  createRoot(document.getElementById("root")!).render(<App />);
  