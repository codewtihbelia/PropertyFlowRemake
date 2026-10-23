import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { Platform } from "react-native";
import { setAudioModeAsync } from "expo-audio";

export type CallType = "voice" | "video";
export type CallStatus =
  | "initiating"
  | "ringing"
  | "connected"
  | "ended"
  | "declined"
  | "missed";

export interface CallSession {
  id: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId: string;
  receiverName: string;
  receiverAvatar?: string;
  callType: CallType;
  status: CallStatus;
  createdAt: string;
  endedAt?: string;
  durationSeconds?: number;
  offer?: any;
  answer?: any;
  callerCandidates?: any[];
  receiverCandidates?: any[];
}

export function serializeCandidate(c: any): any {
  if (!c) return null;
  const rawCand = typeof c === "string" ? c : c.candidate;
  if (!rawCand || typeof rawCand !== "string") return null;

  let sdpMid = c.sdpMid;
  if (sdpMid === undefined || sdpMid === null) {
    sdpMid = "0";
  } else {
    sdpMid = String(sdpMid);
  }

  let sdpMLineIndex = 0;
  if (typeof c.sdpMLineIndex === "number") {
    sdpMLineIndex = c.sdpMLineIndex;
  } else if (c.sdpMLineIndex !== undefined && c.sdpMLineIndex !== null) {
    const parsed = parseInt(c.sdpMLineIndex, 10);
    sdpMLineIndex = isNaN(parsed) ? 0 : parsed;
  }

  return {
    candidate: rawCand,
    sdpMid,
    sdpMLineIndex,
  };
}

// ----------------------------------------------------------------------
// Audio Tone Synthesizer (Web Audio API)
// Produces pure synthesized tones without requiring external audio files
// ----------------------------------------------------------------------
class ToneSynthesizer {
  private ctx: any = null;
  private currentInterval: any = null;

  public getAudioContext(): any {
    if (typeof window === "undefined") return null;
    try {
      const AudioCtx =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx || typeof AudioCtx !== "function") return null;
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioCtx();
      }
      return this.ctx;
    } catch (e) {
      return null;
    }
  }

  // Explicit user-gesture resume to satisfy browser autoplay security
  public resumeAudioContext(): void {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }

  // Ringback tone heard by the caller (modern repeating harmonic cadence: 440Hz + 480Hz + 880Hz soft overtone)
  playRingback() {
    this.stop();
    this.resumeAudioContext();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playPulse = () => {
      try {
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const oscOvertone = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc2.type = "sine";
        oscOvertone.type = "sine";

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);
        oscOvertone.frequency.setValueAtTime(880, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.2, now + 0.08);
        gain.gain.setValueAtTime(0.2, now + 1.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.25);

        osc1.connect(gain);
        osc2.connect(gain);
        oscOvertone.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        oscOvertone.start(now);

        osc1.stop(now + 1.28);
        osc2.stop(now + 1.28);
        oscOvertone.stop(now + 1.28);
      } catch (err) {
        // AudioContext resume catch
      }
    };

    playPulse();
    this.currentInterval = setInterval(playPulse, 2800);
  }

  // Melodic modern digital chime heard by the receiver on incoming call
  playIncomingRing() {
    this.stop();
    this.resumeAudioContext();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playMelody = () => {
      try {
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        // Modern 5-note digital ascending progression (F5, A5, C6, E6, G6)
        const notes = [
          { freq: 698.46, delay: 0 },
          { freq: 880.0, delay: 0.12 },
          { freq: 1046.5, delay: 0.24 },
          { freq: 1318.51, delay: 0.36 },
          { freq: 1567.98, delay: 0.48 },
        ];

        const baseTime = ctx.currentTime;
        notes.forEach(({ freq, delay }) => {
          const oscMain = ctx.createOscillator();
          const oscHarmonic = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = baseTime + delay;

          // Main bell wave
          oscMain.type = "sine";
          oscMain.frequency.setValueAtTime(freq, noteStart);

          // Subtle octave overtone for crisp acoustic sparkle
          oscHarmonic.type = "triangle";
          oscHarmonic.frequency.setValueAtTime(freq * 2, noteStart);

          gain.gain.setValueAtTime(0.0001, noteStart);
          gain.gain.exponentialRampToValueAtTime(0.25, noteStart + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.35);

          oscMain.connect(gain);
          oscHarmonic.connect(gain);
          gain.connect(ctx.destination);

          oscMain.start(noteStart);
          oscHarmonic.start(noteStart);
          oscMain.stop(noteStart + 0.38);
          oscHarmonic.stop(noteStart + 0.38);
        });
      } catch (err) {
        // Handled silently
      }
    };

    playMelody();
    this.currentInterval = setInterval(playMelody, 2400);
  }

  // Modern harmonic chime when call is connected
  playConnected() {
    this.stop();
    this.resumeAudioContext();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [587.33, 880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.1;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.3);
      });
    } catch (e) {}
  }

  // Gentle downward chime when call ends or is declined
  playEnded() {
    this.stop();
    this.resumeAudioContext();
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      [523.25, 392.0, 261.63].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = now + idx * 0.12;

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.28);
      });
    } catch (e) {}
  }

  stop() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
  }
}

