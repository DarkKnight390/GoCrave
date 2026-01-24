import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { useAuthStore } from "./store/useAuthStore";
import "./styles/theme.css";
import SplashScreen from "./components/layout/SplashScreen";

const MIN_SPLASH_MS = 1200;

const InitAuth = () => {
  const initAuth = useAuthStore((s) => s.initAuth);
  const loading = useAuthStore((s) => s.loading);

  const [minTimeDone, setMinTimeDone] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = initAuth();
    const t = setTimeout(() => setMinTimeDone(true), MIN_SPLASH_MS);
    return () => {
      unsubscribe();
      clearTimeout(t);
    };
  }, [initAuth]);

  const showSplash = loading || !minTimeDone;

  if (showSplash) return <SplashScreen />;

  return <App />;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InitAuth />
  </React.StrictMode>
);
