export interface BillCategory {
  id: string;
  name: string;
  emoji: string;
  featherIcon: string;
  ionicon: string;
  color: string;
  bgColor: string;
  darkColor: string;
  darkBgColor: string;
  accentColor: string;
  description: string;
}

export interface CategoryVisuals {
  iconColor: string;
  bgColor: string;
  borderColor: string;
}

export const BILL_CATEGORIES: BillCategory[] = [
  {
    id: "Rent",
    name: "Rent",
    emoji: "🏠",
    featherIcon: "home",
    ionicon: "home-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Monthly room or apartment lease",
  },
  {
    id: "Electricity",
    name: "Electricity",
    emoji: "⚡",
    featherIcon: "zap",
    ionicon: "flash-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Electric power, Meralco & sub-meters",
  },
  {
    id: "Water",
    name: "Water",
    emoji: "💧",
    featherIcon: "droplet",
    ionicon: "water-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Water bills (daily attendance or fixed monthly)",
  },
  {
    id: "Wifi Bills",
    name: "Wifi Bills",
    emoji: "📶",
    featherIcon: "wifi",
    ionicon: "wifi-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Fiber, broadband & internet connection",
  },
  {
    id: "Groceries",
    name: "Groceries",
    emoji: "🛒",
    featherIcon: "shopping-cart",
    ionicon: "cart-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Shared food, drinking water & kitchen goods",
  },
  {
    id: "Cleaning",
    name: "Cleaning & Supplies",
    emoji: "🧹",
    featherIcon: "trash-2",
    ionicon: "sparkles-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Housekeeping, trash bags & laundry supplies",
  },
  {
    id: "Maintenance",
    name: "Repairs & Maintenance",
    emoji: "🔧",
    featherIcon: "tool",
    ionicon: "construct-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Aircon cleaning, plumbing & handyman fixes",
  },
  {
    id: "Association Dues",
    name: "Association Dues",
    emoji: "🏢",
    featherIcon: "shield",
    ionicon: "business-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "HOA fees, condo dues, security & admin dues",
  },
  {
    id: "Gas",
    name: "Gas / LPG",
    emoji: "🔥",
    featherIcon: "sun",
    ionicon: "flame-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Cooking gas cylinder & refill",
  },
  {
    id: "Others",
    name: "Others",
    emoji: "🏷️",
    featherIcon: "tag",
    ionicon: "pricetag-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: "Custom or miscellaneous expense (Specify below)",
  },
];

export function getCategoryVisuals(
  categoryMeta: BillCategory,
  isDark?: boolean,
): CategoryVisuals {
  if (isDark) {
    return {
      iconColor: categoryMeta.darkColor || "#60A5FA",
      bgColor: categoryMeta.darkBgColor || "rgba(255, 255, 255, 0.08)",
      borderColor: "rgba(255, 255, 255, 0.06)",
    };
  }
  return {
    iconColor: categoryMeta.color,
    bgColor: categoryMeta.bgColor,
    borderColor: "transparent",
  };
}

export function getCategoryMeta(rawCategory?: string): BillCategory {
  if (!rawCategory) {
    return BILL_CATEGORIES.find((c) => c.id === "Others")!;
  }

  const clean = rawCategory.trim();
  const lower = clean.toLowerCase();

  if (
    lower.includes("rent") ||
    lower.includes("room") ||
    lower.includes("lease")
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Rent")!;
  }
  if (
    lower.includes("elec") ||
    lower.includes("power") ||
    lower.includes("meralco") ||
    lower.includes("light")
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Electricity")!;
  }
  if (lower.includes("water") || lower.includes("attendance")) {
    return BILL_CATEGORIES.find((c) => c.id === "Water")!;
  }
  if (
    lower.includes("wifi") ||
    lower.includes("net") ||
    lower.includes("internet") ||
    lower.includes("broadband") ||
    lower.includes("fiber")
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Wifi Bills")!;
  }
  if (
    lower.includes("groc") ||
    lower.includes("food") ||
    lower.includes("market") ||
    (lower.includes("supplies") && !lower.includes("clean"))
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Groceries")!;
  }
  if (
    lower.includes("clean") ||
    lower.includes("trash") ||
    lower.includes("garbage") ||
    lower.includes("laundry") ||
    lower.includes("maid") ||
    lower.includes("housekeep")
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Cleaning")!;
  }
  if (
    lower.includes("repair") ||
    lower.includes("maint") ||
    lower.includes("aircon") ||
    lower.includes("plumb") ||
    lower.includes("fix") ||
    lower.includes("handyman")
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Maintenance")!;
  }
  if (
    lower.includes("hoa") ||
    lower.includes("association") ||
    lower.includes("condo") ||
    lower.includes("building") ||
    lower.includes("admin fee") ||
    lower.includes("dues")
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Association Dues")!;
  }
  if (
    lower.includes("gas") ||
    lower.includes("lpg") ||
    lower.includes("tank") ||
    lower.includes("fuel") ||
    lower.includes("cooking")
  ) {
    return BILL_CATEGORIES.find((c) => c.id === "Gas")!;
  }

  // If it's a specified custom category (e.g. "Parking Fee" or "Others: Parking Fee")
  let displayLabel = clean;
  if (/^others?:\s*/i.test(clean)) {
    displayLabel = clean.replace(/^others?:\s*/i, "").trim();
  }

  return {
    id: "Others",
    name: displayLabel || "Others",
    emoji: "🏷️",
    featherIcon: "tag",
    ionicon: "pricetag-outline",
    color: "#475569",
    bgColor: "rgba(100, 116, 139, 0.12)",
    darkColor: "#94A3B8",
    darkBgColor: "rgba(148, 163, 184, 0.20)",
    accentColor: "#64748B",
    description: displayLabel,
  };
}