export const tonePlayer = new ToneSynthesizer();

// Pre-warm / unlock Web Audio Context on the first user interaction safely
if (
  typeof window !== "undefined" &&
  typeof window.addEventListener === "function"
) {
  const unlockAudio = () => {
    tonePlayer.resumeAudioContext();
    if (typeof window.removeEventListener === "function") {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    }
  };
  try {
    window.addEventListener("click", unlockAudio, {
      once: true,
      passive: true,
    });
    window.addEventListener("touchstart", unlockAudio, {
      once: true,
      passive: true,
    });
  } catch (e) {}
}

// ----------------------------------------------------------------------
// WebRTC Signaling & Connection Manager
// ----------------------------------------------------------------------
// WebRTC Signaling & Connection Manager
export interface UserPresenceResult {
  isOnline: boolean;
  lastActiveAt?: string;
  statusLabel: string;
}

let NativeWebRTCModule: any = null;
try {
  if (Platform.OS !== "web") {
    // Dynamic import to prevent crash if native binary is not yet compiled
    NativeWebRTCModule = require("react-native-webrtc");
  }
} catch (e) {
  // Native module not linked in current APK build
  NativeWebRTCModule = null;
}

export function isNativeWebRTCAvailable(): boolean {
  if (Platform.OS === "web") return true;
  return Boolean(
    NativeWebRTCModule &&
    NativeWebRTCModule.RTCPeerConnection &&
    NativeWebRTCModule.mediaDevices,
  );
}

export function getNativeRTCView(): any {
  return NativeWebRTCModule?.RTCView || null;
}

export function getMediaDevices(): any {
  if (Platform.OS !== "web" && NativeWebRTCModule?.mediaDevices) {
    return NativeWebRTCModule.mediaDevices;
  }
  if (typeof navigator !== "undefined" && navigator?.mediaDevices) {
    return navigator.mediaDevices;
  }
  return null;
}

function getMediaStreamConstructor(): any {
  if (Platform.OS !== "web" && NativeWebRTCModule?.MediaStream) {
    return NativeWebRTCModule.MediaStream;
  }
  if (typeof window !== "undefined") {
    return (
      (window as any).MediaStream || (window as any).webkitMediaStream || null
    );
  }
  return null;
}

const RTC_CONFIG: any = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  iceCandidatePoolSize: 10,
};

function getRTCPeerConnection(): any {
  if (Platform.OS !== "web" && NativeWebRTCModule?.RTCPeerConnection) {
    return NativeWebRTCModule.RTCPeerConnection;
  }
  if (typeof window === "undefined") return null;
  return (
    (window as any).RTCPeerConnection ||
    (window as any).webkitRTCPeerConnection ||
    (window as any).mozRTCPeerConnection ||
    null
  );
}

