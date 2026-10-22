"use client";

import { hapticTrigger } from "ios-haptics";

/**
 * Detecta si el dispositivo es Apple con pantalla táctil (iPhone, iPad o iPod).
 */
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Acopla un overlay nativo <input type="checkbox" switch> transparente sobre un elemento.
 * En iOS 17.4+ e iOS 18+, cuando el dedo del usuario toca la pantalla sobre este elemento,
 * WebKit acciona directamente el Taptic Engine físico del iPhone.
 */
export function attachHapticTrigger(element: HTMLElement | null): void {
  if (!element || typeof window === "undefined") return;
  if (element.querySelector("[data-haptic-trigger]")) return;

  try {
    // Si el elemento tiene posición estática, asegurar relative para confinar el switch
    const style = window.getComputedStyle(element);
    if (style.position === "static") {
      element.style.position = "relative";
    }

    // Invocar el acoplador nativo de ios-haptics
    hapticTrigger(element);
  } catch {
    // Silencioso en caso de restricciones de DOM
  }
}

/**
 * Hook/Ref compatible con React para acoplar haptics directamente a cualquier botón o nodo JSX.
 * Uso: <button ref={hapticRef}>...</button>
 */
export function hapticRef<T extends HTMLElement>(node: T | null): void {
  if (node) {
    attachHapticTrigger(node);
  }
}

// Selector de elementos interactivos prioritarios
const INTERACTIVE_SELECTOR =
  'button, [role="button"], a[href], [data-haptic], input[type="submit"], input[type="button"]';

/**
 * Escanea y acopla haptics a todos los elementos interactivos del contenedor dado.
 */
function scanAndAttach(root: ParentNode = document): void {
  if (!isAppleTouchDevice()) return;
  try {
    const elements = root.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR);
    for (let i = 0; i < elements.length; i++) {
      attachHapticTrigger(elements[i]);
    }
  } catch {
    // Silencioso
  }
}

/**
 * Inicializador global del sistema háptico para PWA y Safari en iOS:
 * 1. Monitorea adición de nuevos componentes (modales, listados, teclados numéricos).
 * 2. Intercepta cualquier toque en fase de captura para asegurar que el elemento tocado tenga el switch.
 */
export function initAutoHaptics(): void {
  if (typeof window === "undefined" || !isAppleTouchDevice()) return;

  // 1. Escanear elementos iniciales
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scanAndAttach(document), { once: true });
  } else {
    scanAndAttach(document);
  }

  // 2. Interceptar toque en fase de captura por si se toca un elemento recién renderizado
  window.addEventListener(
    "pointerdown",
    (e) => {
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(INTERACTIVE_SELECTOR);
      if (target && !target.querySelector("[data-haptic-trigger]")) {
        attachHapticTrigger(target);
      }
    },
    { capture: true, passive: true }
  );

  // 3. MutationObserver para nuevos modales, componentes y teclados
  try {
    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation.type === "childList") {
          for (let j = 0; j < mutation.addedNodes.length; j++) {
            const node = mutation.addedNodes[j];
            if (node.nodeType === Node.ELEMENT_NODE) {
              const el = node as HTMLElement;
              if (el.matches?.(INTERACTIVE_SELECTOR)) {
                attachHapticTrigger(el);
              }
              scanAndAttach(el);
            }
          }
        }
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  } catch {
    // Silencioso si el entorno no soporta observer
  }
}

// Auto-inicializar en cuanto el archivo se cargue en el cliente
if (typeof window !== "undefined") {
  initAutoHaptics();
}

let globalProgrammaticSwitch: HTMLInputElement | null = null;

function ensureProgrammaticSwitch(): HTMLInputElement | null {
  if (typeof document === "undefined" || !document.body) return null;
  if (globalProgrammaticSwitch && document.body.contains(globalProgrammaticSwitch)) {
    return globalProgrammaticSwitch;
  }

  try {
    const id = "ios-global-programmatic-switch";
    const existing = document.getElementById(id) as HTMLInputElement | null;
    if (existing) {
      globalProgrammaticSwitch = existing;
      return existing;
    }

    const input = document.createElement("input");
    input.id = id;
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.setAttribute("aria-hidden", "true");
    input.tabIndex = -1;
    input.style.cssText =
      "position:fixed;bottom:2px;right:2px;width:32px;height:20px;opacity:0.01;pointer-events:auto;z-index:999999;margin:0;padding:0;clip-path:inset(0 round 999px);";

    document.body.appendChild(input);
    globalProgrammaticSwitch = input;
    return input;
  } catch {
    return null;
  }
}

/**
 * Dispara feedback háptico programático:
 * - En Android: ejecuta navigator.vibrate(durationMs).
 * - En iOS / Safari / PWA: acciona el switch nativo o conmuta el trigger físico.
 */
export function triggerHaptic(durationMs = 15): void {
  if (typeof window === "undefined") return;

  try {
    // Android / Navegadores con soporte de Vibration API
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const effectiveMs = Math.max(15, durationMs);
      navigator.vibrate(effectiveMs);
      return;
    }

    // iOS WebKit / PWA
    if (isAppleTouchDevice()) {
      const sw = ensureProgrammaticSwitch();
      if (sw) {
        sw.checked = !sw.checked;
        sw.click();
      }
    }
  } catch {
    // Silencioso
  }
}
