export interface LookoutRule {
  id: string;
  type?: 'ALL' | ItemType;
  keyword: string;
  reachTypes?: KulaReachType[];
  radius?: number; // in km
  targetCircles?: string[];
  privacy?: 'PUBLIC' | 'PRIVATE';
}

export interface StandbyRule {
  id: string;
  keyword: string;
  reachTypes?: KulaReachType[];
  radius?: number; // in km
  targetCircles?: string[];
  privacy?: 'PUBLIC' | 'PRIVATE';
}

export type ItemType = 'ASK' | 'SHARE' | 'IMECE' | 'MISSION' | 'JOIN' | 'CIRCLE_INVITE';
export type ItemStatus = 'ACTIVE' | 'MATCHED' | 'COMPLETED' | 'ARCHIVED';
export type KulaReachType = 'VICINITY' | 'ALL_CIRCLES' | 'SPECIFIC_CIRCLES';

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string | null;
  bio: string;
  location?: { lat: number; lng: number };
  rating: number;
  reviewCount: number;
  createdAt: any;
  isAdmin: boolean;
  isOrganization?: boolean;
  isVerified?: boolean;
  orgType?: 'SHELTER' | 'CHARITY' | 'SOCIAL_ENTERPRISE' | 'OTHER';
  instagramHandle?: string;
  defaultReach?: KulaReachType[];
  joinedCircles?: string[];
  preferredLanguage?: string;
  blockedUsers?: string[];
  lookoutFor?: string[]; // Legacy
  thePersonFor?: string[]; // Legacy
  lookoutRules?: LookoutRule[];
  standbyRules?: StandbyRule[];
  hasCompletedOnboarding?: boolean;
  hasCompletedInteractiveTour?: boolean;
  hasCompletedSearchTour?: boolean;
  hasCompletedPostTour?: boolean;
  inviteCode?: string;
  hostId?: string; // UID of the parent who invited them
  hostStatus?: 'PENDING' | 'APPROVED' | 'NONE'; 
  trustMosaic?: TrustMosaic;
}

export interface Item {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  type: ItemType;
  category: string;
  images: string[];
  status: ItemStatus;
  location: { lat: number; lng: number };
  isFeatured: boolean;
  reachTypes: KulaReachType[];
  targetCircles?: string[];
  circleId?: string; // Legacy field for specific circle posts if any
  ownerIsOrganization?: boolean;
  ownerName?: string;
  ownerPhoto?: string;
  createdAt: any;
  distance?: number; // Calculated field
  participants?: string[]; // For IMECE: UIDs of participants
  neededParticipants?: number; // For IMECE: Target number of people
  expiresAt?: any; // For ASK, SHARE
  eventTime?: any; // For JOIN, IMECE, MISSION
  eventEndTime?: any; // Optional end time
}

export interface Circle {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  privacy: 'PUBLIC' | 'PRIVATE' | 'HIDDEN';
  isOrganizationLed?: boolean;
  memberCount: number;
  photoURL?: string;
  createdAt: any;
}

export interface Swipe {
  id: string;
  itemId: string;
  swiperId: string;
  ownerId: string;
  type: 'LIKE' | 'PASS';
  createdAt: any;
}

export interface Chat {
  id: string;
  participants: string[];
  itemId?: string;
  circleId?: string;
  type: 'DIRECT' | 'CHANNEL';
  channelName?: string;
  lastMessage: string;
  updatedAt: any;
  archivedBy?: string[];
  unreadBy?: string[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  text: string;
  type?: 'TEXT' | 'POLL' | 'SYSTEM' | 'URGENT';
  replyToId?: string;
  replyToText?: string;
  replyToName?: string;
  replyCount?: number;
  metadata?: {
    claimedBy?: string;
    claimedByName?: string;
    status?: 'PENDING' | 'RESOLVED' | 'CLAIMED';
  };
  poll?: {
    question: string;
    options: {
      [key: string]: {
        text: string;
        votes: string[]; // uids
      };
    };
  };
  createdAt: any;
}

export interface Review {
  id: string;
  reviewerId: string;
  revieweeId: string;
  itemId: string;
  rating: number;
  comment: string;
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  content: string;
  isRead: boolean;
  link: string;
  createdAt: any;
}

// Trust Engine Types
export type GrowthStage = 'SEEDLING' | 'SPROUT' | 'TREE' | 'OLD_GROWTH' | 'ELDER';

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

export interface TrustMosaic {
  completedExchanges: number;
  imeceParticipations: number;
  circleCount: number;
  vouchCount: number;
  memberSince: any;
}