function getRTCSessionDescription(): any {
  if (Platform.OS !== "web" && NativeWebRTCModule?.RTCSessionDescription) {
    return NativeWebRTCModule.RTCSessionDescription;
  }
  if (typeof window === "undefined") return null;
  return (
    (window as any).RTCSessionDescription ||
    (window as any).webkitRTCSessionDescription ||
    null
  );
}

function getRTCIceCandidate(): any {
  if (Platform.OS !== "web" && NativeWebRTCModule?.RTCIceCandidate) {
    return NativeWebRTCModule.RTCIceCandidate;
  }
  if (typeof window === "undefined") return null;
  return (
    (window as any).RTCIceCandidate ||
    (window as any).webkitRTCIceCandidate ||
    null
  );
}

class CallManager {
  private peerConnection: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private activeCallDocUnsub: (() => void) | null = null;
  private currentCallId: string | null = null;
  private isFrontCamera: boolean = true;
  private processedCandidates = new Set<string>();
  private pendingRemoteCandidates: any[] = [];
  private hasRemoteDescriptionSet: boolean = false;
  private remoteStreamListeners = new Set<(stream: any) => void>();
  private localStreamListeners = new Set<(stream: any) => void>();

  /**
   * Checks whether a contact is currently online or offline.
   * A user is considered online if their last active timestamp is within 5 minutes.
   */
  async checkUserPresence(userId: string): Promise<UserPresenceResult> {
    const cleanUid = userId.replace(/^mem_/, "").trim();
    if (!cleanUid) {
      return { isOnline: false, statusLabel: "Offline" };
    }

    try {
      const snap = await getDoc(doc(db, "users", cleanUid));
      if (snap.exists()) {
        const data = snap.data();
        const lastActive = data?.lastActiveAt || data?.lastActiveDate;
        if (lastActive) {
          const t = new Date(lastActive).getTime();
          if (!isNaN(t)) {
            const diffMs = Date.now() - t;
            // Within 5 minutes is considered actively online
            const isOnline = diffMs >= 0 && diffMs < 5 * 60 * 1000;
            let statusLabel = "Offline";
            if (isOnline) {
              statusLabel = "Active now";
            } else if (diffMs < 60 * 60 * 1000) {
              const mins = Math.max(1, Math.floor(diffMs / 60000));
              statusLabel = `Active ${mins}m ago`;
            } else if (diffMs < 24 * 60 * 60 * 1000) {
              const hrs = Math.max(1, Math.floor(diffMs / 3600000));
              statusLabel = `Active ${hrs}h ago`;
            } else {
              statusLabel = "Offline";
            }
            return { isOnline, lastActiveAt: lastActive, statusLabel };
          }
        }
      }
    } catch (e) {
      console.warn("checkUserPresence error:", e);
    }
    return { isOnline: false, statusLabel: "Offline" };
  }

  // Subscribe to changes on local MediaStream
  onLocalStream(callback: (stream: any) => void): () => void {
    this.localStreamListeners.add(callback);
    if (this.localStream) {
      try {
        callback(this.localStream);
      } catch (e) {}
    }
    return () => {
      this.localStreamListeners.delete(callback);
    };
  }

  private notifyLocalStream(stream: any): void {
    this.localStream = stream;
    this.localStreamListeners.forEach((listener) => {
      try {
        listener(stream);
      } catch (e) {
        console.warn("notifyLocalStream listener error:", e);
      }
    });
  }

  // Subscribe to changes on remote MediaStream
  onRemoteStream(callback: (stream: any) => void): () => void {
    this.remoteStreamListeners.add(callback);
    if (this.remoteStream) {
      try {
        callback(this.remoteStream);
      } catch (e) {}
    }
    return () => {
      this.remoteStreamListeners.delete(callback);
    };
  }

  private notifyRemoteStream(stream: any): void {
    this.remoteStream = stream;
    this.remoteStreamListeners.forEach((listener) => {
      try {
        listener(stream);
      } catch (e) {
        console.warn("notifyRemoteStream listener error:", e);
      }
    });
  }

