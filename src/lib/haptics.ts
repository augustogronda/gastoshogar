"use client";

let audioCtx: AudioContext | null = null;

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

    // Pulso muy corto de baja frecuencia para simular el click háptico de iOS
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

/**
 * Dispara feedback háptico:
 * - En Android: Vibration API nativa (vibrate).
 * - En iOS / Safari PWA: AudioContext tactile click sutil sin tocar el DOM ni bloquear scrolls.
 */
export function triggerHaptic(durationMs = 15): void {
  if (typeof window === "undefined") return;

  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(Math.max(15, durationMs));
      return;
    }

    // iOS WebKit / PWA
    playAudioHapticClick();
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

export function attachHapticTrigger(_element: HTMLElement | null): void {
  // No-op seguro para no alterar el DOM ni interferir con swipes táctiles
}

export function hapticRef<T extends HTMLElement>(_node: T | null): void {
  // No-op
}

export function initAutoHaptics(): void {
  // No-op
}
