import React, { createContext, useContext, useState, useEffect } from "react";
import { Alert, AppState } from "react-native";
import { auth } from "../firebase/config";
import {
  callService,
  CallSession,
  CallType,
  tonePlayer,
} from "../services/callService";
import { mobileDataService } from "../services/firebaseDataService";
import { pushDispatchService } from "../services/pushDispatchService";
import { setupNotificationResponseListener } from "../services/pushNotificationService";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { IncomingCallModal } from "../components/IncomingCallModal";
import { IncomingCallBanner } from "../components/IncomingCallBanner";
import { ActiveCallModal } from "../components/ActiveCallModal";

interface CallContextType {
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  isCaller: boolean;
  isIncomingModalMinimized: boolean;
  setIsIncomingModalMinimized: (minimized: boolean) => void;
  startCall: (
    target: { id: string; name: string; avatar?: string },
    callType: CallType,
  ) => Promise<string | null>;
  acceptCall: (call: CallSession) => Promise<void>;
  declineCall: (call: CallSession) => Promise<void>;
  endCall: (durationSeconds: number) => Promise<void>;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [isIncomingModalMinimized, setIsIncomingModalMinimized] =
    useState<boolean>(false);
  const [isCaller, setIsCaller] = useState<boolean>(false);

  const currentUid = auth.currentUser?.uid || "";
  const currentUserName = auth.currentUser?.displayName || "You";
  const currentUserPhoto = auth.currentUser?.photoURL || undefined;

  // 1. App-wide real-time listener for incoming calls
  useEffect(() => {
    if (!currentUid) return;

    const unsub = callService.subscribeToIncomingCalls(
      currentUid,
      (incoming) => {
        // Do not interrupt if currently in an active call
        if (activeCall && incoming) return;
        if (incoming) {
          setIsIncomingModalMinimized(false);
        }
        setIncomingCall(incoming);
      },
    );

    return () => unsub();
  }, [currentUid, activeCall?.id]);

