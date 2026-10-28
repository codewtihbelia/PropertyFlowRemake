import { Ionicons } from "@expo/vector-icons";
import { WalletTransaction } from "../services/walletService";

export interface SemanticExpenseInput {
  title?: string;
  note?: string;
  description?: string;
  category?: string;
  icon?: string;
  type?: string;
  amount?: number;
  [key: string]: any;
}

export type AppWalletTransaction = WalletTransaction & {
  note?: string;
  icon?: string;
  category?: string;
};

// Intersection ensures note, category, icon, title, and description are ALWAYS recognized by TypeScript
// on unions of SemanticExpenseInput | Partial<WalletTransaction> | WalletTransaction
export type SemanticTxInput = (
  | SemanticExpenseInput
  | Partial<WalletTransaction>
  | Partial<AppWalletTransaction>
  | Record<string, any>
) & {
  note?: string;
  category?: string;
  icon?: string;
  title?: string;
  description?: string;
};

export function getExpenseSemanticIconMobile(tx?: SemanticTxInput | null): {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
} {
  const presetIconMap: Record<
    string,
    { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
  > = {
    coffee: { icon: "cafe", color: "#F59E0B", bg: "#F59E0B18" },
    cafe: { icon: "cafe", color: "#F59E0B", bg: "#F59E0B18" },
    lunch: { icon: "restaurant", color: "#FB923C", bg: "#FB923C18" },
    restaurant: { icon: "restaurant", color: "#FB923C", bg: "#FB923C18" },
    commute: { icon: "bus", color: "#38BDF8", bg: "#38BDF818" },
    bus: { icon: "bus", color: "#38BDF8", bg: "#38BDF818" },
    grocery: { icon: "basket", color: "#34D399", bg: "#34D39918" },
    basket: { icon: "basket", color: "#34D399", bg: "#34D39918" },
    cart: { icon: "basket", color: "#34D399", bg: "#34D39918" },
    merienda: { icon: "fast-food", color: "#FBBF24", bg: "#FBBF2418" },
    "fast-food": { icon: "fast-food", color: "#FBBF24", bg: "#FBBF2418" },
    utility: { icon: "flash", color: "#A78BFA", bg: "#A78BFA18" },
    flash: { icon: "flash", color: "#A78BFA", bg: "#A78BFA18" },
    pharmacy: { icon: "medkit", color: "#FB7185", bg: "#FB718518" },
    medkit: { icon: "medkit", color: "#FB7185", bg: "#FB718518" },
    cash: { icon: "cash", color: "#10B981", bg: "#10B98118" },
  };

  const safeTx = (tx || {}) as SemanticTxInput;
  const rawTitle = safeTx.title || "";
  const rawNote = safeTx.note || "";
  const rawDescription = safeTx.description || "";
  const rawCategory = safeTx.category || "";
  const rawText =
    `${rawTitle} ${rawNote} ${rawDescription} ${rawCategory}`.toLowerCase();

  // 1. Drinks, Coffee, Milk Tea & Beverages
  if (
    /(coffee|cafe|espresso|latte|cappuccino|americano|mocha|tea|boba|milktea|milk tea|starbucks|dunkin|drink|beverage|juice|smoothie|frap|chatime|coco|macao|gong cha|tiger sugar|matcha)/.test(
      rawText,
    )
  ) {
    return { icon: "cafe", color: "#F59E0B", bg: "#F59E0B18" };
  }
  // 2. Meals, Fast Food & Dining Out
  if (
    /(lunch|dinner|breakfast|meal|food|restaurant|karinderya|carinderia|jollibee|mcdo|mcdonald|burger|ramen|kfc|inasal|chowking|pares|silog|tapsilog|sinigang|adobo|eat|dining|resto|buffet|kbbq|samgyup|bbq|shawarma|chooks|mang inasal)/.test(
      rawText,
    )
  ) {
    return { icon: "restaurant", color: "#FB923C", bg: "#FB923C18" };
  }
  // 3. Pizza & Italian
  if (/(pizza|yellow cab|shakey|domino|pizza hut)/.test(rawText)) {
    return { icon: "pizza", color: "#EA580C", bg: "#EA580C18" };
  }
  // 4. Merienda & Bakery Snacks
  if (
    /(merienda|snack|bakery|bread|pan de sal|pandesal|pastry|donut|cake|dessert|cookie|chips|ice cream|candy|waffle|goldilocks|red ribbon)/.test(
      rawText,
    )
  ) {
    return { icon: "fast-food", color: "#FBBF24", bg: "#FBBF2418" };
  }
  // 5. Ridesharing, Fuel & Personal Vehicle
  if (
    /(grab|taxi|cab|angkas|joyride|maxim|car|gas|fuel|petrol|toll|parking|diesel|drive|petron|shell|caltex)/.test(
      rawText,
    )
  ) {
    return { icon: "car", color: "#0284C7", bg: "#0284C718" };
  }
  // 6. Commute & Public Transit
  if (
    /(commute|fare|jeep|jeepney|trike|tricycle|bus|mrt|lrt|train|transit|subway|ride|travel)/.test(
      rawText,
    )
  ) {
    return { icon: "bus", color: "#38BDF8", bg: "#38BDF818" };
  }
  // 7. Flights & Vacation Travel
  if (
    /(flight|airplane|travel|vacation|airline|airport|cebu pacific|philippine airlines|airasia|hotel|airbnb|resort)/.test(
      rawText,
    )
  ) {
    return { icon: "airplane", color: "#3B82F6", bg: "#3B82F618" };
  }
  // 8. Supermarket, Fresh Market & Pantry
  if (
    /(grocery|groceries|market|palengke|supermarket|puregold|robinsons|sm market|sari-sari|convenience|7-eleven|ministop|alfamart|store|pantry|supplies|soap|shampoo|landers|snr|s&r)/.test(
      rawText,
    )
  ) {
    return { icon: "basket", color: "#34D399", bg: "#34D39918" };
  }
  // 9. Laundry & Fabric Care
  if (
    /(laundry|labada|wash|dry clean|dryclean|detergent|downy|ariel|surf|tide|cleaners)/.test(
      rawText,
    )
  ) {
    return { icon: "shirt", color: "#0EA5E9", bg: "#0EA5E918" };
  }
  // 10. Pharmacy, Health & Medical
  if (
    /(pharmacy|meds|medicine|drug|mercury|watsons|generics|doctor|clinic|hospital|dental|dentist|health|vitamin|pill|bandage|biogesic|neozep|paracetamol|theraflu)/.test(
      rawText,
    )
  ) {
    return { icon: "medkit", color: "#FB7185", bg: "#FB718518" };
  }
  // 11. Power, Electricity & Prepaid Load
  if (
    /(utility|utilities|bill|load|data|electric|meralco|power|prepaid|postpaid)/.test(
      rawText,
    )
  ) {
    return { icon: "flash", color: "#A78BFA", bg: "#A78BFA18" };
  }
  // 12. Water Services
  if (/(water|maynilad|manila water|prime water)/.test(rawText)) {
    return { icon: "water", color: "#06B6D4", bg: "#06B6D418" };
  }
  // 13. Internet & Telecom
  if (
    /(internet|wifi|fiber|pldt|globe|smart|converge|dito|telco)/.test(rawText)
  ) {
    return { icon: "wifi", color: "#8B5CF6", bg: "#8B5CF618" };
  }
  // 14. Cinema & Streaming
  if (/(movie|cinema|netflix|theater|film|disney|hbo|youtube)/.test(rawText)) {
    return { icon: "film", color: "#E11D48", bg: "#E11D4818" };
  }
  // 15. Gaming & Digital Entertainment
  if (
    /(game|gaming|steam|playstation|xbox|nintendo|esports|valorant|genshin|mlbb|mobile legends)/.test(
      rawText,
    )
  ) {
    return { icon: "game-controller", color: "#6366F1", bg: "#6366F118" };
  }
  // 16. Music & Audio Streaming
  if (/(spotify|music|concert|song|audio|apple music)/.test(rawText)) {
    return { icon: "musical-notes", color: "#10B981", bg: "#10B98118" };
  }
  // 17. Gym, Sports & Fitness
  if (
    /(gym|workout|fitness|crossfit|boxing|yoga|anytime fitness|gold gym|pilates|sports|badminton|basketball)/.test(
      rawText,
    )
  ) {
    return { icon: "fitness", color: "#F43F5E", bg: "#F43F5E18" };
  }
  // 18. Grooming, Salon & Personal Care
  if (
    /(haircut|salon|barber|barbershop|beauty|spa|wax|massage|nails)/.test(
      rawText,
    )
  ) {
    return { icon: "cut", color: "#EC4899", bg: "#EC489918" };
  }
  // 19. School, Books & Education
  if (
    /(school|book|tuition|course|study|exam|stationery|pen|paper|class|supplies|national bookstore)/.test(
      rawText,
    )
  ) {
    return { icon: "book", color: "#3B82F6", bg: "#3B82F618" };
  }
  // 20. Tech, Gadgets & Hardware
  if (
    /(tech|gadget|phone|iphone|android|laptop|macbook|ipad|tablet|charger|cable|earbuds|airpods|headphone|mouse|keyboard|monitor|electronics)/.test(
      rawText,
    )
  ) {
    return { icon: "hardware-chip", color: "#6366F1", bg: "#6366F118" };
  }
  // 21. Celebrations & Gifts
  if (
    /(gift|regalo|present|party|birthday|anniversary|celebration|christmas|balloon)/.test(
      rawText,
    )
  ) {
    return { icon: "gift", color: "#EC4899", bg: "#EC489918" };
  }
  // 22. Tools & Repair
  if (
    /(tool|tools|repair|hardware|hammer|drill|plumbing|paint|screws|fix|maintenance)/.test(
      rawText,
    )
  ) {
    return { icon: "construct", color: "#F59E0B", bg: "#F59E0B18" };
  }
  // 23. Subscriptions & Association Dues
  if (
    /(subscription|sub|hoa|dues|condo dues|association|membership|fee|insurance)/.test(
      rawText,
    )
  ) {
    return { icon: "card", color: "#8B5CF6", bg: "#8B5CF618" };
  }
  // 24. Apparel & Lifestyle Shopping
  if (
    /(shopping|clothes|shirt|pants|shoes|sneakers|shopee|lazada|shein|tiktok|apparel|fashion|zara|uniqlo|h&m)/.test(
      rawText,
    )
  ) {
    return { icon: "pricetag", color: "#F472B6", bg: "#F472B618" };
  }
  // 25. Pets & Veterinary Care
  if (/(pet|vet|dog|cat|animal|puppy|kitten)/.test(rawText)) {
    return { icon: "paw", color: "#F59E0B", bg: "#F59E0B18" };
  }
  // 26. Rent, Home & Accommodation
  if (/(rent|room|apartment|condo|house|home|stay|dorm)/.test(rawText)) {
    return { icon: "home", color: "#14B8A6", bg: "#14B8A618" };
  }
  // 27. Cash & Allowances
  if (/(cash|allowance|petty|tender|atm|change|withdrawal)/.test(rawText)) {
    return { icon: "cash", color: "#10B981", bg: "#10B98118" };
  }

  // Preset key fallback (ignoring generic 'cart', 'custom', 'add-circle' so title takes precedence)
  const txIcon = safeTx.icon;
  if (
    txIcon &&
    !["cart", "custom", "add-circle"].includes(txIcon) &&
    presetIconMap[txIcon]
  ) {
    return presetIconMap[txIcon];
  }

  // Diversified lifestyle fallbacks (NEVER defaulting to cart or bag)
  const fallbacks: {
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    bg: string;
  }[] = [
    { icon: "sparkles", color: "#EC4899", bg: "#EC489918" },
    { icon: "pricetag", color: "#8B5CF6", bg: "#8B5CF618" },
    { icon: "compass", color: "#14B8A6", bg: "#14B8A618" },
    { icon: "bookmark", color: "#06B6D4", bg: "#06B6D418" },
    { icon: "wallet", color: "#10B981", bg: "#10B98118" },
    { icon: "heart", color: "#F43F5E", bg: "#F43F5E18" },
    { icon: "gift", color: "#F59E0B", bg: "#F59E0B18" },
    { icon: "cube", color: "#3B82F6", bg: "#3B82F618" },
    { icon: "ribbon", color: "#8B5CF6", bg: "#8B5CF618" },
    { icon: "shield-checkmark", color: "#0284C7", bg: "#0284C718" },
  ];
  const charCodeSum = (tx?.title || "expense")
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fallbacks[charCodeSum % fallbacks.length];
}
