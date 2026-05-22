/**
 * FILE: types.ts
 * ROLE IN KULA: The "Data Dictionary" — defines the shape of every object in the system.
 * 
 * WHY THIS MATTERS:
 * TypeScript interfaces are like blueprints. When you see `UserProfile` used in useAuth.tsx,
 * or `Item` used in useItems.ts, they all point back HERE. If you change a field here,
 * every file that uses that type will immediately show errors — this is a safety net.
 * 
 * HOW TO READ THIS FILE:
 * Each interface below maps 1:1 to a Firestore collection. For example:
 *   - `UserProfile` → the `users` collection in Firestore
 *   - `Item` → the `items` collection
 *   - `Circle` → the `circles` collection
 * 
 * The fields marked with `?` (optional) are fields that may or may not exist on a document.
 * This happens because features were added incrementally — early users won't have newer fields.
 */

// ═══════════════════════════════════════════════════════════════
// LOOKOUT & STANDBY: The "Radar" System
// ═══════════════════════════════════════════════════════════════
// These rules let users say "Notify me when someone posts X."
// For example: a LookoutRule with keyword "drill" means 
// "I'm looking for someone sharing a drill."
// Used by: Discovery.tsx (SearchOverlay reads these to show saved searches)

export interface LookoutRule {
  id: string;
  type?: 'ALL' | ItemType;          // Filter by item type (ASK, SHARE, etc.) or all
  keyword: string;                   // The search term to watch for
  reachTypes?: KulaReachType[];      // Geographic/circle scope of the watch
  radius?: number;                   // in km — how far to look
  targetCircles?: string[];          // Specific circles to monitor
  privacy?: 'PUBLIC' | 'PRIVATE';    // Whether others can see what you're looking for
}

/**
 * StandbyRule: The opposite of Lookout.
 * "I HAVE a drill, notify me when someone NEEDS one."
 * Used by: Discovery.tsx for matching Shares to Asks.
 */
export interface StandbyRule {
  id: string;
  keyword: string;
  reachTypes?: KulaReachType[];
  radius?: number; // in km
  targetCircles?: string[];
  privacy?: 'PUBLIC' | 'PRIVATE';
}

// ═══════════════════════════════════════════════════════════════
// CORE ENUMS: The vocabulary of KULA
// ═══════════════════════════════════════════════════════════════

/**
 * ItemType: The five fundamental actions a user can take.
 * - ASK: "I need something" (e.g., "Does anyone have a ladder?")
 * - SHARE: "I have something to give" (e.g., "Free sourdough starter!")
 * - IMECE: A Turkish concept — collective community labor (e.g., "Help me paint my room, 5 people needed")
 * - MISSION: A longer-term community goal (e.g., "Clean up the park this month")
 * - JOIN: An event invitation (e.g., "Potluck dinner on Saturday")
 * - CIRCLE_INVITE: A special type for inviting someone into a community circle
 * 
 * Used by: PostItem.tsx (creation), Explore.tsx (filtering), useItems.ts (queries)
 */
export type ItemType = 'ASK' | 'SHARE' | 'IMECE' | 'MISSION' | 'JOIN' | 'CIRCLE_INVITE' | 'FLOW';

/**
 * SharingMode: Transaction/sharing optionalities for ASK and SHARE posts.
 * - GIFT: Giveaway (for SHARE) or Keep (for ASK)
 * - LEND: Borrow/lend expectation (offering a lend)
 * - BORROW: Requesting to borrow
 * - SKILL: Offering/requesting a skill share
 * - FAVOR: Favor / Need a hand (acts of kindness)
 */
export type SharingMode = 'GIFT' | 'LEND' | 'BORROW' | 'SKILL' | 'FAVOR';

/**
 * ItemStatus: The lifecycle of a post.
 * ACTIVE → MATCHED (someone responded) → COMPLETED (exchange happened) → ARCHIVED
 * 
 * MATCHED triggers the GratitudeFlow.tsx — prompting the user to say "thank you."
 * COMPLETED increments the user's TrustMosaic.completedExchanges counter.
 */
