# KULA App Store Launch Plan

This document outlines the step-by-step path to compile, package, test, and launch **KULA** on the Apple App Store. 

Since KULA is built as a hybrid app using **Vite, React, Firebase**, and **Capacitor**, we must transition the web-based code into a native iOS project. We must also meet strict Apple App Review guidelines—particularly regarding third-party authentication, user privacy, and location-based features.

---

## 📋 Executive Checklist

| Phase | Milestone | Est. Effort | Dependency | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Phase 1** | [Apple Developer Program Enrollment](#phase-1-apple-developer-program-enrollment) | 1-3 days | Organization Registry (D-U-N-S) | 🟩 Planned |
| **Phase 2** | [Capacitor iOS Platform Setup](#phase-2-capacitor-ios-platform-setup) | 1 day | None | 🟩 Planned |
| **Phase 3** | [iOS App Permissions & Privacy Settings](#phase-3-ios-app-permissions--privacy-settings) | 1 day | Geolocation & Media Code review | 🟩 Planned |
| **Phase 4** | [Firebase Auth & Apple Sign-In (Mandatory)](#phase-4-firebase-auth--apple-sign-in-mandatory) | 2-3 days | Developer Account App ID | 🟩 Planned |
| **Phase 5** | [App Store Connect Metadata & Listing Assets](#phase-5-app-store-connect-metadata--listing-assets) | 2 days | Design Style Guide | 🟩 Planned |
| **Phase 6** | [Build Compilation & TestFlight Distribution](#phase-6-build-compilation--testflight-distribution) | 1-2 days | Xcode Setup & Code Signing | 🟩 Planned |
| **Phase 7** | [App Review & Submission Strategy](#phase-7-app-review--submission-strategy) | 3-5 days | Test Accounts & Sandbox seeding | 🟩 Planned |

---

## Phase 1: Apple Developer Program Enrollment

To submit apps to the App Store, you need an active Apple Developer membership.

1. **Choose Account Type:**
   - **Individual ($99/year):** Fastest to set up. Your personal name will appear as the developer in the App Store.
   - **Organization ($99/year):** Highly recommended for KULA. Displays the company name. Requires a **D-U-N-S Number** (Dun & Bradstreet) to verify the legal entity status, which can take 1-5 business days to acquire for free.
2. **Steps to Enroll:**
   - Go to [developer.apple.com/programs/enroll](https://developer.apple.com/programs/enroll/).
   - Sign in with an Apple ID (secure it with Two-Factor Authentication).
   - Complete verification, pay the fee, and wait for confirmation (usually 24-48 hours).
3. **Register App ID & Bundle Identifier:**
   - Match the bundle ID defined in `capacitor.config.ts` (currently `com.kula.app`).
   - Go to **Certificates, Identifiers & Profiles** in the Developer Portal, register `com.kula.app`, and enable necessary capabilities (e.g., **Sign In with Apple**, **Push Notifications**).

### Phase 6: App Store Preparation

**Task:** Finalize builds for TestFlight and App Store submission.
**Execution Details:**
1. **Create Privacy Manifest (`PrivacyInfo.xcprivacy`):** Create the file `ios/App/App/PrivacyInfo.xcprivacy` containing declarations for standard APIs used by Capacitor and the app (e.g. `UserDefaults` for preferences).
2. Ensure the Privacy Policy and Terms of Service web pages are correctly bundled.
3. Open Xcode (`npx cap open ios`) to build and archive the app.

### Phase 7: Firebase Storage Migration (Base64 Image Size Fix)

**Task:** Resolve the Base64 image storage issue in Firestore by migrating uploads to Firebase Cloud Storage, and write a cleanup script for orphaned files.
**Execution Details:**
1. **Firebase Configuration (`firebase.ts`):** Initialize and export Firebase Storage instance (`storage`), adding the local emulator configuration if in dev mode.
2. **Local Emulator & Rules Setup:**
   - Configure the Storage emulator in `firebase.json` (port 9199).
   - Define a `storage` service bucket and add security rules (`storage.rules`) allowing authenticated reads and writes.
3. **Refactor Upload Form (`PostItem.tsx`):**
   - Refactor file upload logic to upload images directly to `/items/uploads/{userId}/{randomId}`.
   - Store public download URLs in the Firestore `items` document instead of raw base64 data.
   - If an upload is removed or cancelled before posting, delete it from storage immediately.
4. **Orphaned Data Cleanup Script:**
   - Write a Node.js script `scripts/cleanup_orphaned_storage.cjs` to run periodically (e.g., via a cron job or manual execution) to query Firestore `items` and delete any files in the Storage bucket that are no longer referenced by any active posts.

---

## Phase 2: Capacitor iOS Platform Setup

We need to add the `@capacitor/ios` platform to the codebase.

1. **Install Dependencies:**
   Run the following commands in the workspace root:
   ```bash
   # Install the iOS platform library
   npm install @capacitor/ios
   
   # Add the iOS platform folder (creates `/ios` directory)
   npx cap add ios
   ```
2. **Build and Sync Pipeline:**
   Before opening Xcode, compile the latest Vite distribution bundle and sync it with Capacitor:
   ```bash
   # 1. Clear previous distribution assets
   npm run clean
   
   # 2. Build the Vite production bundles
   npm run build
   
   # 3. Copy files and sync plugins into the native Xcode project
   npx cap sync
   ```
3. **Running the App in Simulator/Device:**
   To open the project in Xcode, run:
   ```bash
   npx cap open ios
   ```
   *Note: Xcode is required and runs only on macOS.*

---

## Phase 3: iOS App Permissions & Privacy Settings

Apple requires clear justification messages in the `Info.plist` file for any hardware or system API the app accesses. If these keys are missing or contain generic descriptions, the app will crash or be rejected.

Based on KULA's codebase review, we must configure:

### 1. Location Services (Geospatial Discovery)
KULA uses coordinates in `src/hooks/useGeolocation.ts` to sort feed items, calculate distances, and center the map.
Add these keys to `ios/App/App/Info.plist`:
* **`NSLocationWhenInUseUsageDescription`**: "KULA uses your location to discover nearby neighbor sharing, community events, and show you resources in your vicinity."
* **`NSLocationAlwaysAndWhenInUseUsageDescription`**: "KULA uses your location to keep you connected with neighborhood activities and map nearby sharing." *(Include if requesting background locations; otherwise, "When In Use" is sufficient).*

### 2. Camera & Photo Library Access
In `src/components/PostItem.tsx`, users can upload images/videos of their gifted/requested items directly from their camera or library.
Add these keys to `Info.plist`:
* **`NSCameraUsageDescription`**: "KULA needs camera access so you can take photos of items you want to gift, share, or request in the community."
* **`NSPhotoLibraryUsageDescription`**: "KULA needs photo library access to let you choose and upload photos of items you are sharing."
* **`NSMicrophoneUsageDescription`**: "KULA needs microphone access to record audio for videos of items you upload."
* **`NSPhotoLibraryAddUsageDescription`**: "KULA needs permission to save images to your library."

---

## Phase 4: Firebase Auth & Apple Sign-In (Mandatory)

> [!IMPORTANT]
> **Apple Review Guideline 4.8:** If your app offers third-party social logins (like Google Sign-In, which KULA currently uses in `src/hooks/useAuth.tsx`), you **must** also offer **Sign in with Apple** as an equivalent option. Failure to do so will result in an immediate rejection.

### 1. Migrating to Native Capacitor Auth Plugins
The current standard web Firebase login (`signInWithPopup(auth, googleProvider)`) will not work inside iOS's native WKWebView container due to redirect and frame security restrictions.

We must migrate login handlers to use native wrappers, then pass the tokens to Firebase:
* **Google Sign-In**: Use `@capacitor-community/google-auth`.
* **Apple Sign-In**: Use `@capacitor-community/apple-sign-in`.

### 2. Implementation Path (Abstract)
1. Install native login plugins:
   ```bash
   npm install @capacitor-community/google-auth @capacitor-community/apple-sign-in
   ```
2. Adjust `src/hooks/useAuth.tsx` to detect platform and run native social login flow:
   ```typescript
   import { Capacitor } from '@capacitor/core';
   import { GoogleAuth } from '@capacitor-community/google-auth';
   import { SignInWithApple } from '@capacitor-community/apple-sign-in';
   import { signInWithCredential, GoogleAuthProvider, OAuthProvider } from 'firebase/auth';

   // Native Google Auth
   const nativeGoogleSignIn = async () => {
     const user = await GoogleAuth.signIn();
     const credential = GoogleAuthProvider.credential(user.authentication.idToken);
     return signInWithCredential(auth, credential);
   };

   // Native Apple Auth
   const nativeAppleSignIn = async () => {
     const result = await SignInWithApple.authorize({
       clientId: 'com.kula.app',
       redirectURI: 'https://kula-app.firebaseapp.com/__/auth/handler',
       scopes: 'email name',
     });
     const provider = new OAuthProvider('apple.com');
     const credential = provider.credential({
       idToken: result.response.identityToken,
       rawNonce: result.response.nonce,
     });
     return signInWithCredential(auth, credential);
   };
   ```
3. Set up Apple Sign-In capability in Xcode (**Signing & Capabilities** → **+ Capability** → **Sign in with Apple**).
4. Configure Apple Sign-In inside your **Firebase Console** (under **Authentication** → **Sign-in method** → **Apple**). You will need to link your Apple developer Services ID and private key.

---

## Phase 5: App Store Connect Metadata & Listing Assets

To honor KULA's unique project art direction (**Berlin grassroots, Altbau, vintage, analog 35mm warm vibes**), your App Store assets should look candid and authentic rather than sleek, sterile, or corporate.

### 1. Metadata Requirements
* **App Name**: `KULA - Neighborhood Sharing` (Max 30 chars).
* **Subtitle**: `Vouched Community & Local Gifts` (Max 30 chars).
* **Keywords**: `neighborhood, local sharing, community circle, gifting, borrow tools, Berlin local, vouched network, mutual aid`.
* **Description**: Focus on the grassroots spirit:
  > "KULA is an unpolished, honest space for neighborhood sharing. Born out of the analog Berlin grassroots spirit—Altbau courtyards, community gardens, and shared cellars—KULA connects you with your neighbors through a vouched trust network. Share garden tools, lend a hand, coordinate neighborhood cleanups, or host a casual backyard coffee chat. Zero commercial waste, pure community connection."
* **Support URL**: A web page with contact info and a simple form.
* **Privacy Policy URL**: Required. Can be hosted easily on your Firebase Hosting (e.g., `kula-app.web.app/privacy`).

### 2. Visual Assets (Screenshots & Icon)
Do NOT use generic 3D mockups. Use screenshots showcasing real interfaces paired with background analog photography.
* **App Icon**: 1024x1024 px. Needs a warm, earthy tone (e.g., KULA's signature moss green `#5A5A40` or terracotta background) with the iconic analog "K".
* **iPhone Screens (6.7" & 6.5")**:
  - Show the **Trust Network Graph** (visualizing separating degrees).
  - Show the **Create Entry** sheet with warm custom category emojis.
  - Show the local map indicating shared items.
  - When generating promo banners, use a prompt like: *"Style: Analog 35mm film photography, natural lighting, candid, authentic, grassroots, community-focused, avoiding corporate stock styles."*

---

## Phase 6: Build Compilation & TestFlight Distribution

1. **Configure Code Signing:**
   - In Xcode, go to the **App** target → **Signing & Capabilities**.
   - Check **Automatically manage signing**.
   - Select your **Apple Developer Team**.
2. **Assets Generation:**
   To automate generating all splash screens and icons from single source files, use the `@capacitor/assets` tool:
   ```bash
   npm install @capacitor/assets --save-dev
   npx capacitor-assets generate --ios
   ```
3. **Compile the Archive:**
   - Set the build target in Xcode to **Any iOS Device (arm64)**.
   - Increment the Build number (e.g., Version `1.0.0`, Build `1`).
   - Run **Product** → **Archive**.
4. **Upload to App Store Connect:**
   - Once archived, click **Distribute App** in Xcode's Organizer.
   - Choose **App Store Connect** → **Upload**.
   - Complete the wizard. Xcode will sign, package, and upload your `.ipa` binary.
5. **Distribute via TestFlight:**
   - Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com/).
   - Click your app and go to the **TestFlight** tab.
   - Set up an **Internal Testing** group (allows up to 100 team members to test builds immediately).
   - Set up an **External Testing** group (requires brief Apple beta review, allows up to 10,000 users).

---

## Phase 7: App Review & Submission Strategy

Apple reviewers must be able to log in and inspect all parts of your app. If they cannot sign in, the app will be rejected instantly.

### 1. Reviewer Credentials & Verification Bypass
KULA has an onboarding gate (`InviteGate.tsx`) requiring a 6-character invitation code.
* **Review Account Preparation**:
  - Create a special sandbox test account in Firestore (e.g., `reviewer@kula.app`).
  - Pre-configure this user profile in the database with `hasCompletedOnboarding: true` or seed it with the invite status approved, so the reviewer bypasses the `InviteGate` directly on log in.
  - Alternatively, explicitly write in the App Review Notes: 
    > *"To bypass the invite screen, enter the verification code **TESTER**."* (This code is hardcoded in `InviteGate.tsx` to automatically resolve Alice Neighbor as the host and bypass the invite check).
* Provide valid test Google/Apple account logins in the reviewer comments if the app defaults to native social login.

### 2. Guidelines to Monitor During Review
* **UGC (User Generated Content) Policy (Guideline 1.2)**: Since neighbors can post items, images, and chat, Apple requires:
  - A mechanism to filter/block abusive users.
  - A mechanism to report/flag inappropriate content (e.g., a "Report Post" button).
  - A commitment that the creators will moderate and remove offending content within 24 hours.
  - *Recommendation*: Implement a simple "Report" button on the `ItemDetailsSheet` that marks posts as `flagged` in Firestore before submitting to the App Store.

---

## 🛠️ Launch Task List (Code Modifications Checklist)

To proceed with this plan, we should execute the following code changes:

- [ ] Add `@capacitor/ios` to `package.json` dependencies.
- [ ] Configure `Info.plist` with GPS and Media usage descriptions.
- [ ] Add Native Social Login plugins (`@capacitor-community/google-auth` & `@capacitor-community/apple-sign-in`).
- [ ] Adjust `src/hooks/useAuth.tsx` to handle native authorization flows for Google and Apple.
- [ ] Integrate a simple "Report Post" action button on the feed items for UGC compliance.
- [ ] Generate native iOS icons and splash screens.
