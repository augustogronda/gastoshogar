"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Sparkles, RefreshCw, X, ArrowRight, Check } from "./ui/icons";
import currentAppVersion from "../../public/version.json";

export interface VersionInfo {
  version: string;
  build: number | string;
  releasedAt?: string;
  title?: string;
  description?: string;
}

function parseBuildValue(val: number | string | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  const asNum = Number(val);
  if (!Number.isNaN(asNum)) return asNum;
  const asDate = Date.parse(val);
  if (!Number.isNaN(asDate)) return asDate;
  const parsed = parseInt(val, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function AppUpdateChecker() {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const checkVersion = useCallback(async (isManual = false) => {
    try {
      // Usar query param aleatorio y cache: no-store para esquivar cualquier caché de Safari/Chrome
      const res = await fetch(`/api/version?_t=${Date.now()}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      if (!res.ok) return;

      const remote: VersionInfo = await res.json();
      const localBuildStr = localStorage.getItem("app_build");
      const localVersionStr = localStorage.getItem("app_version");

      // Si no hay versión guardada en localStorage, inicializar con la versión actual empaquetada
      if (!localBuildStr && !localVersionStr) {
        localStorage.setItem("app_build", String(currentAppVersion.build));
        localStorage.setItem("app_version", currentAppVersion.version);
      }

      const effectiveLocalVersion = localVersionStr || currentAppVersion.version;
      const effectiveLocalBuildStr = localBuildStr || String(currentAppVersion.build);

      const remoteBuildNum = parseBuildValue(remote.build);
      const localBuildNum = parseBuildValue(effectiveLocalBuildStr);

      const hasNewerVersion =
        remote.version !== effectiveLocalVersion ||
        String(remote.build) !== effectiveLocalBuildStr ||
        remoteBuildNum > localBuildNum;

      if (hasNewerVersion) {
        setUpdateInfo(remote);
        setShowToast(true);
        // Iniciar cuenta regresiva para actualización suave
        setCountdown(5);
      } else if (isManual) {
        alert(`¡La app ya está al día con la última versión (v${remote.version})!`);
      }
    } catch (err) {
      console.warn("No se pudo verificar actualización de versión:", err);
    }
  }, []);

  // Verificar al montar, al volver a la app (visibilitychange/focus) y cada 60s
  useEffect(() => {
    checkVersion();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };

    const handleFocus = () => {
      checkVersion();
    };

    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    const interval = setInterval(() => {
      checkVersion();
    }, 60 * 1000);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, [checkVersion]);

  // Manejo de la cuenta regresiva para recargar
  useEffect(() => {
    if (countdown === null) return;

    if (countdown <= 0) {
      handleApplyUpdate();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const handleApplyUpdate = async () => {
    setIsUpdating(true);
    setCountdown(null);

    try {
      if (updateInfo) {
        localStorage.setItem("app_build", String(updateInfo.build));
        localStorage.setItem("app_version", updateInfo.version);
      }

      // Limpiar cachés de datos en localStorage para hidratar todo fresco
      localStorage.removeItem("gastoshogar_cached_dashboard_v2");
      localStorage.removeItem("gastoshogar_months_cache");

      // Desregistrar Service Workers antiguos si existen
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      // Vaciar cachés del navegador / Service Worker si existen
      if ("caches" in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
      }

      // Recargar con cache-busting para que el navegador descargue el nuevo código
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.set("_v", String(updateInfo?.build || Date.now()));
      window.location.replace(cleanUrl.toString());
    } catch (err) {
      console.error("Error al actualizar la app:", err);
      window.location.reload();
    }
  };

  if (!showToast || !updateInfo) return null;

  return (
    <div className="fixed top-3 left-3 right-3 z-50 max-w-md mx-auto animate-bounce-subtle">
      <div className="super-card rounded-2xl p-4 shadow-2xl border border-indigo-500/40 bg-zinc-950/95 backdrop-blur-xl relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-tight">
                  Nueva versión disponible
                </span>
                <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  v{updateInfo.version}
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-0.5 font-medium line-clamp-1">
                {updateInfo.title || "Mejoras y nuevas funciones"}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setShowToast(false);
              setCountdown(null);
            }}
            className="p-1 rounded-lg text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {updateInfo.description && (
          <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed bg-white/[0.03] p-2 rounded-xl border border-white/[0.05]">
            {updateInfo.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleApplyUpdate}
            disabled={isUpdating}
            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin" : ""}`} />
            <span>
              {isUpdating
                ? "Cargando nueva versión..."
                : countdown !== null
                ? `Actualizar ahora (${countdown}s)`
                : "Actualizar ahora"}
            </span>
          </button>

          <button
            onClick={() => {
              setShowToast(false);
              setCountdown(null);
            }}
            className="py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-medium text-zinc-400 hover:text-zinc-200 transition"
          >
            Más tarde
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Función auxiliar para forzar búsqueda manual de actualización (usada en Menú de Usuario)
 */
export async function forceCheckAppUpdate() {
  try {
    const res = await fetch(`/api/version?_t=${Date.now()}`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
      },
    });
    if (!res.ok) return false;
    const remote: VersionInfo = await res.json();
    const localBuildStr = localStorage.getItem("app_build");
    const localVersionStr = localStorage.getItem("app_version");

    const remoteBuildNum = parseBuildValue(remote.build);
    const localBuildNum = parseBuildValue(localBuildStr);

    const hasNewer =
      remote.version !== localVersionStr ||
      String(remote.build) !== String(localBuildStr) ||
      remoteBuildNum > localBuildNum;

    if (hasNewer) {
      localStorage.setItem("app_build", String(remote.build));
      localStorage.setItem("app_version", remote.version);
      localStorage.removeItem("gastoshogar_cached_dashboard_v2");
      localStorage.removeItem("gastoshogar_months_cache");
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }
      if ("caches" in window) {
        const cacheNames = await window.caches.keys();
        await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
      }
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.set("_v", String(remote.build || Date.now()));
      window.location.replace(cleanUrl.toString());
      return true;
    } else {
      if (
        confirm(
          `La app figura en la versión v${remote.version}. ¿Querés forzar una recarga limpia de caché de todos modos?`
        )
      ) {
        localStorage.removeItem("gastoshogar_cached_dashboard_v2");
        localStorage.removeItem("gastoshogar_months_cache");
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((reg) => reg.unregister()));
        }
        if ("caches" in window) {
          const cacheNames = await window.caches.keys();
          await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
        }
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.set("_v", String(Date.now()));
        window.location.replace(cleanUrl.toString());
        return true;
      }
      return false;
    }
  } catch (err) {
    alert("No se pudo comprobar la versión.");
    return false;
  }
}
