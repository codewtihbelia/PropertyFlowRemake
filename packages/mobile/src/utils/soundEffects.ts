// High-Fidelity Messenger Pop Chime Sound Synthesizer & Player
// Dual-engine: HTML5 Audio with embedded synthesized WAV + Web Audio API oscillator + Haptic Vibration

import { Vibration, Platform } from "react-native";

let audioCtx: AudioContext | null = null;
let isAudioUnlocked = false;
let cachedDataUri: string | null = null;
let primedAudioEl: HTMLAudioElement | null = null;

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Generates an in-memory 16-bit mono 22050Hz PCM WAV file encoded as Base64 Data URI.
 * Produces a crisp, bright, Facebook Messenger-style upward pop chime (D5 587Hz -> A5 880Hz + harmonic sparkle).
 */
function buildChimeWavDataUri(): string {
  const sampleRate = 22050;
  const duration = 0.28; // 280ms
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt sub-chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, 1, true); // NumChannels (1 = Mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (sampleRate * numChannels * bitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (numChannels * bitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write audio samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (t < 0.065) {
      // Phase 1: Playful ascending pop chirp (587Hz -> 880Hz)
      const freq = 587 + (880 - 587) * (t / 0.065);
      const attackEnv = Math.sin((t / 0.065) * (Math.PI / 2));
      sample = Math.sin(2 * Math.PI * freq * t) * attackEnv;
    } else {
      // Phase 2: Ringing resonance at 880Hz with subtle 1760Hz harmonic overtone
      const ringTime = t - 0.065;
      const decay = Math.exp(-ringTime * 15);
      const fundamental = Math.sin(2 * Math.PI * 880 * t);
      const overtone = 0.3 * Math.sin(2 * Math.PI * 1760 * t);
      sample = (fundamental + overtone) * decay;
    }

    // Scale to 16-bit range with safety headroom
    const intSample = Math.max(
      -32767,
      Math.min(32767, Math.floor(sample * 26000)),
    );
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  // Convert buffer to base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return "data:audio/wav;base64," + window.btoa(binary);
}

function getChimeDataUri(): string | null {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    typeof window.btoa !== "function"
  ) {
    return null;
  }
  if (!cachedDataUri) {
    try {
      cachedDataUri = buildChimeWavDataUri();
    } catch {
      return null;
    }
  }
  return cachedDataUri;
}

function getAudioContext(): AudioContext | null {
  try {
    if (Platform.OS !== "web" || typeof window === "undefined") return null;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === "closed") {
      audioCtx = new AudioContextClass();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Prime and unlock both Web Audio API and HTML5 Audio element on user gesture
 */
export function unlockAudioNow(): void {
  if (isAudioUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    if (Platform.OS === "web" && typeof Audio !== "undefined") {
      const uri = getChimeDataUri();
      if (uri) {
        if (!primedAudioEl) {
          primedAudioEl = new Audio(uri);
        }
        primedAudioEl.volume = 0.01;
        const p = primedAudioEl.play();
        if (p !== undefined) {
          p.then(() => {
            if (primedAudioEl) {
              primedAudioEl.pause();
              primedAudioEl.currentTime = 0;
              primedAudioEl.volume = 0.9;
            }
            isAudioUnlocked = true;
          }).catch(() => {});
        }
      }
    }
  } catch {
    // Ignore errors on non-supported platforms
  }
}

/**
 * Initializes global user gesture listeners to immediately unlock Web Audio and HTML5 Audio
 * on the first touch, click, or tap anywhere in the application.
 */
export function initAudioUnlock(): void {
  try {
    if (
      Platform.OS !== "web" ||
      typeof window === "undefined" ||
      typeof window.addEventListener !== "function" ||
      isAudioUnlocked
    ) {
      return;
    }

    const unlock = () => {
      unlockAudioNow();
      if (typeof window.removeEventListener === "function") {
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("touchstart", unlock);
        window.removeEventListener("click", unlock);
        window.removeEventListener("keydown", unlock);
      }
    };

    window.addEventListener("pointerdown", unlock, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", unlock, {
      once: true,
      passive: true,
    });
    window.addEventListener("click", unlock, { once: true, passive: true });
    window.addEventListener("keydown", unlock, { once: true, passive: true });
  } catch {
    // Graceful fallback
  }
}

/**
 * Plays a pleasant, crisp Messenger-style pop / chime sound.
 * Ascending frequency (587Hz -> 880Hz) with smooth exponential decay.
 * Accompanied by subtle haptic vibration on supported devices.
 */
export function playMessengerPopChime(): void {
  // 1. Trigger haptic feedback
  try {
    if (
      Platform.OS === "web" &&
      typeof navigator !== "undefined" &&
      navigator.vibrate
    ) {
      navigator.vibrate([40, 50, 40]);
    } else {
      Vibration.vibrate(45);
    }
  } catch {
    // Ignore vibration failure
  }

  // 2. HTML5 Audio (Plays reliably across web browsers even for background/Firestore events)
  let htmlAudioPlayed = false;
  try {
    if (Platform.OS === "web" && typeof Audio !== "undefined") {
      const uri = getChimeDataUri();
      if (uri) {
        const audio = new Audio(uri);
        audio.volume = 0.95;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              htmlAudioPlayed = true;
            })
            .catch(() => {
              // If single instance was blocked, try primed element
              if (primedAudioEl) {
                primedAudioEl.currentTime = 0;
                primedAudioEl.volume = 0.95;
                primedAudioEl.play().catch(() => {});
              }
            });
        }
      }
    }
  } catch {
    // Fall back to Web Audio
  }

  // 3. Web Audio Oscillator fallback
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
      if (ctx.state === "running") {
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.08);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.24);
      }
    }
  } catch {
    // Ignore errors
  }
}
