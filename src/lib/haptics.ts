"use client";

let audioCtx: AudioContext | null = null;
let hapticLabel: HTMLLabelElement | null = null;
let hapticInput: HTMLInputElement | null = null;

/**
 * Crea e inicializa el switch nativo para accionar el Taptic Engine de Apple en iOS (17.4+ / 18+).
 * Ubicado fuera del área visual interactiva sin usar pointer-events: none (para que WebKit
 * no descarte el evento sintético dispatchEvent/click).
 */
function ensureHapticElements(): HTMLLabelElement | null {
  if (typeof document === "undefined" || !document.body) return null;

  if (
    hapticLabel &&
    document.body.contains(hapticLabel) &&
    hapticInput &&
    document.body.contains(hapticInput)
  ) {
    return hapticLabel;
  }

  try {
    const labelId = "ios-taptic-switch-label";
    const inputId = "ios-taptic-switch-input";

    const existingLabel = document.getElementById(labelId) as HTMLLabelElement | null;
    const existingInput = document.getElementById(inputId) as HTMLInputElement | null;
    if (existingLabel && existingInput) {
      hapticLabel = existingLabel;
      hapticInput = existingInput;
      return existingLabel;
    }

    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText =
      "position:fixed;bottom:-50px;left:-50px;width:10px;height:10px;opacity:0.01;overflow:hidden;z-index:-9999;";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.id = inputId;
    input.tabIndex = -1;
    input.style.cssText = "width:10px;height:10px;margin:0;padding:0;border:0;";

    const label = document.createElement("label");
    label.id = labelId;
    label.htmlFor = inputId;
    label.style.cssText = "display:inline-block;width:10px;height:10px;";

    container.appendChild(input);
    container.appendChild(label);
    document.body.appendChild(container);

    // Forzar cálculo de layout para registrar RenderThemeIOS
    void container.offsetHeight;

    hapticLabel = label;
    hapticInput = input;
    return label;
  } catch {
    return null;
  }
}

// Pre-inicializar en cuanto el DOM esté disponible
if (typeof window !== "undefined") {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    ensureHapticElements();
  } else {
    window.addEventListener("DOMContentLoaded", () => ensureHapticElements(), { once: true });
  }
  window.addEventListener("pointerdown", () => ensureHapticElements(), { once: true, passive: true });
}

function playAudioHapticClick(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    // Pulso muy corto de baja frecuencia para complementar la respuesta táctil
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, audioCtx.currentTime + 0.015);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.015);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.015);
  } catch {
    // Silencioso
  }
}

export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Dispara feedback háptico:
 * - En Android: Vibration API nativa (navigator.vibrate).
 * - En iOS / Safari PWA: Taptic Engine físico mediante switch nativo + audio click táctil.
 */
export function triggerHaptic(durationMs = 15): void {
  if (typeof window === "undefined") return;

  try {
    // 1. Android / Vibration API estándar
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const effectiveMs = Math.max(15, durationMs);
      navigator.vibrate(effectiveMs);
      return;
    }

    // 2. iOS WebKit / Safari PWA: Taptic Engine físico
    const label = ensureHapticElements();
    if (label) {
      label.click();
    } else if (hapticInput) {
      hapticInput.click();
    }

    // 3. Audio tactile click complementario
    playAudioHapticClick();
  } catch {
    // Silencioso
  }
}

export function attachHapticTrigger(_element: HTMLElement | null): void {
  // No-op seguro para no alterar el DOM de botones ni interferir con scrolls táctiles
}

export function hapticRef<T extends HTMLElement>(_node: T | null): void {
  // No-op
}

export function initAutoHaptics(): void {
  // No-op
}
