import React, { useState } from "react";
import { useHousehold } from "../../contexts/HouseholdContext";
import { useAuth } from "../../contexts/AuthContext";
import { communicationService } from "../../services/communicationService";
import {
  MessageSquare,
  Megaphone,
  Send,
  Plus,
  Users,
  User,
} from "lucide-react";
import { UniversalLoader } from "../../components/common/UniversalLoader";

export const HostCommunication: React.FC = () => {
  const { household, members, loading } = useHousehold();
  const { currentUser } = useAuth();

  if (loading && !household.householdId) {
    return <UniversalLoader variant="skeleton" type="communication" />;
  }

  const [activeTab, setActiveTab] = useState<"CHAT" | "ANNOUNCEMENTS">("CHAT");

  const conversations = communicationService.getConversations(
    household.householdId,
    currentUser.uid,
  );
  const [selectedConvId, setSelectedConvId] = useState<string>(
    conversations[0]?.conversationId || "conv_group",
  );

  const messages = communicationService.getMessages(selectedConvId);
  const [messageInput, setMessageInput] = useState("");

  // Announcement modal state
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annMessage, setAnnMessage] = useState("");
  const [annAudience, setAnnAudience] = useState<
    "EVERYONE" | "PAYORS" | "NON_PAYORS"
  >("EVERYONE");

  const announcements = communicationService.getAnnouncements(
    household.householdId,
  );

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    communicationService.sendMessage(selectedConvId, messageInput.trim());
    setMessageInput("");
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annMessage) return;
    communicationService.createAnnouncement(
      household.householdId,
      annTitle,
      annMessage,
      annAudience,
    );
    setAnnTitle("");
    setAnnMessage("");
    setShowAnnModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Real-Time Household Communications</span>
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
            Messaging & Announcements
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Direct member chat, shared apartment channel, and broadcast notices
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("CHAT")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === "CHAT"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Live Chat
          </button>
          <button
            onClick={() => setActiveTab("ANNOUNCEMENTS")}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
              activeTab === "ANNOUNCEMENTS"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Announcements ({announcements.length})
          </button>
          <button
            onClick={() => setShowAnnModal(true)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Broadcast Notice
          </button>
        </div>
      </div>

      {activeTab === "CHAT" ? (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-3 min-h-[500px]">
          {/* Conversation List */}
          <div className="border-r border-slate-200 p-4 space-y-2 bg-slate-50/50">
            <div className="text-[11px] font-bold text-slate-400 uppercase px-2 mb-2">
              Conversations
            </div>
            {conversations.map((conv) => (
              <button
                key={conv.conversationId}
                onClick={() => setSelectedConvId(conv.conversationId)}
                className={`w-full p-3 rounded-2xl text-left transition flex items-start gap-3 ${
                  selectedConvId === conv.conversationId
                    ? "bg-white shadow-xs border border-slate-200 ring-1 ring-blue-500/20"
                    : "hover:bg-slate-100/60"
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                  {conv.type === "HOUSEHOLD_GROUP" ? (
                    <Users className="w-4 h-4" />
                  ) : (
                    <User className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {conv.type === "HOUSEHOLD_GROUP"
                      ? "Unit 402 Group"
                      : "Direct Message"}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {conv.lastMessage || "No messages"}
                  </p>
                </div>
              </button>
            ))}
          </div>

          {/* Message Thread */}
          <div className="md:col-span-2 flex flex-col justify-between h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-white font-bold text-xs text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {selectedConvId === "conv_group"
                  ? "Skyline Residences Unit 402 Group"
                  : "Direct Roommate Chat"}
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/30">
              {messages.map((m) => {
                const isMe = m.senderId === currentUser.uid;
                return (
                  <div
                    key={m.messageId}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                      {m.senderName}
                    </span>
                    <div
                      className={`max-w-md px-4 py-2.5 rounded-2xl text-xs shadow-2xs ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Input form */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-white border-t border-slate-200 flex gap-2"
            >
              <input
                type="text"
                placeholder="Type a message to roommates..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
              />
              <button
                type="submit"
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Announcements View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {announcements.map((ann) => (
            <div
              key={ann.announcementId}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[10px] rounded-full">
                  Audience: {ann.audience}
                </span>
                <span className="text-[10px] text-slate-400">
                  {new Date(ann.createdDate).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                {ann.title}
              </h3>
              <p className="text-xs text-slate-600">{ann.message}</p>
              <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                Posted by {ann.creatorName}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Broadcast Notice Modal */}
      {showAnnModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">
              Broadcast Household Notice
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Sends immediate push/in-app notification to members
            </p>

            <form
              onSubmit={handleCreateAnnouncement}
              className="mt-4 space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Electricity Meter Inspection Scheduled"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notice Message
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Details of the announcement..."
                  value={annMessage}
                  onChange={(e) => setAnnMessage(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Audience
                </label>
                <select
                  value={annAudience}
                  onChange={(e) => setAnnAudience(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-blue-600"
                >
                  <option value="EVERYONE">Everyone (All 7 Roommates)</option>
                  <option value="PAYORS">Payors Only (4 Roommates)</option>
                  <option value="NON_PAYORS">
                    Non-Payors Only (3 Roommates)
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnnModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs"
                >
                  Publish Announcement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
