"use client";

let hapticLabel: HTMLLabelElement | null = null;

function ensureHapticElements(): HTMLLabelElement | null {
  if (typeof document === "undefined") return null;
  if (hapticLabel && document.body.contains(hapticLabel)) {
    return hapticLabel;
  }

  try {
    const id = "ios-taptic-switch-trigger";
    const existing = document.getElementById(id) as HTMLLabelElement | null;
    if (existing) {
      hapticLabel = existing;
      return existing;
    }

    const label = document.createElement("label");
    label.id = id;
    label.setAttribute("aria-hidden", "true");
    label.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;z-index:-1;";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;

    label.appendChild(input);
    document.body.appendChild(label);
    hapticLabel = label;
    return label;
  } catch {
    return null;
  }
}

/**
 * Dispara feedback háptico nativo:
 * - En iPhone (iOS 17.4+ / iOS 18+): acciona el Taptic Engine físico mediante `<input type="checkbox" switch>`.
 * - En Android: usa `navigator.vibrate`.
 */
export function triggerHaptic(durationMs = 15): void {
  if (typeof window === "undefined") return;

  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(durationMs);
      return;
    }

    const label = ensureHapticElements();
    if (label) {
      label.click();
    }
  } catch {
    // Ignorar silenciosamente si el navegador bloquea la acción
  }
}
