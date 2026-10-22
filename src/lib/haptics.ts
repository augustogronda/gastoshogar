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

export function isAppleTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

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
      "position:fixed;bottom:8px;left:8px;width:20px;height:20px;opacity:0.001;pointer-events:none;z-index:999999;";

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

    // Pulso acústico de baja frecuencia para resonancia
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

    // Click mecánico
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

export function triggerHaptic(input: HapticInput = 15): void {
  if (typeof window === "undefined") return;

  const isApple = isAppleTouchDevice();

  try {
    // Android con Vibration API nativa
    if (!isApple && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      const pattern = resolveVibrationPattern(input);
      navigator.vibrate(pattern);
      return;
    }

    // iOS WebKit: intento de disparo de switch
    const label = ensureProgrammaticSwitch();
    if (label) {
      label.click();
    } else if (programmaticInput) {
      programmaticInput.click();
    }

    // Audio táctil complementario
    const intensity = resolveIntensity(input);
    playAudioHapticClick(intensity);
  } catch {
    // Silencioso
  }
}

export function attachHapticTrigger(_element: HTMLElement | null): (() => void) | void {
  // No-op seguro para no alterar el DOM de botones ni bloquear scrolls táctiles
  return () => {};
}

export function hapticRef<T extends HTMLElement>(_node: T | null): void {
  // No-op
}

export function initAutoHaptics(): () => void {
  return () => {};
}