export type ItemStatus = 'ACTIVE' | 'MATCHED' | 'COMPLETED' | 'ARCHIVED';

/**
 * KulaReachType: How far should a post travel?
 * - VICINITY: Only people physically nearby (uses GPS from useGeolocation.ts)
 * - ALL_CIRCLES: Broadcast to every circle the user belongs to
 * - SPECIFIC_CIRCLES: Only show in selected circles
 * 
 * This is the "Volume Knob" of KULA — it controls how wide your voice carries.
 * Used by: useItems.ts for filtering, PostItem.tsx for the reach selector UI.
 */
export type KulaReachType = 'VICINITY' | 'ALL_CIRCLES' | 'SPECIFIC_CIRCLES';

/**
 * TrustPrivacyLevel: Customizable trust-network scope for profiles, maps, and feed posts.
 * From strictly private to public.
 */
export type TrustPrivacyLevel = 'PRIVATE' | 'DEGREE_1' | 'DEGREE_2' | 'DEGREE_3' | 'DEGREE_4' | 'PUBLIC';

export interface UserPrivacySettings {
  profileVisibility: TrustPrivacyLevel;       // Who can see profile details & lineage tree
  neighborhoodVisibility: TrustPrivacyLevel;  // Who can see neighborhood centers on maps & feeds
  historyVisibility: TrustPrivacyLevel;       // Who can see gratitude/vouch/exchange history
  lineageVisibility: TrustPrivacyLevel;       // Who can see node position in vertical invite chains
  hideAsConnector?: boolean;                  // Optional: hide identity as connector in trust paths (show as "Hidden")
}

// ═══════════════════════════════════════════════════════════════
// USER PROFILE: The identity of every community member
// ═══════════════════════════════════════════════════════════════

/**
 * UserProfile: Every person in KULA has one of these.
 * Created automatically the first time they log in (see useAuth.tsx → onAuthStateChanged).
 * Stored in: Firestore → `users/{uid}`
 * 
 * KEY RELATIONSHIPS:
 *   - `hostId` points to the UID of the person who INVITED this user.
 *     This creates the "Lineage Tree" — a chain of trust. See useTrustNetwork.ts.
 *   - `hostStatus` is the gatekeeper field. Until the host APPROVES you,
 *     App.tsx will lock you in WaitingRoom.tsx.
 *   - `joinedCircles` is an array of circle IDs. This determines which
 *     channels you see in Circles.tsx and which items you see in useItems.ts.
 *   - `trustMosaic` is a summary of your community participation.
 *     It's displayed visually in TrustMosaic.tsx on your profile.
 *   - `visibilityPreference` controls who can see you in the network.
 *     This is enforced by trustGraph.ts → checkSymmetricVisibility().
 */
