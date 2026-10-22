"use client";

let hapticLabel: HTMLLabelElement | null = null;
let hapticInput: HTMLInputElement | null = null;

function ensureHapticElements(): HTMLLabelElement | null {
  if (typeof document === "undefined" || !document.body) return null;
  if (hapticLabel && document.body.contains(hapticLabel)) {
    return hapticLabel;
  }

  try {
    const id = "ios-taptic-switch-trigger";
    const inputId = "ios-taptic-switch-input";
    const existing = document.getElementById(id) as HTMLLabelElement | null;
    if (existing) {
      hapticLabel = existing;
      hapticInput = document.getElementById(inputId) as HTMLInputElement | null;
      return existing;
    }

    // IMPORTANTE (WebKit iOS 17.4+ / iOS 18+):
    // El input[type="checkbox"][switch] DEBE estar dentro del viewport y con opacity > 0
    // (ej. 0.01) para que el RenderThemeIOS no lo descarte por offscreen culling y accione el Taptic Engine.
    const label = document.createElement("label");
    label.id = id;
    label.htmlFor = inputId;
    label.setAttribute("aria-hidden", "true");
    label.style.cssText =
      "position:fixed;bottom:1px;left:1px;width:2px;height:2px;opacity:0.01;pointer-events:none;overflow:hidden;z-index:99999;user-select:none;-webkit-user-select:none;";

    label.innerHTML = `<input type="checkbox" switch id="${inputId}" tabindex="-1" style="width:2px;height:2px;margin:0;padding:0;border:0;" />`;

    document.body.appendChild(label);
    // Forzar cálculo de layout inmediato para que WebKit instancie RenderSwitch antes del primer click()
    void label.getBoundingClientRect();

    hapticLabel = label;
    hapticInput = document.getElementById(inputId) as HTMLInputElement | null;
    return label;
  } catch {
    return null;
  }
}

// Pre-inicializar el switch en cuanto el DOM esté disponible en el cliente
if (typeof window !== "undefined") {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    ensureHapticElements();
  } else {
    window.addEventListener("DOMContentLoaded", () => ensureHapticElements(), { once: true });
  }
  window.addEventListener("pointerdown", () => ensureHapticElements(), { once: true, passive: true });
}

/**
 * Dispara feedback háptico nativo:
 * - En iPhone (iOS 17.4+ / iOS 18+): acciona el Taptic Engine físico mediante `<input type="checkbox" switch>`.
 * - En Android: usa `navigator.vibrate` con duración mínima perceptible (>= 15ms).
 */
export function triggerHaptic(durationMs = 15): void {
  if (typeof window === "undefined") return;

  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      // En motores de vibración Android, pulsos menores a 12ms suelen no llegar a mover el actuador
      const effectiveMs = Math.max(15, durationMs);
      navigator.vibrate(effectiveMs);
      return;
    }

    const label = ensureHapticElements();
    if (label) {
      label.click();
    } else if (hapticInput) {
      hapticInput.click();
    }
  } catch {
    // Ignorar silenciosamente si el navegador bloquea la acción
  }
}
