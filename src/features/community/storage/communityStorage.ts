// src/features/community/storage/communityStorage.ts
// Community Feed — Phase 2: Community Network

import { Platform } from 'react-native';

// ─── Types ───────────────────────────────────────────────────────────────────

export type PostType = 'alert' | 'resource' | 'wellness' | 'volunteer';
export type ThermalLevel = 1 | 2 | 3 | 4 | 5;

export interface CommunityPost {
  id: string;
  type: PostType;
  title: string;
  body: string;
  author: string;
  neighborhood: string;
  thermalLevel: ThermalLevel;
  timestamp: number;
  reactions: {
    helpful: number;
    onMyWay: number;
  };
  userReacted?: 'helpful' | 'onMyWay' | null;
  resolved: boolean;
  location?: string;
}

// ─── Storage Adapter ─────────────────────────────────────────────────────────

const STORAGE_KEY = 'heatguard:community_posts';

function storageGet(key: string): string | null {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  try {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV();
    return storage.getString(key) ?? null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch {}
    return;
  }
  try {
    const { MMKV } = require('react-native-mmkv');
    const storage = new MMKV();
    storage.set(key, value);
  } catch {}
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_POSTS: CommunityPost[] = [
  {
    id: 'seed_1',
    type: 'alert',
    title: 'Asphalt burn hazard — Mill Ave sidewalk',
    body: 'Ground temp over 180°F near the bus stop. Feet and pets at serious risk. Avoid bare feet or sandals.',
    author: 'Maria C.',
    neighborhood: 'Tempe Downtown',
    thermalLevel: 4,
    timestamp: Date.now() - 25 * 60 * 1000,
    reactions: { helpful: 14, onMyWay: 0 },
    resolved: false,
    location: 'Mill Ave & 5th St',
  },
  {
    id: 'seed_2',
    type: 'resource',
    title: 'Free water bottles — Apache Blvd Library',
    body: 'Dropping off 2 cases of water at the library entrance. First come, no sign-up needed. Come grab some.',
    author: 'James T.',
    neighborhood: 'Tempe',
    thermalLevel: 2,
    timestamp: Date.now() - 52 * 60 * 1000,
    reactions: { helpful: 31, onMyWay: 6 },
    resolved: false,
    location: 'Tempe Public Library, Apache Blvd',
  },
  {
    id: 'seed_3',
    type: 'volunteer',
    title: 'Checked on Mr. Rivera (84) — all good',
    body: 'Stopped by for afternoon check. He\'s comfortable, AC working, has water and food. Will check again tomorrow.',
    author: 'Sarah K.',
    neighborhood: 'South Tempe',
    thermalLevel: 1,
    timestamp: Date.now() - 1.5 * 60 * 60 * 1000,
    reactions: { helpful: 8, onMyWay: 0 },
    resolved: true,
  },
  {
    id: 'seed_4',
    type: 'alert',
    title: 'AC out at Riverside Apartments, Bldg C',
    body: 'Central AC failed early this morning. Maintenance says 4-6 hours. Elderly residents on floors 3-5 need check-ins ASAP.',
    author: 'Tenant Manager',
    neighborhood: 'Riverside District',
    thermalLevel: 5,
    timestamp: Date.now() - 3 * 60 * 60 * 1000,
    reactions: { helpful: 42, onMyWay: 11 },
    resolved: false,
    location: '1240 Riverside Dr, Bldg C',
  },
  {
    id: 'seed_5',
    type: 'wellness',
    title: '12 neighbors checked in this morning',
    body: 'Morning wellness round complete on Maple St corridor. Everyone doing well. Next round at 3pm.',
    author: 'HeatGuard Volunteer',
    neighborhood: 'Maple District',
    thermalLevel: 1,
    timestamp: Date.now() - 4.5 * 60 * 60 * 1000,
    reactions: { helpful: 19, onMyWay: 0 },
    resolved: true,
  },
  {
    id: 'seed_6',
    type: 'resource',
    title: 'AC space available — Casa Blanca Rec Center',
    body: 'We have 40 open seats in the main hall. Clean, cool (70°F), water provided. Open until 9pm tonight.',
    author: 'Casa Blanca Staff',
    neighborhood: 'West Chandler',
    thermalLevel: 3,
    timestamp: Date.now() - 6 * 60 * 60 * 1000,
    reactions: { helpful: 67, onMyWay: 23 },
    resolved: false,
    location: '411 N Alma School Rd',
  },
];

// ─── API ─────────────────────────────────────────────────────────────────────

export function loadPosts(): CommunityPost[] {
  const raw = storageGet(STORAGE_KEY);
  if (!raw) {
    // First launch — persist seed data
    storageSet(STORAGE_KEY, JSON.stringify(SEED_POSTS));
    return SEED_POSTS;
  }
  try {
    return JSON.parse(raw) as CommunityPost[];
  } catch {
    return SEED_POSTS;
  }
}

export function savePosts(posts: CommunityPost[]): void {
  storageSet(STORAGE_KEY, JSON.stringify(posts));
}

export function addPost(post: Omit<CommunityPost, 'id' | 'timestamp' | 'reactions' | 'resolved'>): CommunityPost {
  const posts = loadPosts();
  const newPost: CommunityPost = {
    ...post,
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
    reactions: { helpful: 0, onMyWay: 0 },
    resolved: false,
  };
  savePosts([newPost, ...posts]);
  return newPost;
}

export function reactToPost(
  postId: string,
  reaction: 'helpful' | 'onMyWay'
): CommunityPost[] {
  const posts = loadPosts();
  const updated = posts.map((p) => {
    if (p.id !== postId) return p;
    const alreadyReacted = p.userReacted === reaction;
    return {
      ...p,
      reactions: {
        ...p.reactions,
        [reaction]: alreadyReacted
          ? p.reactions[reaction] - 1
          : p.reactions[reaction] + 1,
      },
      userReacted: alreadyReacted ? null : reaction,
    };
  });
  savePosts(updated);
  return updated;
}

export function resolvePost(postId: string): CommunityPost[] {
  const posts = loadPosts().map((p) =>
    p.id === postId ? { ...p, resolved: true } : p
  );
  savePosts(posts);
  return posts;
}

export function getPostsByType(type: PostType | 'all'): CommunityPost[] {
  const posts = loadPosts();
  if (type === 'all') return posts;
  return posts.filter((p) => p.type === type);
}
