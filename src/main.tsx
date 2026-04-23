// main.tsx – נקודת כניסה של React
// מאתחל QueryClient (TanStack Query), AuthProvider, AppProvider.
// מרנדר את App לתוך #root ב-index.html.
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
