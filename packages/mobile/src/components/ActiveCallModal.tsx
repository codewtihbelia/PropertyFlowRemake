import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  Image,
  StatusBar,
  Platform,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import { CallSession, callService, tonePlayer } from "../services/callService";

interface ActiveCallModalProps {
  call: CallSession | null;
  isCaller: boolean;
  onEndCall: (durationSeconds: number) => void;
  currentUserId: string;
}

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  call,
  isCaller,
  onEndCall,
  currentUserId,
}) => {
  const insets = useSafeAreaInsets();
  const [duration, setDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  const [isFrontCamera, setIsFrontCamera] = useState<boolean>(true);
  const [hasRemoteVideo, setHasRemoteVideo] = useState<boolean>(false);

  const localVideoRef = useRef<any>(null);
  const remoteVideoRef = useRef<any>(null);

  // Audio wave visualizer bars for voice calls
  const waveAnim1 = useRef(new Animated.Value(12)).current;
  const waveAnim2 = useRef(new Animated.Value(24)).current;
  const waveAnim3 = useRef(new Animated.Value(18)).current;
  const waveAnim4 = useRef(new Animated.Value(30)).current;

  // Track call duration timer once connected
  useEffect(() => {
    let interval: any = null;
    if (call?.status === "connected") {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [call?.status]);

  // Audio visualizer loop for voice call mode
  useEffect(() => {
    if (call?.callType === "voice" && call.status === "connected") {
      const createWaveLoop = (
        anim: Animated.Value,
        minVal: number,
        maxVal: number,
        speed: number,
      ) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: maxVal,
              duration: speed,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: minVal,
              duration: speed,
              useNativeDriver: false,
            }),
          ]),
        );
      };

      const w1 = createWaveLoop(waveAnim1, 8, 36, 400);
      const w2 = createWaveLoop(waveAnim2, 14, 48, 550);
      const w3 = createWaveLoop(waveAnim3, 10, 40, 480);
      const w4 = createWaveLoop(waveAnim4, 16, 52, 620);

      w1.start();
      w2.start();
      w3.start();
      w4.start();

      return () => {
        w1.stop();
        w2.stop();
        w3.stop();
        w4.stop();
      };
    }
  }, [
    call?.callType,
    call?.status,
    waveAnim1,
    waveAnim2,
    waveAnim3,
    waveAnim4,
  ]);

  // Attach local and remote MediaStreams on Web
  useEffect(() => {
    if (Platform.OS !== "web") return;

    const attachStreams = () => {
      const localStream = callService.getLocalStream();
      if (localVideoRef.current && localStream) {
        try {
          if (localVideoRef.current.srcObject !== localStream) {
            localVideoRef.current.srcObject = localStream;
          }
        } catch (e) {}
      }

      const remoteStream = callService.getRemoteStream();
      if (remoteVideoRef.current && remoteStream) {
        try {
          if (remoteVideoRef.current.srcObject !== remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            setHasRemoteVideo(true);
          }
        } catch (e) {}
      }
    };

    attachStreams();
    const streamCheckTimer = setInterval(attachStreams, 1000);
    return () => clearInterval(streamCheckTimer);
  }, [call?.status, isVideoOff]);

  if (!call || call.status === "ended" || call.status === "declined") {
    return null;
  }

  const isConnected = call.status === "connected";
  const isVideo = call.callType === "video";

  // Peer details (other person in the call)
  const peerName = isCaller ? call.receiverName : call.callerName;
  const peerAvatar = isCaller ? call.receiverAvatar : call.callerAvatar;
  const peerInitials = peerName
    ? peerName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "R";

  // Format seconds into MM:SS
  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainder
      .toString()
      .padStart(2, "0")}`;
  };

  const handleToggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    callService.setMuted(nextMuted);
  };

  const handleToggleVideo = () => {
    const nextVideoOff = !isVideoOff;
    setIsVideoOff(nextVideoOff);
    callService.setVideoEnabled(!nextVideoOff);
  };

  const handleFlipCamera = async () => {
    const isFront = await callService.flipCamera();
    setIsFrontCamera(isFront);
  };

  const handleHangup = () => {
    onEndCall(duration);
  };

  return (
    <Modal visible={true} transparent={false} animationType="fade">
      <StatusBar barStyle="light-content" backgroundColor="#0A0C10" />
      <View
        style={[
          styles.container,
          {
            paddingTop: Math.max(insets.top, 24) + 12,
            paddingBottom: Math.max(insets.bottom, 24) + 16,
          },
        ]}
      >
        {/* Main Remote Video Surface (or Voice Background) */}
        {isVideo ? (
          <View style={StyleSheet.absoluteFill}>
            {/* Native / Web Video element */}
            {Platform.OS === "web" ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "absolute",
                  backgroundColor: "#0A0C10",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: hasRemoteVideo ? "block" : "none",
                  }}
                />
              </div>
            ) : null}

            {/* Backdrop placeholder if remote video is not streaming yet or single user test */}
            {(!hasRemoteVideo || !isConnected) && (
              <View style={styles.videoPlaceholderSurface}>
                <View style={styles.videoPlaceholderGlow} />
                <View style={styles.avatarWrapLarge}>
                  {peerAvatar ? (
                    <Image
                      source={{ uri: peerAvatar }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>
                        {peerInitials}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.videoConnectingText}>
                  {isConnected
                    ? `${peerName}'s camera is starting...`
                    : "Connecting video call..."}
                </Text>
              </View>
            )}

            {/* Gradient Scrims for text contrast */}
            <View style={styles.topScrim} />
            <View style={styles.bottomScrim} />
          </View>
        ) : (
          /* Voice Call Ambient View */
          <View style={styles.voiceBackground}>
            <View style={styles.voiceAmbientHalo} />
            <View style={styles.voiceAvatarCluster}>
              <View style={styles.voiceAvatarWrap}>
                {peerAvatar ? (
                  <Image
                    source={{ uri: peerAvatar }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {peerInitials}
                    </Text>
                  </View>
                )}
              </View>

              {/* Real-time audio waveform animation */}
              {isConnected && (
                <View style={styles.audioWaveContainer}>
                  <Animated.View
                    style={[styles.audioWaveBar, { height: waveAnim1 }]}
                  />
                  <Animated.View
                    style={[styles.audioWaveBar, { height: waveAnim2 }]}
                  />
                  <Animated.View
                    style={[styles.audioWaveBar, { height: waveAnim4 }]}
                  />
                  <Animated.View
                    style={[styles.audioWaveBar, { height: waveAnim3 }]}
                  />
                  <Animated.View
                    style={[styles.audioWaveBar, { height: waveAnim2 }]}
                  />
                  <Animated.View
                    style={[styles.audioWaveBar, { height: waveAnim1 }]}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        {/* Top Header: Peer Name & Call Status / Timer */}
        <View style={styles.topBar}>
          <View style={styles.headerInfo}>
            <Text style={styles.peerNameText} numberOfLines={1}>
              {peerName}
            </Text>
            <View style={styles.statusRow}>
              {isConnected ? (
                <>
                  <View style={styles.connectedDot} />
                  <Text style={styles.timerText}>
                    {formatDuration(duration)}
                  </Text>
                </>
              ) : (
                <Text style={styles.ringingText}>Ringing...</Text>
              )}
            </View>
          </View>
        </View>

        {/* Local Video Picture-in-Picture (Top Right Thumbnail) for Video Calls */}
        {isVideo && (
          <View style={styles.pipContainer}>
            {Platform.OS === "web" ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  borderRadius: 14,
                  overflow: "hidden",
                  backgroundColor: "#1E293B",
                }}
              >
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: isFrontCamera ? "scaleX(-1)" : "none",
                    display: isVideoOff ? "none" : "block",
                  }}
                />
              </div>
            ) : null}

            {isVideoOff && (
              <View style={styles.pipOffState}>
                <Ionicons name="videocam-off" size={20} color="#94A3B8" />
              </View>
            )}

            <View style={styles.pipLabelBadge}>
              <Text style={styles.pipLabelText}>You</Text>
            </View>
          </View>
        )}

        {/* Bottom Floating Control Dock */}
        <View style={styles.bottomDock}>
          <View style={styles.dockSurface}>
            {/* Mute Mic Toggle */}
            <TouchableOpacity
              style={[
                styles.controlBtn,
                isMuted && styles.controlBtnActiveState,
              ]}
              onPress={handleToggleMute}
              activeOpacity={0.8}
              accessibilityLabel="Toggle Microphone"
            >
              <Ionicons
                name={isMuted ? "mic-off" : "mic"}
                size={22}
                color={isMuted ? "#EF4444" : "#F8FAFC"}
              />
            </TouchableOpacity>

            {/* Video Toggle (Only in video mode) */}
            {isVideo && (
              <TouchableOpacity
                style={[
                  styles.controlBtn,
                  isVideoOff && styles.controlBtnActiveState,
                ]}
                onPress={handleToggleVideo}
                activeOpacity={0.8}
                accessibilityLabel="Toggle Camera"
              >
                <Ionicons
                  name={isVideoOff ? "videocam-off" : "videocam"}
                  size={22}
                  color={isVideoOff ? "#EF4444" : "#F8FAFC"}
                />
              </TouchableOpacity>
            )}

            {/* Flip Camera (Only in video mode) */}
            {isVideo && (
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleFlipCamera}
                activeOpacity={0.8}
                accessibilityLabel="Flip Camera"
              >
                <Ionicons name="camera-reverse" size={22} color="#F8FAFC" />
              </TouchableOpacity>
            )}

            {/* End Call / Hangup (Red Button) */}
            <TouchableOpacity
              style={[styles.controlBtn, styles.endCallBtn]}
              onPress={handleHangup}
              activeOpacity={0.8}
              accessibilityLabel="End Call"
            >
              <Ionicons
                name="call"
                size={24}
                color="#FFFFFF"
                style={styles.hangupIcon}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0C10",
    position: "relative",
    justifyContent: "space-between",
  },
  topScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 140,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  bottomScrim: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  videoPlaceholderSurface: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
  },
  videoPlaceholderGlow: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(37, 99, 235, 0.14)",
  },
  avatarWrapLarge: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.15)",
    marginBottom: 20,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: "#60A5FA",
    fontSize: 42,
    fontWeight: "700",
  },
  videoConnectingText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "500",
  },
  voiceBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0B0E14",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceAmbientHalo: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "rgba(37, 99, 235, 0.16)",
  },
  voiceAvatarCluster: {
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  voiceAvatarWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#2563EB",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  audioWaveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 52,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  audioWaveBar: {
    width: 4,
    backgroundColor: "#60A5FA",
    borderRadius: 2,
  },
  topBar: {
    zIndex: 10,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerInfo: {
    gap: 3,
  },
  peerNameText: {
    color: "#F8FAFC",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  timerText: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  ringingText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  pipContainer: {
    position: "absolute",
    top: 70,
    right: 20,
    width: 100,
    height: 145,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "#1E293B",
    zIndex: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  pipOffState: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  pipLabelBadge: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pipLabelText: {
    color: "#F8FAFC",
    fontSize: 10,
    fontWeight: "600",
  },
  bottomDock: {
    zIndex: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  dockSurface: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "rgba(17, 24, 39, 0.88)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    ...Platform.select({
      web: {
        backdropFilter: "blur(20px)",
      } as any,
    }),
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnActiveState: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  endCallBtn: {
    backgroundColor: "#EF4444",
    width: 52,
    height: 52,
    borderRadius: 26,
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  hangupIcon: {
    transform: [{ rotate: "135deg" }],
  },
});
