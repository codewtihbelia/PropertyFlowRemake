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
export interface UserPresenceResult {
  isOnline: boolean;
  lastActiveAt?: string;
  statusLabel: string;
}

// ----------------------------------------------------------------------
// WebRTC Signaling & Connection Manager
// ----------------------------------------------------------------------
const RTC_CONFIG: any = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

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

  // Initialize or fetch local user media
  async startLocalMedia(callType: CallType): Promise<any> {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      return null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video:
          callType === "video"
            ? {
                facingMode: this.isFrontCamera ? "user" : "environment",
                width: { ideal: 640 },
                height: { ideal: 480 },
              }
            : false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      return stream;
    } catch (err) {
      console.warn("Failed to get UserMedia:", err);
      // Fallback: If video failed or permission denied, try audio only
      if (callType === "video") {
        try {
          const audioOnly = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          this.localStream = audioOnly;
          return audioOnly;
        } catch (e) {
          console.warn("Audio only UserMedia also failed:", e);
        }
      }
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

  // Flip camera between front & back
  async flipCamera(): Promise<boolean> {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator?.mediaDevices?.getUserMedia
    ) {
      return false;
    }
    this.isFrontCamera = !this.isFrontCamera;
    if (!this.localStream) return this.isFrontCamera;

    const oldVideoTrack = this.localStream.getVideoTracks()[0];
    if (oldVideoTrack) {
      oldVideoTrack.stop();
      this.localStream.removeTrack(oldVideoTrack);
    }

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.isFrontCamera ? "user" : "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (newTrack) {
        this.localStream.addTrack(newTrack);
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

    // Immediately create and persist the call document in Firestore so receiver listener triggers right away
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
      callerCandidates: [],
      receiverCandidates: [],
    };

    await setDoc(doc(db, "calls", callId), callDoc);

    // Start ringback tone
    tonePlayer.playRingback();

    // Acquire local media & negotiate WebRTC offer in the background
    this.startLocalMedia(params.callType)
      .then(async (stream) => {
        const RTCPeer =
          typeof window !== "undefined" &&
          typeof (window as any).RTCPeerConnection === "function"
            ? (window as any).RTCPeerConnection
            : null;

        if (RTCPeer && stream && this.currentCallId === callId) {
          try {
            const pc = new RTCPeer(RTC_CONFIG);
            this.peerConnection = pc;

            stream.getTracks().forEach((track: any) => {
              pc.addTrack(track, stream);
            });

            pc.ontrack = (event: any) => {
              if (event.streams && event.streams[0]) {
                this.notifyRemoteStream(event.streams[0]);
              }
            };

            pc.onicecandidate = (event: any) => {
              if (event.candidate && this.currentCallId === callId) {
                updateDoc(doc(db, "calls", callId), {
                  callerCandidates: arrayUnion(event.candidate.toJSON()),
                }).catch(() => {});
              }
            };

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            const sdpOffer = {
              type: offer.type,
              sdp: offer.sdp,
            };

            await updateDoc(doc(db, "calls", callId), {
              offer: sdpOffer,
            });
          } catch (err) {
            console.warn("WebRTC offer negotiation error:", err);
          }
        }
      })
      .catch((e) => {
        console.warn("startLocalMedia error in initiateCall:", e);
      });

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

    await this.startLocalMedia(callSession.callType);

    let sdpAnswer: any = null;
    const RTCPeer =
      typeof window !== "undefined" &&
      typeof (window as any).RTCPeerConnection === "function"
        ? (window as any).RTCPeerConnection
        : null;

    if (RTCPeer && callSession.offer) {
      try {
        const pc = new RTCPeer(RTC_CONFIG);
        this.peerConnection = pc;

        if (this.localStream) {
          this.localStream.getTracks().forEach((track: any) => {
            pc.addTrack(track, this.localStream);
          });
        }

        pc.ontrack = (event: any) => {
          if (event.streams && event.streams[0]) {
            this.notifyRemoteStream(event.streams[0]);
          }
        };

        pc.onicecandidate = (event: any) => {
          if (event.candidate && this.currentCallId === callSession.id) {
            updateDoc(doc(db, "calls", callSession.id), {
              receiverCandidates: arrayUnion(event.candidate.toJSON()),
            }).catch(() => {});
          }
        };

        const RTCSession =
          typeof window !== "undefined" &&
          typeof (window as any).RTCSessionDescription === "function"
            ? (window as any).RTCSessionDescription
            : null;

        if (RTCSession) {
          await pc.setRemoteDescription(new RTCSession(callSession.offer));
          this.hasRemoteDescriptionSet = true;

          // Add any pending caller candidates
          if (callSession.callerCandidates?.length) {
            await this.handleNewCandidates(callSession.callerCandidates);
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sdpAnswer = {
            type: answer.type,
            sdp: answer.sdp,
          };
        }
      } catch (err) {
        console.warn("WebRTC answer error:", err);
      }
    }

    await updateDoc(doc(db, "calls", callSession.id), {
      status: "connected",
      answer: sdpAnswer,
    });
  }

  // Answer received on caller side
  async handleAnswerReceived(answer: any) {
    const RTCSession =
      typeof window !== "undefined" &&
      typeof (window as any).RTCSessionDescription === "function"
        ? (window as any).RTCSessionDescription
        : null;

    if (
      this.peerConnection &&
      answer &&
      RTCSession &&
      !this.hasRemoteDescriptionSet
    ) {
      try {
        if (this.peerConnection.signalingState !== "stable") {
          await this.peerConnection.setRemoteDescription(
            new RTCSession(answer),
          );
          this.hasRemoteDescriptionSet = true;

          // Flush any remote candidates received prior to remote description
          if (this.pendingRemoteCandidates.length > 0) {
            const queued = [...this.pendingRemoteCandidates];
            this.pendingRemoteCandidates = [];
            await this.handleNewCandidates(queued);
          }
        }
      } catch (e) {
        console.warn("handleAnswerReceived error:", e);
      }
    }
  }

  // Add received ICE candidates safely
  async handleNewCandidates(candidates: any[]) {
    const RTCIce =
      typeof window !== "undefined" &&
      typeof (window as any).RTCIceCandidate === "function"
        ? (window as any).RTCIceCandidate
        : null;

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
      const key = typeof c === "string" ? c : c.candidate || JSON.stringify(c);
      if (this.processedCandidates.has(key)) continue;
      this.processedCandidates.add(key);

      if (!this.hasRemoteDescriptionSet) {
        this.pendingRemoteCandidates.push(c);
        continue;
      }

      try {
        await this.peerConnection.addIceCandidate(new RTCIce(c));
      } catch (e) {
        console.warn("addIceCandidate error:", e);
      }
    }
  }

  // Synchronize Firestore call state with WebRTC PeerConnection
  async syncSignalingState(callData: CallSession, isCaller: boolean) {
    if (!this.peerConnection || !callData) return;

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
      // Receiver side: if caller sends additional ICE candidates
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
