# KULA One-Time Invitation System Design

In KULA, trust is a sacred circle. Currently, users have a single static, reusable `inviteCode` (e.g. `DF5K8A`) stored on their profile document. If this code is leaked online, anyone can join, diluting the trust network.

To preserve intimacy and neighborhood safety, we propose moving to **one-time consumable invitation codes**. This document evaluates two design patterns for this transition.

---

## 🚦 Design Options at a Glance

| Feature | Option A: Auto-Regenerating Code | Option B: Multi-Code Subcollection |
| :--- | :--- | :--- |
| **Concept** | Alice has *one* code. Once used, it vanishes and a *new* code takes its place. | Alice generates *unique* codes from a pool. Each code is a separate ticket. |
| **DB Complexity** | 🟢 Low (Modifies `users` profile document only) | 🟡 Medium (New `invites` root or sub-collection) |
| **UX Cleanliness** | 🟡 Medium (Shared codes can expire unexpectedly) | 🟢 High (Precise control; list of pending vs used) |
| **Trust Lineage** | Simple parent-child link | Rich tracking (Created vs used timestamps, custom notes) |
| **Audit Trails** | Standard | High (Can trace invite links and expirations) |

---

## Option A: Auto-Regenerating Single Code

### How it Works
1. Alice's profile stores a single `inviteCode: "ABCXYZ"`.
2. When Bob signs up and inputs `"ABCXYZ"`, the app verifies it against Alice's profile.
3. Upon Bob's successful registration, a Firestore batch update:
   * Approves Bob's profile (`hostId: Alice.uid`, `hostStatus: "APPROVED"`).
   * **Regenerates Alice's code** to a new random sequence: `inviteCode: "LMNOPQ"`.
4. If Charlie attempts to use `"ABCXYZ"` five minutes later, it fails because Alice's code has changed.

### Firestore Write Batch (Mock)
```typescript
import { writeBatch, doc, arrayUnion } from 'firebase/firestore';

const registerUserWithRegen = async (bobUid: string, hostUid: string) => {
  const batch = writeBatch(db);
  const newInviteCode = generateRandomCode(); // e.g. "LMNOPQ"

  // 1. Create Bob's profile
  batch.set(doc(db, 'users', bobUid), {
    hostId: hostUid,
    hostStatus: 'APPROVED',
    onboardingStep: 'PHILOSOPHY',
  });

  // 2. Cycle Alice's code
  batch.update(doc(db, 'users', hostUid), {
    inviteCode: newInviteCode,
    invitedNeighborsCount: increment(1)
  });

  await batch.commit();
};
```

---

## Option B: Multi-Code Subcollection (Recommended)

Instead of sharing a cycled code, Alice generates distinct individual invitations. This matches the behavior of secure grassroots networks.

### How it Works
1. Alice's profile no longer holds a public `inviteCode`.
2. A new root-level collection `invites` is created.
3. When Alice wants to invite Bob, she taps **"Generate Invite Code"**. The app creates a document:
   ```typescript
   interface Invitation {
     code: string;          // Unique 6-character key (e.g. "KULA-99")
     createdBy: string;     // Alice's UID
     status: 'PENDING' | 'USED' | 'EXPIRED';
     usedBy?: string;       // Bob's UID once accepted
     createdAt: FieldValue;
     usedAt?: FieldValue;
     memo?: string;         // e.g. "For Bob from the bakery"
   }
   ```
4. Bob registers using the code. The system marks that specific document as `status: 'USED'` and links Bob to Alice as his host.

### Database Rules & Validation
We use Firestore security rules to prevent race conditions (two people claiming the same code at once):
* A code doc can only be modified if its current `status == 'PENDING'`.
* A write must update `status` to `'USED'` and supply `usedBy` matching the request's auth UID.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /invites/{inviteId} {
      allow read: if true; // Guest needs to read code status before sign up
      allow create: if request.auth != null; // Registered users can make codes
      allow update: if request.auth != null 
                    && resource.data.status == 'PENDING'
                    && request.resource.data.status == 'USED'
                    && request.resource.data.usedBy == request.auth.uid;
    }
  }
}
```

---

## 🚀 UX Impact & Vibe

KULA's visual tone is unpolished, analog, and neighborhood-focused. 

With **Option B (Multi-Code Pool)**, we can build a beautiful "Invite Screen" inside the [Profile.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/Profile.tsx) settings:
* Displays a physical "Stack of Invites" (styled like hand-torn paper cards or vintage raffle tickets).
* Shows active codes Bob can share, labeled with a custom note (e.g., *"Reserved for Alice from the community garden"*).
* Shows accepted tickets with the neighbor's avatar and the date they joined, making the trust lineage transparent and rewarding.

---

### Implementation Task Plan (If Option B is chosen)

- [ ] Remove `inviteCode` generation from [useAuth.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/hooks/useAuth.tsx#L186) registration block.
- [ ] Create `invites` root collection schema and rules in `firestore.rules`.
- [ ] Refactor [InviteGate.tsx](file:///Users/serdar/ANTIGRAVITY/KULA/src/components/InviteGate.tsx#L64-L104) to look up the code inside `/invites` collection instead of querying `/users`.
- [ ] Implement confirmation handshake in `InviteGate.tsx` using a transaction that locks the invite code document.
- [ ] Add an "Invite Neighbors" management console on the user's profile page.
