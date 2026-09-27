import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavVisibility } from "../context/NavVisibilityContext";
import { UniversalSkeleton } from "../components/UniversalLoader";

export const MessagesScreen: React.FC<{ loading?: boolean }> = ({
  loading = false,
}) => {
  const { onScroll } = useNavVisibility();
  const [messages, setMessages] = useState([
    {
      id: "1",
      sender: "Alex Chen (Host)",
      text: "Welcome to Unit 402! Bills are finalized for Aug-Sep.",
      isMe: false,
    },
    {
      id: "2",
      sender: "Bea Alonzo",
      text: "Hi Alex, I paid ₱2,000 via GCash and uploaded receipt.",
      isMe: true,
    },
    {
      id: "3",
      sender: "Alex Chen (Host)",
      text: "Thanks Bea! Payment approved and balance updated.",
      isMe: false,
    },
  ]);
  const [input, setInput] = useState("");

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <UniversalSkeleton type="messages" />
      </SafeAreaView>
    );
  }

  const send = () => {
    if (!input.trim()) return;
    setMessages([
      ...messages,
      {
        id: Date.now().toString(),
        sender: "Bea Alonzo",
        text: input.trim(),
        isMe: true,
      },
    ]);
    setInput("");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Unit 402 Chat</Text>
        <Text style={styles.subtitle}>7 Active Roommates</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.messageList}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {messages.map((m) => (
          <View
            key={m.id}
            style={[
              styles.msgWrap,
              m.isMe ? styles.msgWrapMe : styles.msgWrapThem,
            ]}
          >
            <Text style={styles.sender}>{m.sender}</Text>
            <View
              style={[
                styles.bubble,
                m.isMe ? styles.bubbleMe : styles.bubbleThem,
              ]}
            >
              <Text style={[styles.bubbleText, m.isMe && { color: "#FFF" }]}>
                {m.text}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Message roommates..."
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={send}>
          <Text style={styles.sendBtnText}>Send</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "#F1F5F9",
  },
  title: { fontSize: 20, fontWeight: "900", color: "#0F172A" },
  subtitle: { fontSize: 11, color: "#64748B", marginTop: 2 },
  messageList: { padding: 20, gap: 12 },
  msgWrap: { maxWidth: "80%" },
  msgWrapMe: { alignSelf: "flex-end", alignItems: "flex-end" },
  msgWrapThem: { alignSelf: "flex-start", alignItems: "flex-start" },
  sender: { fontSize: 10, color: "#94A3B8", marginBottom: 2 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleMe: { backgroundColor: "#2563EB", borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "#F1F5F9", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 13, color: "#0F172A", lineHeight: 18 },
  inputBar: {
    flexDirection: "row",
    padding: 12,
    paddingBottom: 85,
    borderTopWidth: 1,
    borderColor: "#F1F5F9",
    backgroundColor: "#FFFFFF",
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sendBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnText: { color: "#FFF", fontWeight: "bold", fontSize: 12 },
});
