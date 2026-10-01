/**
 * Bank & Payment Channel Presets and Visual Definitions
 * Supports both popular Philippine bank & e-wallet presets and custom user-uploaded icons.
 */

export interface BankPreset {
  id: string;
  name: string;
  type: "BANK_TRANSFER" | "GCASH" | "MAYA" | "CASH" | "OTHER";
  shortCode: string;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultNotes: string;
  iconUrl?: string; // Optional direct badge image or CDN
}

export const POPULAR_BANK_PRESETS: BankPreset[] = [
  {
    id: "gcash",
    name: "GCash",
    type: "GCASH",
    shortCode: "GCash",
    color: "#0284C7",
    bgColor: "#E0F2FE",
    borderColor: "#BAE6FD",
    defaultNotes: "Send via Express Send or Scan QR. Include room number.",
  },
  {
    id: "maya",
    name: "Maya",
    type: "MAYA",
    shortCode: "Maya",
    color: "#059669",
    bgColor: "#D1FAE5",
    borderColor: "#A7F3D0",
    defaultNotes: "Send to Maya number or scan QR code.",
  },
  {
    id: "bdo",
    name: "BDO Unibank",
    type: "BANK_TRANSFER",
    shortCode: "BDO",
    color: "#003399",
    bgColor: "#EBF3FF",
    borderColor: "#BED8FF",
    defaultNotes: "InstaPay or PESONet transfer to BDO account.",
  },
  {
    id: "bpi",
    name: "BPI",
    type: "BANK_TRANSFER",
    shortCode: "BPI",
    color: "#B91C1C",
    bgColor: "#FEE2E2",
    borderColor: "#FECACA",
    defaultNotes: "Transfer via BPI online/mobile or QR.",
  },
  {
    id: "unionbank",
    name: "UnionBank",
    type: "BANK_TRANSFER",
    shortCode: "UBP",
    color: "#EA580C",
    bgColor: "#FFEDD5",
    borderColor: "#FED7AA",
    defaultNotes: "Send via InstaPay to UnionBank account.",
  },
  {
    id: "metrobank",
    name: "Metrobank",
    type: "BANK_TRANSFER",
    shortCode: "MBTC",
    color: "#1D4ED8",
    bgColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    defaultNotes: "InstaPay transfer to Metrobank.",
  },
  {
    id: "landbank",
    name: "Landbank",
    type: "BANK_TRANSFER",
    shortCode: "LBP",
    color: "#15803D",
    bgColor: "#DCFCE7",
    borderColor: "#BBF7D0",
    defaultNotes: "InstaPay / PESONet transfer to Landbank.",
  },
  {
    id: "gotyme",
    name: "GoTyme Bank",
    type: "BANK_TRANSFER",
    shortCode: "GoTyme",
    color: "#0D9488",
    bgColor: "#CCFBF1",
    borderColor: "#99F6E4",
    defaultNotes: "Send via InstaPay to GoTyme Bank account.",
  },
  {
    id: "seabank",
    name: "SeaBank",
    type: "BANK_TRANSFER",
    shortCode: "SeaBank",
    color: "#EA580C",
    bgColor: "#FFF7ED",
    borderColor: "#FED7AA",
    defaultNotes: "InstaPay transfer to SeaBank account.",
  },
  {
    id: "securitybank",
    name: "Security Bank",
    type: "BANK_TRANSFER",
    shortCode: "SBC",
    color: "#0F766E",
    bgColor: "#F0FDFA",
    borderColor: "#99F6E4",
    defaultNotes: "InstaPay transfer to Security Bank.",
  },
  {
    id: "rcbc",
    name: "RCBC",
    type: "BANK_TRANSFER",
    shortCode: "RCBC",
    color: "#1E40AF",
    bgColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    defaultNotes: "InstaPay transfer to RCBC account.",
  },
  {
    id: "cash",
    name: "Cash Handover",
    type: "CASH",
    shortCode: "Cash",
    color: "#D97706",
    bgColor: "#FEF3C7",
    borderColor: "#FDE68A",
    defaultNotes:
      "Pay directly in cash to the property host and request verification.",
  },
  {
    id: "other",
    name: "Other Bank / E-Wallet",
    type: "OTHER",
    shortCode: "Other",
    color: "#475569",
    bgColor: "#F1F5F9",
    borderColor: "#CBD5E1",
    defaultNotes: "Please transfer with reference notes.",
  },
];

export function findBankPresetByNameOrType(
  query: string,
): BankPreset | undefined {
  if (!query) return undefined;
  const q = query.toLowerCase().trim();
  return POPULAR_BANK_PRESETS.find(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.shortCode.toLowerCase() === q ||
      b.id === q ||
      b.type.toLowerCase() === q,
  );
}
