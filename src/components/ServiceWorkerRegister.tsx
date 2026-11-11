"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            // Forzar búsqueda inmediata de actualización del Service Worker en el servidor
            registration.update().catch(() => {});

            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
                    console.log("[SW] Nueva versión de la app instalada en caché. Aplicando inmediatamente...");
                    // Enviar skipWaiting o recargar de inmediato para tomar la nueva versión
                    installingWorker.postMessage({ type: "SKIP_WAITING" });
                    window.location.reload();
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.warn("[SW] No se pudo registrar Service Worker:", error);
          });
      };

      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register);
        return () => window.removeEventListener("load", register);
      }
    }
  }, []);

  return null;
}