export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  location?: { lat: number; lng: number };     // Set during onboarding or from GPS
  rating: number;                                // Average from reviews (0-5)
  reviewCount: number;                           // How many reviews received
  createdAt: any;                                // Firestore Timestamp
  isAdmin: boolean;                              // Admins bypass InviteGate, can moderate
  isOrganization?: boolean;                      // Orgs get a different avatar style (shapes vs avataaars)
  isVerified?: boolean;                          // Manual verification by admin
  orgType?: 'SHELTER' | 'CHARITY' | 'SOCIAL_ENTERPRISE' | 'OTHER';
  instagramHandle?: string;                      // Used by App.tsx for "Link in Bio" resolution
  defaultReach?: KulaReachType[];                // Default reach when creating new posts
  joinedCircles?: string[];                      // Array of circle IDs — determines content visibility
  preferredLanguage?: string;                    // Used by geminiService.ts for auto-translation
  blockedUsers?: string[];                       // UIDs of blocked users — filtered out in useItems.ts
  lookoutFor?: string[];                         // Legacy: old keyword-based search (replaced by LookoutRule)
  thePersonFor?: string[];                       // Legacy: old standby system (replaced by StandbyRule)
  lookoutRules?: LookoutRule[];                  // Active "I'm looking for X" rules
  standbyRules?: StandbyRule[];                  // Active "I have X if anyone needs it" rules
  hasCompletedOnboarding?: boolean;              // Legacy — kept for backward compat; new flow uses onboardingStep
  onboardingStep?: 'INVITED' | 'PENDING' | 'PHILOSOPHY' | 'HOWTO' | 'CIRCLES' | 'PROFILE' | 'FIRST_ACT' | 'COMPLETE' | null;
                                                   // State machine for the Storied Journey onboarding flow
  skippedFirstAct?: boolean;                      // True if they skipped the initial posting prompt during onboarding
  hasCompletedInteractiveTour?: boolean;         // If false, TourGuide.tsx shows tutorial overlays
  hasCompletedSearchTour?: boolean;              // Tour for the search feature
  hasCompletedPostTour?: boolean;                // Tour for the posting feature
  inviteCode?: string;                           // 6-char code others enter in InviteGate.tsx to join under you
  hostId?: string;                               // UID of the parent who invited them → creates Lineage Tree
  hostStatus?: 'PENDING' | 'APPROVED' | 'NONE'; // Gate: PENDING = WaitingRoom, APPROVED = full access
  trustMosaic?: TrustMosaic;                     // Participation stats displayed in TrustMosaic.tsx
  visibilityPreference?: 'PUBLIC' | 'NETWORK' | 'DEGREE_4' | 'DEGREE_3' | 'DEGREE_2' | 'DEGREE_1';
                                                 // Privacy: who can see your profile in the network
  privacySettings?: UserPrivacySettings;         // Granular trust network privacy configurations
  // ── Neighborhood Privacy Boundary ──
  // These fields power the randomized circle that protects the user's exact home address.
  // - exactHomeLocation: the REAL coordinates (private, never exposed to other users)
  // - neighborhoodCenter: the OFFSET center (public, used for map pins and distance calc)
  // - neighborhoodRadius: user-chosen radius in meters (500, 1000, or 2000)
  exactHomeLocation?: { lat: number; lng: number };  // Private — real home coordinates
  neighborhoodCenter?: { lat: number; lng: number };  // Public — offset center of neighborhood circle
  neighborhoodRadius?: number;                        // Radius in meters (default: 1000)
  neighborhoodName?: string;                          // Free-text name of the district/neighborhood (entered during onboarding)

  // ── Address Book ──
  // A list of user-defined saved locations (e.g. "Home", "Work", "Parents").
  // Each entry stores private exact coordinates + a public randomized center.
  // Used by PostItem.tsx to let users choose WHERE a post is pinned,
  // instead of always relying on live GPS or the single "home" location.
  savedLocations?: SavedLocation[];
}

/**
 * SavedLocation: A single entry in the user's address book.
 * Each location has its OWN privacy-offset center and radius, so the user
 * can have different privacy zones for different places.
 *
 * PRIVACY: exactLocation is NEVER shared with other users. Only neighborhoodCenter
 * is used for public display (map pins, distance calculations).
 *
 * USED BY: Profile.tsx (CRUD), PostItem.tsx (location picker)
 */
export interface SavedLocation {
  id: string;                           // Unique identifier (generated client-side)
  label: string;                        // User-defined label (e.g. "Home", "Work", "My Garden")
  exactLocation: { lat: number; lng: number };     // Private — real coordinates
  neighborhoodCenter: { lat: number; lng: number }; // Public — randomized offset center
  neighborhoodRadius: number;           // Privacy radius in meters (500, 1000, or 2000)
  isDefault?: boolean;                  // If true, this is the primary "My Neighborhood" location
}

// ═══════════════════════════════════════════════════════════════
// ITEM: A post in the community feed
// ═══════════════════════════════════════════════════════════════

