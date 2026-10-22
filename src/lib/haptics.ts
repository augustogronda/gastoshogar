"use client";

export type HapticPreset =
  | "selection"
  | "light"
  | "medium"
  | "heavy"
  | "rigid"
  | "soft"
  | "success"
  | "warning"
  | "error";

export type HapticInput = number | HapticPreset;

let audioCtx: AudioContext | null = null;
let programmaticLabel: HTMLLabelElement | null = null;
let programmaticInput: HTMLInputElement | null = null;
let autoHapticsInitialized = false;

// Asegurar que en iOS el audio funcione incluso si el switch físico de silencio está activo
function initAudioSession(): void {
  try {
    if (typeof navigator !== "undefined" && "audioSession" in navigator) {
      // @ts-expect-error - WebKit AudioSession API
      navigator.audioSession.type = "playback";
    }
  } catch {
    // Silencioso
  }
}

/**
 * Detecta dispositivos táctiles Apple (iPhone, iPad, iPod, o iPads que reportan MacIntel)
 */
export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * Crea e inicializa el switch en viewport para disparos programáticos de respaldo en iOS.
 */
function ensureProgrammaticSwitch(): HTMLLabelElement | null {
  if (typeof document === "undefined" || !document.body) return null;

  if (
    programmaticLabel &&
    document.body.contains(programmaticLabel) &&
    programmaticInput &&
    document.body.contains(programmaticInput)
  ) {
    return programmaticLabel;
  }

  try {
    const labelId = "ios-taptic-switch-label";
    const inputId = "ios-taptic-switch-input";

    const existingLabel = document.getElementById(labelId) as HTMLLabelElement | null;
    const existingInput = document.getElementById(inputId) as HTMLInputElement | null;
    if (existingLabel && existingInput) {
      programmaticLabel = existingLabel;
      programmaticInput = existingInput;
      return existingLabel;
    }

    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.style.cssText =
      "position:fixed;bottom:8px;left:8px;width:20px;height:20px;opacity:0.005;pointer-events:none;z-index:999999;";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.id = inputId;
    input.tabIndex = -1;
    input.style.cssText = "width:20px;height:20px;margin:0;padding:0;border:0;all:initial;appearance:auto;";

    const label = document.createElement("label");
    label.id = labelId;
    label.htmlFor = inputId;
    label.style.cssText = "display:block;width:20px;height:20px;cursor:pointer;";

    container.appendChild(input);
    container.appendChild(label);
    document.body.appendChild(container);

    programmaticLabel = label;
    programmaticInput = input;
    return label;
  } catch {
    return null;
  }
}

// Inicialización temprana tras el primer toque
if (typeof window !== "undefined") {
  const setupOnInteraction = () => {
    initAudioSession();
    ensureProgrammaticSwitch();
  };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    ensureProgrammaticSwitch();
  } else {
    window.addEventListener("DOMContentLoaded", () => ensureProgrammaticSwitch(), { once: true });
  }

  window.addEventListener("pointerdown", setupOnInteraction, { once: true, passive: true });
}

/**
 * Síntesis de respuesta acústica táctil de alta definición.
 * Combina un impulso sub-grave para resonancia física en el chasis del teléfono
 * con un micro-click de banda pasante que emula la respuesta mecánica del Taptic Engine.
 */
function playAudioHapticClick(intensity = 0.5): void {
  try {
    initAudioSession();
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

    const t = audioCtx.currentTime;
    const clampedIntensity = Math.max(0.1, Math.min(1, intensity));

    // 1. Pulso sub-grave (resonancia de chasis)
    const subOsc = audioCtx.createOscillator();
    const subGain = audioCtx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(140, t);
    subOsc.frequency.exponentialRampToValueAtTime(32, t + 0.016);

    const subVol = 0.07 * clampedIntensity;
    subGain.gain.setValueAtTime(subVol, t);
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.016);

    subOsc.connect(subGain);
    subGain.connect(audioCtx.destination);
    subOsc.start(t);
    subOsc.stop(t + 0.016);

    // 2. Micro-click mecánico (Taptic detent)
    const duration = 0.004;
    const sampleRate = audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < channelData.length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.exp(-i / 18);
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(3400, t);
    filter.Q.setValueAtTime(5, t);

    const clickGain = audioCtx.createGain();
    const clickVol = 0.18 * clampedIntensity;
    clickGain.gain.setValueAtTime(clickVol, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter);
    filter.connect(clickGain);
    clickGain.connect(audioCtx.destination);

    source.start(t);
  } catch {
    // Silencioso
  }
}

/**
 * Traduce presets o milisegundos a patrones de vibración para Android
 */
function resolveVibrationPattern(input: HapticInput): number | number[] {
  if (typeof input === "number") {
    return Math.max(10, input);
  }

  switch (input) {
    case "selection":
      return 8;
    case "light":
      return 12;
    case "medium":
      return 18;
    case "heavy":
      return 30;
    case "rigid":
      return 10;
    case "soft":
      return 22;
    case "success":
      return [15, 60, 30];
    case "warning":
      return [30, 80, 25];
    case "error":
      return [40, 40, 40, 40, 40];
    default:
      return 15;
  }
}

/**
 * Resuelve la intensidad de audio (0.1 a 1.0)
 */
function resolveIntensity(input: HapticInput): number {
  if (typeof input === "number") {
    return Math.min(1, Math.max(0.2, input / 25));
  }

  switch (input) {
    case "selection":
      return 0.35;
    case "light":
      return 0.45;
    case "medium":
      return 0.65;
    case "heavy":
      return 0.95;
    case "rigid":
      return 0.75;
    case "soft":
      return 0.4;
    case "success":
      return 0.8;
    case "warning":
      return 0.85;
    case "error":
      return 1.0;
    default:
      return 0.5;
  }
}

