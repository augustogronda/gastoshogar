"use client";

import React, { useEffect, useState, useSyncExternalStore, useMemo } from "react";
import { getDashboardData } from "@/app/actions";
import { DashboardClient } from "@/components/DashboardClient";
import { AppSplashScreen } from "@/components/AppSplashScreen";

interface DashboardWrapperProps {
  targetYear?: number;
  targetMonth?: number;
}

const CACHE_KEY = "gastoshogar_cached_dashboard_v2";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot() {
  try {
    return localStorage.getItem(CACHE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot() {
  return null;
}

export function DashboardWrapper({ targetYear, targetMonth }: DashboardWrapperProps) {
  // 1. Obtener caché local del dispositivo de forma instantánea al hidratar (0ms)
  const cachedJson = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const cachedData = useMemo(() => {
    if (!cachedJson) return null;
    try {
      const parsed = JSON.parse(cachedJson);
      // Solo usar el caché si no hay parámetros específicos de año/mes o si coinciden
      if (targetYear && parsed.currentYear !== targetYear) return null;
      if (targetMonth && parsed.currentMonth !== targetMonth) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [cachedJson, targetYear, targetMonth]);

  const [serverData, setServerData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(true);

  // 2. Sincronizar en segundo plano con el servidor sin bloquear la pantalla
  useEffect(() => {
    let isCancelled = false;
    setIsSyncing(true);

    getDashboardData(targetYear, targetMonth)
      .then((fresh) => {
        if (!isCancelled && fresh) {
          setServerData(fresh);
          setIsSyncing(false);
          // Persistir los datos frescos en el teléfono para el próximo arranque instantáneo
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
          } catch (e) {
            console.warn("[Cache] Error guardando caché en dispositivo:", e);
          }
        }
      })
      .catch((err) => {
        console.warn("[Cache] Sincronización en segundo plano falló, usando datos locales:", err);
        if (!isCancelled) {
          setIsSyncing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [targetYear, targetMonth]);

  // Si tenemos datos del servidor, usarlos; de lo contrario, usar los datos cacheados en 0ms
  const activeData = serverData || cachedData;

  // Si no hay datos (ej: primera vez que se abre la app en este celular), mostrar Splash de bienvenida
  if (!activeData) {
    return <AppSplashScreen message="Iniciando tu espacio financiero..." />;
  }

  // Renderizado instantáneo
  return (
    <div className="relative min-h-screen">
      {/* Indicador discreto de sincronización en segundo plano (solo visible si está actualizando datos silenciosamente) */}
      {isSyncing && cachedData && !serverData && (
        <div className="fixed top-2 right-3 z-40 pointer-events-none flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/80 border border-white/10 backdrop-blur-md text-[10px] text-zinc-400 animate-pulse shadow-lg">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
          <span>Sincronizando...</span>
        </div>
      )}
      <DashboardClient initialData={activeData} />
    </div>
  );
}