/**
 * Item: The core content unit. Every ASK, SHARE, IMECE, MISSION, JOIN is an Item.
 * Created by: PostItem.tsx
 * Queried by: useItems.ts (which feeds Explore.tsx, Discovery.tsx, Feed.tsx)
 * Displayed by: ItemDetailsSheet.tsx (the detail overlay when you tap a card)
 * Stored in: Firestore → `items/{itemId}`
 * 
 * KEY RELATIONSHIPS:
 *   - `ownerId` links to a UserProfile.uid. This is how we show the poster's name/photo.
 *   - `category` maps to artDirection.ts → getFallbackImage(). If `images[]` is empty,
 *     the category determines which warm Unsplash photo appears instead.
 *   - `reachTypes` + `targetCircles` together determine WHO sees this item.
 *     This is the main filter in useItems.ts.
 *   - `participants[]` is used for IMECE items — it tracks who has volunteered.
 *   - `location` is set from useGeolocation.ts at post time. It's used by
 *     useItems.ts → getDistance() to sort items by physical proximity.
 */
export interface Item {
  id: string;
  ownerId: string;                    // The poster's UID → links to UserProfile
  title: string;
  description: string;
  type: ItemType;                     // ASK, SHARE, IMECE, etc.
  sharingMode?: SharingMode;          // Transaction/sharing expectations (GIFT, LEND, etc.)
  category: string;                   // "Food", "Equipment", etc. → maps to artDirection.ts fallbacks
  images: string[];                   // User-uploaded photos. If empty, getFallbackImage(category) is used.
  status: ItemStatus;                 // ACTIVE → MATCHED → COMPLETED → ARCHIVED
  location: { lat: number; lng: number }; // GPS coordinates at time of posting
  isFeatured: boolean;                // Admin can feature items for visibility boost
  reachTypes: KulaReachType[];        // VICINITY, ALL_CIRCLES, SPECIFIC_CIRCLES
  visibilityReach?: TrustPrivacyLevel; // Trust graph propagation level ('PRIVATE' to 'PUBLIC')
  targetCircles?: string[];           // If reachType includes SPECIFIC_CIRCLES, which ones?
  circleId?: string;                  // Legacy field for posts tied to a single circle
  ownerIsOrganization?: boolean;      // Cached from owner's profile for display purposes
  ownerName?: string;                 // Cached — avoids extra DB lookup in feed rendering
  ownerPhoto?: string;                // Cached — same reason
  createdAt: any;                     // Firestore Timestamp — used for "newest first" sorting
  distance?: number;                  // CALCULATED client-side by useItems.ts, not stored in DB
  degrees?: number;                   // CALCULATED client-side by useItems.ts: trust connection degree
  participants?: string[];            // For IMECE: UIDs of people who joined the collective action
  neededParticipants?: number;        // For IMECE: "We need 5 people" target
  expiresAt?: any;                    // Auto-archive after this time
  eventTime?: any;                    // For JOIN/IMECE/MISSION: when does the event happen?
  eventEndTime?: any;                 // Optional end time for events
  venueName?: string;                 // For JOIN: custom venue/meeting point name (e.g. "Cafe Kranzler")
}

// ═══════════════════════════════════════════════════════════════
// CIRCLE: A community group (like a Discord server or Slack workspace)
// ═══════════════════════════════════════════════════════════════

/**
 * Circle: A thematic or geographic community group.
 * Created by: any user (via Circles.tsx)
 * Displayed by: Circles.tsx (list view), ChatRoom.tsx (channel view)
 * Stored in: Firestore → `circles/{circleId}` with sub-collection `members/`
 * 
 * RELATIONSHIP: A user's `joinedCircles[]` field in their UserProfile
 * must include this circle's ID for them to see its content.
 */
