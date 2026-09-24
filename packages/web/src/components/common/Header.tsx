import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useHousehold } from "../../contexts/HouseholdContext";
import { useNotifications } from "../../contexts/NotificationContext";
import { JoinHouseholdModal } from "./JoinHouseholdModal";
import { CreateRoomModal } from "../CreateRoomModal";
import {
  Bell,
  Check,
  X,
  Shield,
  User,
  LogOut,
  KeyRound,
  Copy,
  Plus,
} from "lucide-react";

export const Header: React.FC<{
  onMenuToggle?: () => void;
  onSignOut?: () => void;
}> = ({ onMenuToggle, onSignOut }) => {
  const { currentUser } = useAuth();
  const { household, members } = useHousehold();
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const isUserHost = Boolean(
    currentUser?.role === "HOST" ||
    currentUser?.hostApplicationStatus === "APPROVED" ||
    (household?.hostId && household.hostId === currentUser?.uid) ||
    members.some(
      (m) =>
        (m.userId === currentUser?.uid ||
          m.memberId === currentUser?.uid ||
          m.memberId === `mem_${currentUser?.uid}`) &&
        m.role === "HOST",
    ),
  );

  const hasGroup = Boolean(
    household?.householdId &&
    household?.householdName &&
    household?.householdName !== "No household connected",
  );

  const displayCode =
    household?.inviteCode ||
    (household?.householdId
      ? `PF-${household.householdId.slice(-4).toUpperCase()}`
      : null);

  const handleCopyCode = () => {
    if (!displayCode) return;
    navigator.clipboard.writeText(displayCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between shadow-xs">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
          aria-label="Toggle Navigation Sidebar"
        >
          <svg
            className="w-5 h-5 sm:w-6 sm:h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white font-black text-base shadow-sm">
            S
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
              PropertyFlow
            </h1>
            <p className="hidden xs:block text-[10px] sm:text-[11px] text-slate-500 font-medium">
              Roommate Bill Management
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Create Group Action */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition cursor-pointer shadow-xs"
          title="Create a new household group"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">Create Group</span>
        </button>

        {/* Household Code or Join Group Action */}
        {hasGroup && displayCode ? (
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 font-mono font-bold text-xs shadow-2xs">
            <KeyRound className="w-3.5 h-3.5 text-blue-600" />
            <span>{displayCode}</span>
            <button
              onClick={handleCopyCode}
              className="ml-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 rounded-md cursor-pointer transition flex items-center gap-0.5"
              title="Copy household invite code"
            >
              <span>{copiedCode ? "Copied" : "Copy"}</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition cursor-pointer shadow-2xs"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Join Group</span>
          </button>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-full transition cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-auto sm:mt-2 w-[calc(100vw-1rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-semibold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.notificationId}
                      className={`p-3.5 hover:bg-slate-50 transition cursor-pointer ${
                        !n.readStatus ? "bg-blue-50/50" : ""
                      }`}
                      onClick={() => markAsRead(n.notificationId)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-xs text-slate-900">
                          {n.title}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(n.createdTimestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {n.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Pill & Action Buttons */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
          {currentUser?.profilePicture || (currentUser as any)?.photoURL ? (
            <img
              src={currentUser.profilePicture || (currentUser as any).photoURL}
              alt={currentUser?.displayName || "User"}
              className="w-9 h-9 rounded-full object-cover ring-2 ring-blue-500/20 shadow-xs"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm ring-2 ring-blue-500/20">
              {currentUser?.displayName?.charAt(0) || "U"}
            </div>
          )}
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-slate-900">
              {currentUser?.displayName || "User"}
            </div>
            <div className="text-[10px] font-medium text-blue-600 uppercase tracking-wide">
              {isUserHost
                ? "HOST / PAYOR"
                : currentUser?.role === "SUPER_ADMIN"
                  ? "SUPER ADMIN"
                  : currentUser?.role === "NON_PAYOR"
                    ? "NON-PAYOR"
                    : "PAYOR"}
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-2">
            {onSignOut && (
              <button
                onClick={onSignOut}
                title="Sign Out"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-200 hover:border-rose-200 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <JoinHouseholdModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </header>
  );
};
