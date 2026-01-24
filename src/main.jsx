import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { useAuthStore } from "./store/useAuthStore";
import "./styles/theme.css";
import SplashScreen from "./components/layout/SplashScreen";

const MIN_SPLASH_MS = 4000;

const InitAuth = () => {
  const initAuth = useAuthStore((s) => s.initAuth);
  const firebaseInitialized = useAuthStore((s) => s.firebaseInitialized);

  const [minTimeDone, setMinTimeDone] = React.useState(false);

  React.useEffect(() => {
    // Start Firebase auth listener
    // This will check indexedDBLocalPersistence and rehydrate the session
    const unsubscribe = initAuth();
    
    // Minimum splash duration
    const minTimer = setTimeout(() => setMinTimeDone(true), MIN_SPLASH_MS);
    
    return () => {
      unsubscribe();
      clearTimeout(minTimer);
    };
  }, [initAuth]);

  // Show splash until:
  // 1. Minimum time has elapsed AND
  // 2. Firebase has finished checking the persisted auth state
  if (!minTimeDone || !firebaseInitialized) {
    return <SplashScreen />;
  }

  return <App />;
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <InitAuth />
  </React.StrictMode>
);