export interface Circle {
  id: string;
  name: string;
  description: string;
  creatorId: string;                  // UID of the user who created this circle
  privacy: 'PUBLIC' | 'PRIVATE' | 'HIDDEN'; // PUBLIC = anyone can join, HIDDEN = invite only
  isOrganizationLed?: boolean;        // True if an org (shelter, charity) manages this circle
  memberCount: number;                // Cached count for display (avoids counting sub-collection)
  photoURL?: string;                  // Circle's banner image
  createdAt: any;
}

// ═══════════════════════════════════════════════════════════════
// COMMUNICATION: Chats, Messages, and Threads
// ═══════════════════════════════════════════════════════════════

/**
 * Swipe: Records a user's interest (LIKE) or pass on an item.
 * When someone LIKEs an item, chatService.ts → getOrCreateChat() is called
 * to open a direct message with the item's owner.
 */
export interface Swipe {
  id: string;
  itemId: string;                     // Which item they swiped on
  swiperId: string;                   // Who swiped
  ownerId: string;                    // Who owns the item
  type: 'LIKE' | 'PASS';             // LIKE opens a chat, PASS is silent
  createdAt: any;
}

/**
 * Chat: A conversation container. Can be 1:1 (DIRECT) or a group channel.
 * Created by: chatService.ts → getOrCreateChat()
 * Displayed by: ChatsList.tsx (inbox view), ChatRoom.tsx (conversation view)
 * Stored in: Firestore → `chats/{chatId}` with sub-collection `messages/`
 * 
 * KEY DETAIL: `archivedBy` allows individual users to "hide" a chat without
 * deleting it. `unreadBy` tracks who hasn't read the latest message —
 * this powers the badge count in useUnreadCount.ts.
 */
export interface Chat {
  id: string;
  participants: string[];             // Array of UIDs in this conversation
  itemId?: string;                    // If the chat started from an item interaction
  circleId?: string;                  // If this is a circle channel
  type: 'DIRECT' | 'CHANNEL';        // DIRECT = 1:1, CHANNEL = group/circle chat
  channelName?: string;              // e.g., "#General", "#UrgentNeeds"
  lastMessage: string;               // Preview text shown in ChatsList.tsx
  updatedAt: any;                    // Used for sorting chats by recency
  archivedBy?: string[];             // UIDs of users who archived this chat
  unreadBy?: string[];               // UIDs of users who haven't read the latest message
}

/**
 * Message: A single message within a Chat.
 * Stored in: Firestore → `chats/{chatId}/messages/{messageId}`
 * 
 * TYPES:
 *   - TEXT: Normal message
 *   - POLL: Community voting (options with vote arrays)
 *   - SYSTEM: Auto-generated ("Serdar joined the circle")
 *   - URGENT: SOS/emergency messages in #UrgentNeeds channels
 * 
 * THREADING: When `replyToId` is set, this message is part of a Slack-style thread.
 *   The parent message's `replyCount` is incremented. ChatRoom.tsx reads this to
 *   show a "3 replies" indicator, and clicking it opens the thread view.
 */
export interface Message {
  id: string;
  chatId: string;                    // Parent chat this message belongs to
  senderId: string;                  // Who sent it
  senderName?: string;               // Cached for display
  text: string;
  type?: 'TEXT' | 'POLL' | 'SYSTEM' | 'URGENT' | 'INVITE';
  replyToId?: string;                // If replying to a specific message (thread root)
  replyToText?: string;              // Preview of what was replied to
  replyToName?: string;              // Name of the person being replied to
  replyCount?: number;               // How many thread replies this message has
  metadata?: {
    claimedBy?: string;              // For URGENT: who claimed responsibility
    claimedByName?: string;
    status?: 'PENDING' | 'RESOLVED' | 'CLAIMED'; // For URGENT: tracking resolution
  };
  poll?: {                           // POLL type: community voting
    question: string;
    options: {
      [key: string]: {
        text: string;
        votes: string[];             // Array of UIDs who voted for this option
      };
    };
  };
  invite?: {                         // INVITE type: circle sharing
    circleId: string;
    circleName: string;
    circlePhotoURL?: string;
  };
  createdAt: any;
}

