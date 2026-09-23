# PropertyFlow — Roommate/Household Bill Management System

A production-ready, cloud-persisted **Roommate and Household Bill Management System** designed for shared apartments and houses where bills must be automatically calculated, split, tracked, and paid with exact centavo precision.

---

## 🌟 Key Features

1. **Deterministic Centavo-Safe Math Engine**:
   - All financial operations use integer centavos (1 PHP = 100 centavos) to avoid floating-point rounding errors.
   - Remainder centavos are deterministically allocated so the exact sum always matches to the single centavo.
2. **Three Role-Based Application Experiences**:
   - **Host Web Portal**: Full billing management, electricity meter readings, water attendance locks, payment approvals/rejections, and balance redistribution.
   - **Client Web & Mobile (Expo) Portals**: For Payors and Non-Payors. Itemized bill breakdowns, daily water attendance calendar, payment submissions with receipt uploads, and roommate group chats.
   - **Super Admin Portal**: Global household directory, user account management, multi-platform app version management (Android/iOS/Web forced updates), support ticket desk, and audit logs.
3. **Core Billing Modules**:
   - **Apartment Rent**: Equal splits, payor-only splits, custom percentages.
   - **Internet**: Fixed amounts and equal payor allocations.
   - **Electricity Formula**: `(Current Meter - Previous Meter) * Rate (₱16.00/kWh) = kWh Used * Rate`.
   - **Water Attendance Calendar**: Driven strictly by cycle dates (e.g. August 13 to September 12). `Attendance Days * Water Rate (₱5.00/person/day) = Member Water Share`.
   - **Custom Charges**: Cleaning, repairs, supplies, LPG gas refills.
4. **Partial Payments & Balance Redistribution**:
   - Payors can submit partial payments (e.g. paying ₱2,000.00 on a ₱2,219.50 bill).
   - Remaining ₱219.50 outstanding balance can be redistributed by the Host among other active Payors.
   - 3 recipients: ₱73.17, ₱73.17, ₱73.16 (totaling exactly ₱219.50).
   - The original bill is preserved and immutable audit records are created.
5. **Real-Time Synchronized Event Architecture**:
   - Live notifications for bill finalization, payment submission, approvals, and balance redistributions.
   - Real-time household group chat and direct roommate messaging.
   - Announcements with targeted audiences (Everyone, Payors only, Non-Payors only).
6. **Firebase Security Rules & Cloud Functions**:
   - Role-based authorization enforced via `firestore.rules` and `storage.rules`.
   - Trusted server-side execution via Firebase Cloud Functions for billing finalization, balance redistribution, and payment verification.

---

## 🏗️ Repository Architecture

```text
PropertyFlowRemake/
├── firestore.rules              # Production Firestore security rules
├── firestore.indexes.json       # Composite Firestore query indexes
├── storage.rules                # Storage security rules (receipts & avatars)
├── firebase.json                # Firebase emulators and services configuration
├── packages/
│   ├── shared/                  # Domain types, centavo math, and pure calculation engine
│   │   ├── src/types/           # User, Household, BillingCycle, MemberBill, Payment, Adjustment
│   │   ├── src/math/            # Integer centavo arithmetic & deterministic remainder splitter
│   │   ├── src/engine/          # Centralized billing engine & redistribution logic
│   │   └── src/tests/           # Automated node test suite
│   ├── web/                     # React + Vite + Tailwind CSS dashboard matching proposedUI
│   │   ├── src/components/      # Header, Sidebar, DemoBar, Modals, Cards, Badges
│   │   ├── src/views/host/      # Host CMS & Billing operations
│   │   ├── src/views/client/    # Client dashboard, Bills, Payments, Attendance, Chat
│   │   └── src/views/admin/     # Super Admin controls & App Version Management
│   ├── mobile/                  # React Native with Expo mobile app
│   │   ├── src/screens/         # Home, Bills, Payments, Attendance, Messages, Profile
│   │   └── src/services/        # Push notification registration service
│   └── functions/               # Firebase Cloud Functions (TypeScript)
│       └── src/                 # finalizeBillingCycle, redistributeBalance, verifyPayment
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (tested on Node v22.18.0)
- npm 10+

### 1. Build and Test the Shared Domain Engine

```bash
cd packages/shared
npm install
npm test
npm run build
```

### 2. Run the React Web Dashboard

```bash
cd packages/web
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Run the React Native Expo Mobile App

```bash
cd packages/mobile
npm install
npm start
```

Press `w` to open in web, `a` for Android emulator, or scan the QR code using Expo Go on iOS/Android.

---

## 🧪 Testing the Acceptance Flow

The application comes with an interactive **Demo Bar** at the top of the screen pre-seeded with the exact household scenario from the master prompt:

1. **Household**: Skyline Residences Unit 402
2. **Residents (7 Total)**:
   - 1 Host: Alex Chen (`u_host`)
   - 4 Payors: Bea Alonzo (`u_p1`), Carlos Santos (`u_p2`), Diana Prince (`u_p3`), Ethan Hunt (`u_p4`)
   - 3 Non-Payors: Fiona Gallagher (`u_np1`), George Clark (`u_np2`), Hannah Abbott (`u_np3`)
3. **Rates & Config**:
   - Rent: ₱14,000.00 / 4 Payors = ₱3,500.00 each
   - Internet: ₱1,500.00 / 4 Payors = ₱375.00 each
   - Electricity: 1,250 to 1,390 kWh = 140 kWh @ ₱16.00/kWh = ₱2,240.00
   - Water: ₱5.00/person/day based on the August 13 – September 12 attendance calendar
4. **Partial Payment & Redistribution Test**:
   - Switch to **Payor (Bea)**: View ₱2,219.50 bill with verified partial payment of ₱2,000.00 and remaining due of ₱219.50.
   - Switch to **Host (Alex)**: Navigate to **Balance Redistribution**, choose Bea Alonzo, and observe the deterministic preview:
     - Carlos Santos: ₱73.17
     - Diana Prince: ₱73.17
     - Ethan Hunt: ₱73.16
     - Total: **₱219.50** (sum matches to the centavo without rounding loss).
   - Click **Confirm & Apply**: The balances update, audit logs are saved, and affected roommates receive notifications.
   - Switch to **Super Admin**: Review the platform metrics, app version configurations (Expo SDK 57 / React Native 0.86), support tickets, and immutable audit logs.
