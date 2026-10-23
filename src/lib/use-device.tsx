"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";

export type DeviceType = "mobile" | "ipad" | "desktop";
export type DevicePreference = "auto" | "mobile" | "ipad" | "desktop";

export interface DeviceInfo {
  device: DeviceType;
  preference: DevicePreference;
  detectedDevice: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  setPreference: (pref: DevicePreference) => void;
}

const STORAGE_KEY = "gastoshogar_device_preference";

export function detectDeviceFromBrowser(): DeviceType {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "mobile";
  }

  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const width = window.innerWidth;

  // 1. Detección explícita de iPad / iPadOS
  // Desde iPadOS 13, los iPads se reportan como "Macintosh; Intel Mac OS X",
  // pero maxTouchPoints > 1 (a diferencia de una Mac real de escritorio sin pantalla táctil).
  const isIPadUA = /iPad/i.test(ua);
  const isIPadOS = platform === "MacIntel" && maxTouchPoints > 1;
  const isTabletUA = /Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua);

  if (isIPadUA || isIPadOS || isTabletUA) {
    // Si la pantalla es pequeña (ej. iPad Mini en split vertical muy estrecho), respetar el ancho
    if (width < 640) return "mobile";
    return "ipad";
  }

  // 2. Detección por resolución y capacidades de puntero/touch
  const hasFinePointer = typeof window.matchMedia === "function" 
    ? window.matchMedia("(pointer: fine)").matches 
    : true;
  const isTouchOnly = typeof window.matchMedia === "function"
    ? window.matchMedia("(hover: none) and (pointer: coarse)").matches
    : false;

  // Pantallas de teléfono móvil (menos de 768px o teléfonos reconocidos)
  if (width < 768 || (/Mobi|Android|iPhone|iPod/i.test(ua) && width < 900 && isTouchOnly)) {
    return "mobile";
  }

  // Tablets estándar / iPad de 768px a 1080px o dispositivos touch medianos
  if (width >= 768 && width < 1024) {
    return "ipad";
  }

  // Pantallas amplias (>= 1024px)
  if (width >= 1024) {
    // Si es un tablet grande táctil sin mouse (ej: iPad Pro de 11" o 12.9")
    if ((isIPadUA || isIPadOS || (isTouchOnly && !hasFinePointer)) && width <= 1366) {
      return "ipad";
    }
    // Computadora de escritorio / Laptop PC / Mac con mouse o teclado
    return "desktop";
  }

  return "desktop";
}

const DeviceContext = createContext<DeviceInfo>({
  device: "mobile",
  preference: "auto",
  detectedDevice: "mobile",
  isMobile: true,
  isTablet: false,
  isDesktop: false,
  setPreference: () => {},
});

export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<DevicePreference>(() => {
    if (typeof window === "undefined") return "auto";
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as DevicePreference;
      if (saved && ["auto", "mobile", "ipad", "desktop"].includes(saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage issues
    }
    return "auto";
  });

  const [detectedDevice, setDetectedDevice] = useState<DeviceType>(() => {
    return detectDeviceFromBrowser();
  });

  useEffect(() => {
    const runDetection = () => {
      const detected = detectDeviceFromBrowser();
      setDetectedDevice(detected);
    };

    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(runDetection, 120);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  const setPreference = useCallback((pref: DevicePreference) => {
    setPreferenceState(pref);
    try {
      if (pref === "auto") {
        localStorage.removeItem(STORAGE_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY, pref);
      }
    } catch {
      // Ignore localStorage issues
    }
  }, []);

  // Determinar el dispositivo efectivo
  const effectiveDevice: DeviceType =
    preference !== "auto" ? preference : detectedDevice;

  const value: DeviceInfo = {
    device: effectiveDevice,
    preference,
    detectedDevice,
    isMobile: effectiveDevice === "mobile",
    isTablet: effectiveDevice === "ipad",
    isDesktop: effectiveDevice === "desktop",
    setPreference,
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice(): DeviceInfo {
  return useContext(DeviceContext);
}