// ═══════════════════════════════════════════════════════════════
// REVIEWS & NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Review: After an exchange is COMPLETED, the recipient can leave a review.
 * This increments the reviewed user's `rating` and `reviewCount` in their UserProfile.
 */
export interface Review {
  id: string;
  reviewerId: string;                // Who wrote the review
  revieweeId: string;                // Who is being reviewed
  itemId: string;                    // Which item the exchange was about
  rating: number;                    // 1-5 stars
  comment: string;
  createdAt: any;
}

/**
 * Notification: In-app alerts for the user.
 * Created by: Cloud Functions (functions/index.ts) when events happen.
 * Displayed by: NotificationsOverlay.tsx
 * Counted by: useUnreadCount.ts → drives the badge number in Navigation.tsx
 */
export interface Notification {
  id: string;
  userId: string;                    // Who should see this notification
  type: string;                      // "new_message", "vouch_received", etc.
  content: string;                   // Human-readable text
  isRead: boolean;                   // Toggled when user opens NotificationsOverlay
  link: string;                      // Where to navigate when clicked
  createdAt: any;
}

// ═══════════════════════════════════════════════════════════════
// TRUST ENGINE: The soul of KULA's community model
// ═══════════════════════════════════════════════════════════════

/**
 * GrowthStage: A metaphorical label for how "mature" a community member is.
 * Calculated from their TrustMosaic stats.
 * - SEEDLING: Just joined, 0 exchanges
 * - SPROUT: A few exchanges, starting to participate
 * - TREE: Active contributor
 * - OLD_GROWTH: Pillar of the community
 * - ELDER: Long-standing, deeply trusted
 * 
 * Displayed in: Profile.tsx and TrustMosaic.tsx
 */
export type GrowthStage = 'SEEDLING' | 'SPROUT' | 'TREE' | 'OLD_GROWTH' | 'ELDER';

/**
 * GratitudeNote: A "Thank You" message sent after an exchange.
 * Created by: GratitudeFlow.tsx (triggered when an item moves to COMPLETED)
 * Stored in: Firestore → `gratitude_notes/{noteId}`
 * 
 * FLOW: When you complete an exchange in ItemDetailsSheet.tsx,
 * GratitudeFlow opens → you write a thank-you → it saves here AND
 * increments the recipient's TrustMosaic.completedExchanges.
 */
export interface GratitudeNote {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto?: string;
  toUserId: string;
  itemId: string;
  itemTitle: string;
  text: string;
  createdAt: any;
}

/**
 * TrustMosaic: A dashboard of community participation stats.
 * Stored as a sub-object on UserProfile.
 * Displayed by: TrustMosaic.tsx (visual tiles on the profile page)
 * Updated by: GratitudeFlow.tsx, Circles.tsx (join/leave), Profile.tsx
 * 
 * These numbers determine the user's GrowthStage.
 */
export interface TrustMosaic {
  completedExchanges: number;        // How many ASK/SHARE cycles completed
  imeceParticipations: number;       // How many collective actions participated in
  circleCount: number;               // How many circles the user belongs to
  vouchCount: number;                // How many peer vouches received
  memberSince: any;                  // Timestamp of first login
}

/**
 * Vouch: A peer-to-peer trust endorsement.
 * Created by: PublicProfile.tsx (the "Vouch for this person" button)
 * Stored in: Firestore → `vouches/{vouchId}`
 * 
 * CRITICAL CONNECTION: Vouches create HORIZONTAL links in the trust graph.
 * When useTrustNetwork.ts builds the graph, it queries this collection
 * to draw "Vouch" lines (emerald green) between peers.
 * Invites create VERTICAL links (terracotta) — together they form the full web.
 */
export interface Vouch {
  id: string;
  fromUserId: string;                // Who is vouching
  toUserId: string;                  // Who is being vouched for
  status: 'PENDING' | 'ACCEPTED';   // Must be accepted to appear in the trust graph
  createdAt: any;
}