  // 1c. Immediate check whenever the app returns to foreground or is launched
  useEffect(() => {
    if (!currentUid) return;

    const handleAppStateChange = async (nextAppState: string) => {
      if (nextAppState === "active") {
        try {
          const activeRinging =
            await callService.checkActiveIncomingCall(currentUid);
          if (activeRinging && !activeCall) {
            setIsIncomingModalMinimized(false);
            setIncomingCall(activeRinging);
          }
        } catch (e) {
          console.warn("[CallContext] Foreground check error:", e);
        }
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    handleAppStateChange("active");

    return () => {
      sub.remove();
    };
  }, [currentUid, activeCall?.id]);

  // 1b. Listen for taps on incoming call push notifications when app is launched/backgrounded
  useEffect(() => {
    const unsubNotification = setupNotificationResponseListener(
      async (data) => {
        if (data?.type === "incoming_call" && data?.callId) {
          try {
            const callSnap = await getDoc(doc(db, "calls", data.callId));
            if (callSnap.exists()) {
              const callData = callSnap.data() as CallSession;
              if (callData.status === "ringing") {
                setIncomingCall(callData);
              }
            }
          } catch (e) {
            console.warn(
              "[CallContext] Error handling incoming call push tap:",
              e,
            );
          }
        }
      },
    );

    return () => unsubNotification();
  }, []);

  // 2. Real-time subscription to active call session state
  useEffect(() => {
    if (!activeCall?.id) return;

    const unsub = callService.subscribeToCall(
      activeCall.id,
      isCaller,
      (updatedCall) => {
        if (!updatedCall) {
          // Do not auto-close on transient nulls
          return;
        }

        if (
          updatedCall.status === "declined" ||
          updatedCall.status === "ended"
        ) {
          tonePlayer.stop();
          tonePlayer.playEnded();
          callService.cleanup();
          setActiveCall(null);
        } else {
          if (updatedCall.status === "connected") {
            tonePlayer.stop();
          }
          setActiveCall(updatedCall);
        }
      },
    );

    return () => unsub();
  }, [activeCall?.id, isCaller]);

  // 3. Initiate an outgoing call
  const startCall = async (
    target: { id: string; name: string; avatar?: string },
    callType: CallType,
  ): Promise<string | null> => {
    if (!currentUid) {
      Alert.alert("Sign In Required", "Please sign in to place calls.");
      return null;
    }

    if (!target.id) {
      Alert.alert(
        "Calling Unavailable",
        "1-on-1 calling is available with direct friends or roommates.",
      );
      return null;
    }

    // Audio unlock on user touch gesture
    tonePlayer.resumeAudioContext();
    tonePlayer.playRingback();

    const normalizedTargetId = target.id.replace(/^mem_/, "");
    const normalizedCurrentId = currentUid.replace(/^mem_/, "");
    const callId = `call_${normalizedCurrentId}_${normalizedTargetId}_${Date.now()}`;

    // Establish full-screen active call modal state immediately with the deterministic callId
    setIsCaller(true);
    const initialCallSession: CallSession = {
      id: callId,
      callerId: normalizedCurrentId,
      callerName: currentUserName,
      callerAvatar: currentUserPhoto,
      receiverId: normalizedTargetId,
      receiverName: target.name,
      receiverAvatar: target.avatar,
      callType,
      status: "ringing",
      createdAt: new Date().toISOString(),
      callerCandidates: [],
      receiverCandidates: [],
    };
    setActiveCall(initialCallSession);

    try {
      await callService.initiateCall({
        callId,
        callerId: normalizedCurrentId,
        callerName: currentUserName,
        callerAvatar: currentUserPhoto,
        receiverId: normalizedTargetId,
        receiverName: target.name,
        receiverAvatar: target.avatar,
        callType,
      });

      // Dispatch high-priority push notification to alert the recipient even if app is backgrounded/closed
      pushDispatchService
        .sendIncomingCallPush({
          callId,
          callerId: normalizedCurrentId,
          callerName: currentUserName,
          callerAvatar: currentUserPhoto,
          receiverId: normalizedTargetId,
          callType,
        })
        .catch((pushErr) => {
          console.warn(
            "[CallContext] Notice: Push notification dispatch issue:",
            pushErr,
          );
        });

      return callId;
    } catch (e: any) {
      console.warn("Failed to initiate call:", e);
      tonePlayer.stop();
      callService.cleanup();
      setActiveCall(null);
      Alert.alert(
        "Call Failed",
        "Could not connect to microphone or camera. Please check permissions.",
      );
      return null;
    }
  };

  // 4. Accept incoming call
  const acceptCall = async (call: CallSession): Promise<void> => {
    tonePlayer.resumeAudioContext();
    try {
      await callService.acceptCall(call);
      setIsIncomingModalMinimized(false);
      setIncomingCall(null);
      setIsCaller(false);
      setActiveCall({ ...call, status: "connected" });
    } catch (e) {
      console.warn("Failed to accept call:", e);
      callService.cleanup();
      setIsIncomingModalMinimized(false);
      setActiveCall(null);
      Alert.alert("Call Error", "Could not accept the incoming call.");
    }
  };

  // 5. Decline incoming call
  const declineCall = async (call: CallSession): Promise<void> => {
    tonePlayer.resumeAudioContext();
    try {
      await callService.declineCall(call.id);
      setIsIncomingModalMinimized(false);
      setIncomingCall(null);
    } catch (e) {
      console.warn("Failed to decline call:", e);
      callService.cleanup();
      setIsIncomingModalMinimized(false);
      setIncomingCall(null);
    }
  };

  // 6. End active call
  const endCall = async (durationSeconds: number): Promise<void> => {
    if (!activeCall) return;
    const callSnapshot = activeCall;

    try {
      await callService.endCall(callSnapshot.id, durationSeconds);
    } catch (e) {
      console.warn("Error ending call:", e);
      callService.cleanup();
    }

    // Record call log message in the direct conversation
    try {
      const isVideo = callSnapshot.callType === "video";
      const mins = Math.floor(durationSeconds / 60);
      const secs = durationSeconds % 60;
      const durationStr =
        durationSeconds > 0 ? `${mins > 0 ? `${mins}m ` : ""}${secs}s` : "0s";

      const text =
        durationSeconds > 0
          ? `${isVideo ? "📹 Video" : "📞 Voice"} Call · ${durationStr}`
          : `${isVideo ? "📹 Video" : "📞 Voice"} Call · Ended`;

      const otherUserId =
        callSnapshot.callerId === currentUid
          ? callSnapshot.receiverId
          : callSnapshot.callerId;
      const convId = "dm_" + [currentUid, otherUserId].sort().join("_");

      await mobileDataService.sendDirectMessage({
        conversationId: convId,
        senderId: currentUid,
        senderName: currentUserName,
        recipientId: otherUserId,
        text,
        type: "call_log",
        meta: {
          callType: callSnapshot.callType,
          durationSeconds,
          callStatus: durationSeconds > 0 ? "completed" : "declined",
        },
      });
    } catch (err) {
      console.warn("Failed to post call log:", err);
    }

    callService.cleanup();
    setActiveCall(null);
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        isCaller,
        isIncomingModalMinimized,
        setIsIncomingModalMinimized,
        startCall,
        acceptCall,
        declineCall,
        endCall,
      }}
    >
      {children}

      {/* Persistent floating top banner across all screens when call is ringing */}
      {incomingCall && (
        <IncomingCallBanner
          call={incomingCall}
          onAccept={acceptCall}
          onDecline={declineCall}
          onExpand={() => setIsIncomingModalMinimized(false)}
        />
      )}

      {/* Full-Screen Ringing Modal (shows automatically unless user minimized to top banner) */}
      {!isIncomingModalMinimized && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={acceptCall}
          onDecline={declineCall}
          onMinimize={() => setIsIncomingModalMinimized(true)}
        />
      )}

      <ActiveCallModal
        call={activeCall}
        isCaller={isCaller}
        onEndCall={endCall}
        currentUserId={currentUid}
      />
    </CallContext.Provider>
  );
};

export const useCall = (): CallContextType => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
