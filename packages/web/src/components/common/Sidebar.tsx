import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useHousehold } from "../../contexts/HouseholdContext";
import { useTheme } from "../../contexts/ThemeContext";
import { JoinHouseholdModal } from "./JoinHouseholdModal";
import { CreateRoomModal } from "../CreateRoomModal";
import {
  LayoutDashboard,
  Users,
  Receipt,
  CreditCard,
  Droplets,
  Zap,
  MessageSquare,
  Megaphone,
  BarChart3,
  History,
  Settings,
  Shield,
  Layers,
  HelpCircle,
  Smartphone,
  ArrowLeftRight,
  ShieldCheck,
  Building2,
  Plus,
  KeyRound,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
}) => {
  const { isHost, isSuperAdmin, isPayor, isNonPayor, role, currentUser } =
    useAuth();
  const { household, members } = useHousehold();
  const { isDark, toggleTheme, cycleTheme, themeMode, setThemeMode } =
    useTheme();
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const hasGroup = Boolean(
    household.householdId &&
    household.householdName &&
    household.householdName !== "No household connected",
  );

  const isUserHost = Boolean(
    isHost ||
    currentUser.role === "HOST" ||
    currentUser.hostApplicationStatus === "APPROVED" ||
    (household.hostId && household.hostId === currentUser.uid) ||
    members.some(
      (m) =>
        (m.userId === currentUser.uid ||
          m.memberId === currentUser.uid ||
          m.memberId === `mem_${currentUser.uid}`) &&
        m.role === "HOST",
    ),
  );

  const getNavItems = () => {
    if (isSuperAdmin) {
      return [
        {
          id: "admin_dashboard",
          label: "Platform Dashboard",
          icon: LayoutDashboard,
        },
        {
          id: "admin_host_applications",
          label: "Host Applications",
          icon: ShieldCheck,
        },
        { id: "admin_households", label: "Households", icon: Layers },
        { id: "admin_users", label: "User Directory", icon: Users },
        {
          id: "admin_versions",
          label: "App Version Control",
          icon: Smartphone,
        },
        { id: "admin_support", label: "Support Tickets", icon: HelpCircle },
        { id: "admin_logs", label: "Audit Logs", icon: History },
      ];
    }

    if (isUserHost) {
      return [
        { id: "host_dashboard", label: "Dashboard", icon: LayoutDashboard },
        {
          id: "host_household",
          label: hasGroup ? "Manage Group" : "Create Group",
          icon: hasGroup ? Users : Plus,
        },
        { id: "host_billing", label: "Billing Cycles & Rates", icon: Receipt },
        { id: "host_attendance", label: "Water Attendance", icon: Droplets },
        {
          id: "host_payments",
          label: "Payment Verifications",
          icon: CreditCard,
        },
        {
          id: "host_redistribution",
          label: "Balance Redistribution",
          icon: ArrowLeftRight,
        },
        { id: "host_messages", label: "Messages & Chat", icon: MessageSquare },
        { id: "host_announcements", label: "Announcements", icon: Megaphone },
        { id: "host_reports", label: "Financial Reports", icon: BarChart3 },
        { id: "host_logs", label: "Activity Logs", icon: History },
        { id: "host_settings", label: "Household Settings", icon: Settings },
      ];
    }

    // Client (Payor or Non-Payor resident)
    const clientItems = [
      {
        id: "client_dashboard",
        label: "Home Dashboard",
        icon: LayoutDashboard,
      },
      { id: "client_bills", label: "My Bills & Breakdown", icon: Receipt },
      {
        id: "client_payments",
        label: "Submit & View Payments",
        icon: CreditCard,
      },
      { id: "client_attendance", label: "Water Attendance", icon: Droplets },
      {
        id: "client_messages",
        label: "Roommate Messages",
        icon: MessageSquare,
      },
      { id: "client_announcements", label: "Announcements", icon: Megaphone },
      { id: "client_profile", label: "My Profile & Support", icon: Settings },
    ];

    // Only non-hosts can apply for host status
    if (!isUserHost) {
      clientItems.splice(1, 0, {
        id: "client_host_application",
        label: "Apply for Host Status",
        icon: Building2,
      });
    }

    return clientItems;
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-xs"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 bottom-0 w-64 bg-white dark:bg-[#000000] border-r border-slate-200 dark:border-white/10 z-50 flex flex-col justify-between transition-all duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-4 overflow-y-auto">
          <div className="px-3 py-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {isUserHost
              ? "HOST / PAYOR MENU"
              : `${role.replace("_", " ")} MENU`}
          </div>

          <nav className="space-y-1 mt-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onClose) onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/10 space-y-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>Create New Group</span>
            </button>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/80 dark:border-blue-800 transition cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Join Household with Code</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-[#000000] space-y-3">
          {/* 3-Mode Theme Selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
              <span>Theme Appearance</span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                {themeMode === "dark"
                  ? "OLED Dark"
                  : themeMode === "light"
                    ? "Light"
                    : "System"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setThemeMode("light")}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  themeMode === "light"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Force Light Mode"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode("dark")}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  themeMode === "dark"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Force OLED Dark Mode"
              >
                <Moon className="w-3.5 h-3.5 text-blue-300" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeMode("system")}
                className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  themeMode === "system"
                    ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Follow Device System Theme"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Auto</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cloud Persisted · v1.0.0</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 pt-1">
            <button
              onClick={() => {
                onSelectTab("terms");
                if (onClose) onClose();
              }}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
            >
              Terms
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => {
                onSelectTab("privacy");
                if (onClose) onClose();
              }}
              className="hover:text-blue-600 dark:hover:text-blue-400 transition cursor-pointer"
            >
              Privacy Policy
            </button>
          </div>
        </div>
      </aside>

      <JoinHouseholdModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </>
  );
};
