# KULA App Store Compliance Audit (Updated)

This updated audit details KULA's compliance status now that the **iOS native platform is active in Xcode** and several compliance updates (UGC reporting and permissions) have been merged.

---

## 🚦 Compliance Dashboard

| Guideline | Category | Requirement | Current Status | Code Reference |
| :--- | :--- | :--- | :--- | :--- |
| **4.8** | Business | Social Sign-In (Apple Sign-In) | 🔴 **Non-Compliant** | [useAuth.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/hooks/useAuth.tsx), [Welcome.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/Welcome.tsx) |
| **1.2** | Safety | User-Generated Content (Chat Blocking) | 🟢 **Compliant** | [ChatsList.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ChatsList.tsx), [ChatRoom.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ChatRoom.tsx) |
| **1.2** | Safety | User-Generated Content (UGC Reporting) | 🟢 **Compliant** | [ReportSheet.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ReportSheet.tsx), [ItemDetailsSheet.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ItemDetailsSheet.tsx) |
| **5.1.1** | Privacy | iOS Permission Descriptions | 🟢 **Compliant** | [Info.plist](file:///Users/serdar/ANTIGRAVITY/KULA/ios/App/App/Info.plist#L55-L62) |
| **2.1** | Design | App Review Bypass | 🟢 **Compliant** | [InviteGate.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/InviteGate.tsx#L51) |
| **2.5.4** | Design | UI Safe Areas & Platform Styling | 🟢 **Compliant** | [Header.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/Header.tsx#L24) |

---

## Detailed Audit Update

### 1. Safety: User-Generated Content (UGC)
* **What's Done (Compliant):**
  * **UGC Reporting**: We now have a fully operational [ReportSheet.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ReportSheet.tsx) integrated into both user profiles ([PublicProfile.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/PublicProfile.tsx)) and item sheets ([ItemDetailsSheet.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ItemDetailsSheet.tsx)). It logs flags inside the `reports` collection in Firestore under standard Apple UGC categories.
  * **Feed Filtering**: Neighbors can block profiles inside [PublicProfile.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/PublicProfile.tsx), which filters their posts out of the item feeds via [useItems.ts](file:///Users/serdar/ANTIGRAVITY/KULA/src/hooks/useItems.ts#L102).
  * **Chat Blocking**: Direct messages, threads, and inbox previews involving blocked users are fully filtered and blocked. The direct inbox ([ChatsList.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ChatsList.tsx)) automatically hides conversations with blocked users, and the active [ChatRoom.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/ChatRoom.tsx) disables chat entry and displays a clear message if either participant is blocked.
* **What's Missing (Non-Compliant):**
  * None. User-Generated Content safety requirements are now fully addressed.

---

### 2. Business: Sign in with Apple
* **What's Done (Compliant):**
  * We have native Google Sign-In running via `@capacitor-firebase/authentication` inside [useAuth.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/hooks/useAuth.tsx#L345-L364).
* **What's Missing (Non-Compliant):**
  * We **do not offer Sign in with Apple**. Since we use native Google Social Sign-in on mobile, the App Store will immediately reject the app (Guideline 4.8) if an Apple Sign-In alternative is missing.
* **Remediation Plan:**
  1. Add `"apple.com"` to the providers list in [capacitor.config.ts](file:///Users/serdar/ANTIGRAVITY/KULA/capacitor.config.ts#L10).
  2. Implement Apple Sign-In handler inside [useAuth.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/hooks/useAuth.tsx) utilizing `FirebaseAuthentication.signInWithApple()`.
  3. Add a "Sign in with Apple" native-looking button next to Google inside the sign-in modal in [Welcome.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/Welcome.tsx#L155-L166).

---

### 3. Privacy: iOS Permission Keys
* **What's Done (Compliant):**
  * The iOS config [Info.plist](file:///Users/serdar/ANTIGRAVITY/KULA/ios/App/App/Info.plist#L55-L62) has been fully configured with personalized, descriptive usage strings for:
    * Location Services (`NSLocationWhenInUseUsageDescription` / `NSLocationAlwaysUsageDescription`)
    * Camera Access (`NSCameraUsageDescription`)
    * Photo Library Access (`NSPhotoLibraryUsageDescription`)
  * This prevents native privacy policy violations and crashes.

---

### 4. Design: Review Mode & Onboarding Bypass
* **What's Done (Compliant):**
  * The reviewer bypass code `TESTER` in [InviteGate.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/InviteGate.tsx#L51) allows Apple review personnel to register a mock profile and explore the entire app's neighbor interface without database write blockades.
* **Remediation Plan:**
  * When submitting the build in App Store Connect, include explicit instructions in the **App Review Information** fields stating:
    > *"For testing, log in and use the invitation bypass code **TESTER** to complete user registration."*
