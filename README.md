# Project Tugende: Kigali Micro-Mobility Prototype

An internal educational prototype built by the engineering intern team to master Capacitor-to-Swift bridging, Xcode configurations, and iOS development ahead of the Bimoto iOS migration.

---

## Technical Stack
- **Web Core:** React (TypeScript) + Vite
- **Mobile Container:** Capacitor 8.5 (Swift Package Manager only; no CocoaPods)
- **Native Platform:** iOS 15.0+ / Xcode 27 / Swift 5.10+
- **Target City:** Kigali, Rwanda

---

## Hardware & Workflow Model
- **Windows Laptops:** Daily UI, state, map, and mock flow development using `npm run dev`.
- **Dedicated Mac Station:** Native iOS shell compilation, Swift plugin development, and Xcode Simulator testing.

---

## Team & Ownership
- **Sophonie:** Architecture, Xcode workspace, SPM setup, native Swift camera bridge.
- **Gakiza:** Module A (Station Discovery & Kigali Map UI).
- **Faustin:** Module D & Bridge Contract (MoMo Payment Simulation & Scanner UI).

---

## Getting Started (Local Development on Windows)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/faustin12-g/tugende-mobile
   cd Tugende-mobile