  // Configure Android/iOS system audio mode for call session (loudspeaker vs earpiece)
  async configureAudioSession(callType: CallType, isSpeaker: boolean = false) {
    if (Platform.OS === "web") return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        interruptionMode: "doNotMix" as any,
        shouldRouteThroughEarpiece: !isSpeaker,
      });
      console.log(
        `[CallManager] Audio routing set: ${isSpeaker ? "Loudspeaker" : "Earpiece"}`,
      );
    } catch (e) {
      console.warn("[CallManager] Audio mode configuration warning:", e);
    }
  }

  // Restore default audio session mode when call terminates
  async resetAudioSession() {
    if (Platform.OS === "web") return;
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        interruptionMode: "mixWithOthers" as any,
        shouldRouteThroughEarpiece: false,
      });
    } catch (e) {
      console.warn("[CallManager] Audio mode reset warning:", e);
    }
  }

  // Initialize or fetch local user media with resilient fallback chain
  async startLocalMedia(callType: CallType): Promise<any> {
    const mediaDevices = getMediaDevices();
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      console.warn(
        "[CallManager] getUserMedia is not supported in this runtime environment.",
      );
      return null;
    }

    // Configure device audio session upfront
    await this.configureAudioSession(callType, callType === "video");

    // Reuse existing live stream if it already satisfies the requested call type
    if (this.localStream) {
      const hasAudio = this.localStream
        .getAudioTracks()
        .some((t: any) => t.readyState === "live" || t.enabled);
      const hasVideo = this.localStream
        .getVideoTracks()
        .some((t: any) => t.readyState === "live" || t.enabled);

      if (hasAudio && (callType !== "video" || hasVideo)) {
        this.notifyLocalStream(this.localStream);
        return this.localStream;
      }
    }

    // VIDEO CALL: Standard multi-tier fallback strategy
    if (callType === "video") {
      // Tier 1: Hardware-native audio + mobile facingMode constraints
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: {
            facingMode: this.isFrontCamera ? "user" : "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        this.notifyLocalStream(stream);
        return stream;
      } catch (e1) {
        console.warn(
          "[CallManager] Tier 1 facingMode constraints failed, trying basic video+audio:",
          e1,
        );
      }

      // Tier 2: Universal basic video + audio
      try {
        const stream = await mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        this.notifyLocalStream(stream);
        return stream;
      } catch (e2) {
        console.warn(
          "[CallManager] Basic video+audio failed, attempting separate track acquisition:",
          e2,
        );
      }

      // Tier 3: Acquire video and audio independently and merge tracks
      let separateVideoTrack: any = null;
      let separateAudioTrack: any = null;

      try {
        const vStream = await mediaDevices.getUserMedia({ video: true });
        separateVideoTrack = vStream.getVideoTracks()[0];
      } catch (ve) {
        console.warn("[CallManager] Separate video acquisition warning:", ve);
      }

      try {
        const aStream = await mediaDevices.getUserMedia({ audio: true });
        separateAudioTrack = aStream.getAudioTracks()[0];
      } catch (ae) {
        console.warn("[CallManager] Separate audio acquisition warning:", ae);
      }

      if (separateVideoTrack || separateAudioTrack) {
        const MediaStreamConstructor = getMediaStreamConstructor();
        if (MediaStreamConstructor) {
          const mergedStream = new MediaStreamConstructor();
          if (separateVideoTrack) mergedStream.addTrack(separateVideoTrack);
          if (separateAudioTrack) mergedStream.addTrack(separateAudioTrack);
          this.notifyLocalStream(mergedStream);
          return mergedStream;
        }
      }
    }

    // VOICE CALL (or audio fallback if camera unavailable)
    try {
      const audioStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.notifyLocalStream(audioStream);
      return audioStream;
    } catch (eAudio) {
      console.error("[CallManager] Voice getUserMedia failed:", eAudio);
      return null;
    }
  }

  // Get current active local stream
  getLocalStream(): any {
    return this.localStream;
  }

  // Get current remote stream
  getRemoteStream(): any {
    return this.remoteStream;
  }

  // Toggle microphone
  setMuted(muted: boolean): boolean {
    if (!this.localStream) return false;
    const audioTracks = this.localStream.getAudioTracks();
    audioTracks.forEach((track: any) => {
      track.enabled = !muted;
    });
    return muted;
  }

  // Toggle camera
  setVideoEnabled(enabled: boolean): boolean {
    if (!this.localStream) return false;
    const videoTracks = this.localStream.getVideoTracks();
    videoTracks.forEach((track: any) => {
      track.enabled = enabled;
    });
    return enabled;
  }

  // Flip camera between front & back safely
  async flipCamera(): Promise<boolean> {
    const targetFacing = !this.isFrontCamera;

    // In react-native-webrtc, video tracks can support direct camera switching
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack && typeof videoTrack._switchCamera === "function") {
        try {
          videoTrack._switchCamera();
          this.isFrontCamera = targetFacing;
          return this.isFrontCamera;
        } catch (e) {
          console.warn(
            "[CallManager] _switchCamera failed, trying getUserMedia re-acquisition:",
            e,
          );
        }
      }
    }

    const mediaDevices = getMediaDevices();
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      this.isFrontCamera = targetFacing;
      return this.isFrontCamera;
    }

    try {
      const newStream = await mediaDevices.getUserMedia({
        video: {
          facingMode: targetFacing
            ? { ideal: "user" }
            : { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        const oldVideoTrack = this.localStream?.getVideoTracks()[0];
        if (oldVideoTrack) {
          oldVideoTrack.stop();
          this.localStream.removeTrack(oldVideoTrack);
        }
        if (this.localStream) {
          this.localStream.addTrack(newTrack);
        }
        this.isFrontCamera = targetFacing;
        this.notifyLocalStream(this.localStream);

        if (this.peerConnection) {
          const sender = this.peerConnection
            .getSenders()
            ?.find((s: any) => s.track?.kind === "video");
          if (sender) {
            sender.replaceTrack(newTrack);
          }
        }
      }
    } catch (e) {
      console.warn("flipCamera error:", e);
    }
    return this.isFrontCamera;
  }

  // Start outgoing call
  async initiateCall(params: {
    callId?: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    receiverId: string;
    receiverName: string;
    receiverAvatar?: string;
    callType: CallType;
  }): Promise<string> {
    const normalizedCallerId = params.callerId.replace(/^mem_/, "");
    const normalizedReceiverId = params.receiverId.replace(/^mem_/, "");
    const callId =
      params.callId ||
      `call_${normalizedCallerId}_${normalizedReceiverId}_${Date.now()}`;
    this.currentCallId = callId;

    // Reset candidate tracking & signaling state
    this.processedCandidates.clear();
    this.pendingRemoteCandidates = [];
    this.hasRemoteDescriptionSet = false;

    // Start ringback tone
    tonePlayer.playRingback();

    // 1. Acquire local media FIRST so offer contains real media tracks
    const stream = await this.startLocalMedia(params.callType);

    const RTCPeer = getRTCPeerConnection();
    let sdpOffer: any = null;
    const initialCandidates: any[] = [];
    let isCallDocSaved = false;

    if (RTCPeer) {
      try {
        const pc = new RTCPeer(RTC_CONFIG);
        this.peerConnection = pc;

        if (stream) {
          if (typeof pc.addStream === "function") {
            try {
              pc.addStream(stream);
            } catch (e) {}
          }
          if (typeof pc.addTrack === "function") {
            try {
              stream.getTracks().forEach((track: any) => {
                pc.addTrack(track, stream);
              });
            } catch (e) {}
          }
        }

        pc.onaddstream = (event: any) => {
          if (event && event.stream) {
            this.notifyRemoteStream(event.stream);
          }
        };

        pc.ontrack = (event: any) => {
          let rStream =
            event.streams && event.streams[0] ? event.streams[0] : null;
          if (!rStream && event.track) {
            const MediaStreamConstructor = getMediaStreamConstructor();
            if (MediaStreamConstructor) {
              if (!this.remoteStream) {
                this.remoteStream = new MediaStreamConstructor();
              }
              this.remoteStream.addTrack(event.track);
              rStream = this.remoteStream;
            }
          }
          if (rStream) {
            this.notifyRemoteStream(rStream);
          }
        };

        pc.onicecandidate = (event: any) => {
          if (event.candidate && this.currentCallId === callId) {
            const cand = serializeCandidate(event.candidate);
            if (cand && cand.candidate) {
              if (!isCallDocSaved) {
                initialCandidates.push(cand);
              } else {
                updateDoc(doc(db, "calls", callId), {
                  callerCandidates: arrayUnion(cand),
                }).catch(() => {});
              }
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log(
            `[CallManager] Caller ICE state: ${pc.iceConnectionState}`,
          );
        };

        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: params.callType === "video",
        });
        await pc.setLocalDescription(offer);
        sdpOffer = {
          type: offer.type,
          sdp: offer.sdp,
        };

        // Brief delay (250ms) to allow initial host and STUN ICE candidates to gather
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.warn("[CallManager] WebRTC offer negotiation error:", err);
      }
    }

    // 2. Persist call document to Firestore WITH offer and initial candidates attached
    const callDoc: CallSession = {
      id: callId,
      callerId: normalizedCallerId,
      callerName: params.callerName,
      callerAvatar: params.callerAvatar,
      receiverId: normalizedReceiverId,
      receiverName: params.receiverName,
      receiverAvatar: params.receiverAvatar,
      callType: params.callType,
      status: "ringing",
      createdAt: new Date().toISOString(),
      offer: sdpOffer,
      callerCandidates: initialCandidates,
      receiverCandidates: [],
    };

    await setDoc(doc(db, "calls", callId), callDoc);
    isCallDocSaved = true;

    return callId;
  }

  // Accept incoming call
  async acceptCall(callSession: CallSession): Promise<void> {
    tonePlayer.stop();
    tonePlayer.playConnected();
    this.currentCallId = callSession.id;

    // Reset candidate tracking & signaling state
    this.processedCandidates.clear();
    this.pendingRemoteCandidates = [];
    this.hasRemoteDescriptionSet = false;

    // 1. Acquire local stream
    const stream = await this.startLocalMedia(callSession.callType);

    // 2. Resolve offer from callSession or fetch from Firestore if missing
    let offer = callSession.offer;
    if (!offer) {
      try {
        const snap = await getDoc(doc(db, "calls", callSession.id));
        if (snap.exists() && snap.data()?.offer) {
          offer = snap.data().offer;
        }
      } catch (e) {
        console.warn("[CallManager] Error re-fetching offer in acceptCall:", e);
      }
    }

    let sdpAnswer: any = null;
    const initialReceiverCandidates: any[] = [];
    let isAnswerSaved = false;

    const RTCPeer = getRTCPeerConnection();
    const RTCSession = getRTCSessionDescription();

    if (RTCPeer && offer && RTCSession) {
      try {
        const pc = new RTCPeer(RTC_CONFIG);
        this.peerConnection = pc;

        if (stream) {
          if (typeof pc.addStream === "function") {
            try {
              pc.addStream(stream);
            } catch (e) {}
          }
          if (typeof pc.addTrack === "function") {
            try {
              stream.getTracks().forEach((track: any) => {
                pc.addTrack(track, stream);
              });
            } catch (e) {}
          }
        }

        pc.onaddstream = (event: any) => {
          if (event && event.stream) {
            this.notifyRemoteStream(event.stream);
          }
        };

        pc.ontrack = (event: any) => {
          let rStream =
            event.streams && event.streams[0] ? event.streams[0] : null;
          if (!rStream && event.track) {
            const MediaStreamConstructor = getMediaStreamConstructor();
            if (MediaStreamConstructor) {
              if (!this.remoteStream) {
                this.remoteStream = new MediaStreamConstructor();
              }
              this.remoteStream.addTrack(event.track);
              rStream = this.remoteStream;
            }
          }
          if (rStream) {
            this.notifyRemoteStream(rStream);
          }
        };

        pc.onicecandidate = (event: any) => {
          if (event.candidate && this.currentCallId === callSession.id) {
            const cand = serializeCandidate(event.candidate);
            if (cand && cand.candidate) {
              if (!isAnswerSaved) {
                initialReceiverCandidates.push(cand);
              } else {
                updateDoc(doc(db, "calls", callSession.id), {
                  receiverCandidates: arrayUnion(cand),
                }).catch(() => {});
              }
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log(
            `[CallManager] Receiver ICE state: ${pc.iceConnectionState}`,
          );
        };

        await pc.setRemoteDescription(new RTCSession(offer));
        this.hasRemoteDescriptionSet = true;

        // Process any caller candidates that were already gathered
        if (callSession.callerCandidates?.length) {
          await this.handleNewCandidates(callSession.callerCandidates);
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sdpAnswer = {
          type: answer.type,
          sdp: answer.sdp,
        };

        // Brief delay (250ms) to allow initial receiver candidates to gather
        await new Promise((r) => setTimeout(r, 250));
      } catch (err) {
        console.warn("[CallManager] WebRTC answer error in acceptCall:", err);
      }
    }

    const updatePayload: any = {
      status: "connected",
      answer: sdpAnswer,
    };
    if (initialReceiverCandidates.length > 0) {
      updatePayload.receiverCandidates = arrayUnion(
        ...initialReceiverCandidates,
      );
    }
    await updateDoc(doc(db, "calls", callSession.id), updatePayload);
    isAnswerSaved = true;
  }

  // Answer received on caller side
  async handleAnswerReceived(answer: any) {
    const RTCSession = getRTCSessionDescription();

    if (
      this.peerConnection &&
      answer &&
      RTCSession &&
      !this.hasRemoteDescriptionSet
    ) {
      try {
        if (this.peerConnection.signalingState === "have-local-offer") {
          await this.peerConnection.setRemoteDescription(
            new RTCSession(answer),
          );
          this.hasRemoteDescriptionSet = true;
          console.log(
            "[CallManager] Remote description (answer) set successfully",
          );

          // Flush any remote candidates received prior to remote description
          if (this.pendingRemoteCandidates.length > 0) {
            const queued = [...this.pendingRemoteCandidates];
            this.pendingRemoteCandidates = [];
            await this.handleNewCandidates(queued);
          }
        }
      } catch (e) {
        console.warn("[CallManager] handleAnswerReceived error:", e);
      }
    }
  }

  // Add received ICE candidates safely
  async handleNewCandidates(candidates: any[]) {
    const RTCIce = getRTCIceCandidate();

    if (
      !candidates ||
      !Array.isArray(candidates) ||
      !RTCIce ||
      !this.peerConnection
    ) {
      return;
    }

    for (const c of candidates) {
      if (!c) continue;
      const candObj = serializeCandidate(c);
      if (!candObj || !candObj.candidate) continue;

      const key = `${candObj.candidate}_${candObj.sdpMid}_${candObj.sdpMLineIndex}`;
      if (this.processedCandidates.has(key)) continue;
      this.processedCandidates.add(key);

      if (!this.hasRemoteDescriptionSet) {
        this.pendingRemoteCandidates.push(candObj);
        continue;
      }

      try {
        await this.peerConnection.addIceCandidate(new RTCIce(candObj));
      } catch (e) {
        console.warn("[CallManager] addIceCandidate error:", e);
      }
    }
  }

  // Synchronize Firestore call state with WebRTC PeerConnection
  async syncSignalingState(callData: CallSession, isCaller: boolean) {
    if (!callData) return;

    if (isCaller) {
      // 1. If caller received an answer from receiver
      if (callData.answer && !this.hasRemoteDescriptionSet) {
        await this.handleAnswerReceived(callData.answer);
      }
      // 2. If caller received ICE candidates from receiver
      if (
        callData.receiverCandidates &&
        callData.receiverCandidates.length > 0
      ) {
        await this.handleNewCandidates(callData.receiverCandidates);
      }
    } else {
      // Receiver side:
      if (
        !this.hasRemoteDescriptionSet &&
        callData.offer &&
        this.peerConnection
      ) {
        const RTCSession = getRTCSessionDescription();
        if (RTCSession && this.peerConnection.signalingState === "stable") {
          try {
            await this.peerConnection.setRemoteDescription(
              new RTCSession(callData.offer),
            );
            this.hasRemoteDescriptionSet = true;
          } catch (e) {}
        }
      }
      if (callData.callerCandidates && callData.callerCandidates.length > 0) {
        await this.handleNewCandidates(callData.callerCandidates);
      }
    }
  }

  // Decline incoming call
  async declineCall(callId: string): Promise<void> {
    tonePlayer.stop();
    tonePlayer.playEnded();
    try {
      await updateDoc(doc(db, "calls", callId), {
        status: "declined",
        endedAt: new Date().toISOString(),
      });
    } catch (e) {}
    this.cleanup();
  }

  // End active call
  async endCall(callId: string, durationSeconds: number = 0): Promise<void> {
    tonePlayer.stop();
    tonePlayer.playEnded();
    try {
      await updateDoc(doc(db, "calls", callId), {
        status: "ended",
        durationSeconds,
        endedAt: new Date().toISOString(),
      });
    } catch (e) {}
    this.cleanup();
  }

  // Clean up streams & peer connection
  cleanup() {
    tonePlayer.stop();
    this.resetAudioSession().catch(() => {});
    if (this.localStream) {
      try {
        this.localStream.getTracks().forEach((track: any) => track.stop());
      } catch (e) {}
      this.localStream = null;
    }
    if (this.remoteStream) {
      try {
        this.remoteStream.getTracks().forEach((track: any) => track.stop());
      } catch (e) {}
      this.remoteStream = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {}
      this.peerConnection = null;
    }
    if (this.activeCallDocUnsub) {
      this.activeCallDocUnsub();
      this.activeCallDocUnsub = null;
    }
    this.processedCandidates.clear();
    this.pendingRemoteCandidates = [];
    this.hasRemoteDescriptionSet = false;
    this.currentCallId = null;
    this.notifyLocalStream(null);
    this.notifyRemoteStream(null);
  }

  // Subscribe to updates for a specific call session
  subscribeToCall(
    callId: string,
    isCaller: boolean,
    onUpdate: (call: CallSession | null) => void,
  ) {
    if (this.activeCallDocUnsub) {
      this.activeCallDocUnsub();
    }
    this.activeCallDocUnsub = onSnapshot(
      doc(db, "calls", callId),
      (snap) => {
        if (!snap.exists()) {
          // Do not close immediately if document is still replicating
          return;
        }
        const data = snap.data() as CallSession;
        // Synchronize WebRTC offer/answer and ICE candidate states automatically
        this.syncSignalingState(data, isCaller).catch((err) => {
          console.warn("syncSignalingState error in subscribeToCall:", err);
        });
        onUpdate(data);
      },
      (err) => {
        console.warn("subscribeToCall error:", err);
      },
    );
    return this.activeCallDocUnsub;
  }

  // Global listener for incoming calls for the current user
  subscribeToIncomingCalls(
    userId: string,
    onIncoming: (call: CallSession | null) => void,
  ) {
    if (!userId) return () => {};

    const normalizedUid = userId.replace(/^mem_/, "");

    // Using single equality filter so NO composite index is required in Firestore
    const q = query(
      collection(db, "calls"),
      where("receiverId", "==", normalizedUid),
    );

    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          onIncoming(null);
          return;
        }

        // Filter and sort active ringing calls in memory to avoid needing composite Firestore indexes
        const now = Date.now();
        const activeRingingCalls = snap.docs
          .map((d) => d.data() as CallSession)
          .filter((c) => {
            if (c.status !== "ringing") return false;
            const ageMs = now - new Date(c.createdAt).getTime();
            return ageMs < 60000;
          })
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

        if (activeRingingCalls.length === 0) {
          onIncoming(null);
          return;
        }

        onIncoming(activeRingingCalls[0]);
      },
      (err) => {
        console.warn("subscribeToIncomingCalls error:", err);
      },
    );
  }
}

export const callService = new CallManager();