/**
 * Dispara feedback háptico general:
 * - En Android: Vibration API nativa con patrones hápticos calibrados.
 * - En iOS / Safari PWA: Disparo de switch físico en iOS + síntesis acústico-táctil.
 *
 * Soporta números (ej: triggerHaptic(10)) para compatibilidad retroactiva,
 * o nombres semánticos ("selection", "light", "medium", "heavy", "success", "error").
 */
export function triggerHaptic(input: HapticInput = 15): void {
  if (typeof window === "undefined") return;

  const isApple = isAppleTouchDevice();

  try {
    // 1. Android / Dispositivos no-Apple con Vibration API nativa
    if (!isApple && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const pattern = resolveVibrationPattern(input);
      navigator.vibrate(pattern);
      return;
    }

    // 2. iOS WebKit: Accionar switch en viewport
    const label = ensureProgrammaticSwitch();
    if (label) {
      label.click();
    } else if (programmaticInput) {
      programmaticInput.click();
    }

    // 3. Audio táctil complementario
    const intensity = resolveIntensity(input);
    playAudioHapticClick(intensity);
  } catch {
    // Silencioso
  }
}

/**
 * Asocia un interruptor de switch nativo invisible sobre un elemento táctil (botón, tarjeta, chip).
 * Cuando el usuario toca con su dedo en iOS (Safari 17.4+ / iOS 18+), WebKit registra un toque nativo
 * directo sobre el switch, disparando con total certeza el Taptic Engine físico de Apple.
 *
 * La navegación táctil (scroll/pan) se respeta completamente: si el dedo se mueve más de 10px,
 * se cancela el switch para no interferir con el desplazamiento de listas.
 */
export function attachHapticTrigger(element: HTMLElement | null): (() => void) | void {
  if (!element || typeof window === "undefined") return;
  if (element.hasAttribute("data-haptic-bound")) return;
  element.setAttribute("data-haptic-bound", "true");

  let cleanupSwitch: (() => void) | null = null;

  if (isAppleTouchDevice()) {
    try {
      const switchInput = document.createElement("input");
      switchInput.type = "checkbox";
      switchInput.setAttribute("switch", "");
      switchInput.setAttribute("data-haptic-trigger", "true");
      switchInput.setAttribute("aria-hidden", "true");
      switchInput.tabIndex = -1;

      Object.assign(switchInput.style, {
        position: "absolute",
        inset: "0",
        width: "100%",
        height: "100%",
        margin: "0",
        padding: "0",
        opacity: "0.001",
        clipPath: "inset(0 round 999px)",
        touchAction: "pan-x pan-y",
        cursor: "pointer",
        zIndex: "0",
      });
      switchInput.style.setProperty("-webkit-tap-highlight-color", "transparent");

      const computedPos = getComputedStyle(element).position;
      if (computedPos === "static") {
        element.style.position = "relative";
      }

      let startY = 0;
      let startX = 0;
      let isScrolling = false;

      const onPointerDown = (e: PointerEvent) => {
        startY = e.clientY;
        startX = e.clientX;
        isScrolling = false;
      };

      const onPointerMove = (e: PointerEvent) => {
        if (Math.hypot(e.clientX - startX, e.clientY - startY) > 10) {
          isScrolling = true;
          switchInput.checked = false;
        }
      };

      const onPointerUp = () => {
        if (isScrolling) {
          switchInput.checked = false;
        }
        isScrolling = false;
      };

      const onPointerCancel = () => {
        isScrolling = false;
        switchInput.checked = false;
      };

      switchInput.addEventListener("pointerdown", onPointerDown, { passive: true });
      switchInput.addEventListener("pointermove", onPointerMove, { passive: true });
      switchInput.addEventListener("pointerup", onPointerUp, { passive: true });
      switchInput.addEventListener("pointercancel", onPointerCancel, { passive: true });

      element.insertAdjacentElement("beforeend", switchInput);

      cleanupSwitch = () => {
        switchInput.removeEventListener("pointerdown", onPointerDown);
        switchInput.removeEventListener("pointermove", onPointerMove);
        switchInput.removeEventListener("pointerup", onPointerUp);
        switchInput.removeEventListener("pointercancel", onPointerCancel);
        switchInput.remove();
      };
    } catch {
      // Silencioso
    }
  }

  return () => {
    element.removeAttribute("data-haptic-bound");
    if (cleanupSwitch) cleanupSwitch();
  };
}

/**
 * Ref callback de React para botones interactivos:
 * <button ref={hapticRef} onClick={...}>
 */
export function hapticRef<T extends HTMLElement>(node: T | null): void {
  if (node) {
    attachHapticTrigger(node);
  }
}

/**
 * Inicializador automático que vincula elementos marcados con data-haptic
 */
export function initAutoHaptics(): () => void {
  if (typeof window === "undefined" || autoHapticsInitialized) return () => {};
  autoHapticsInitialized = true;

  const bindElements = (root: ParentNode = document) => {
    root.querySelectorAll<HTMLElement>("[data-haptic]").forEach((el) => {
      attachHapticTrigger(el);
    });
  };

  bindElements();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            if (node.hasAttribute("data-haptic")) {
              attachHapticTrigger(node);
            }
            bindElements(node);
          }
        });
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return () => {
    observer.disconnect();
    autoHapticsInitialized = false;
  };
}
