import haptics from '../../src/utils/haptics';
import { SkeletonThermalCard, SkeletonInfoCard, SkeletonPostRow, SkeletonForecastRow } from '../../src/components/ui/Skeleton';
import AnimatedEntrance from '../../src/components/ui/AnimatedEntrance';
import PressableScale from '../../src/components/ui/PressableScale';
// app/(tabs)/community.tsx
// Community Hub — Phase 2: Community Network
// Sections: Activity Feed · Volunteer Check-ins
// Quick Links: Neighbor Network · Resource Board

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  TextInput,
  Modal,
  SafeAreaView,
  Platform,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  loadPosts,
  addPost,
  reactToPost,
  resolvePost,
  getPostsByType,
  type CommunityPost,
  type PostType,
  type ThermalLevel,
} from '../../src/features/community/storage/communityStorage';
import { getNeighborStats, loadNeighbors } from '../../src/features/community/storage/neighborStorage';
import { loadResources } from '../../src/features/community/storage/resourceStorage';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:           '#0A1628',
  surface:      '#1A2540',
  card:         '#1E2D4A',
  border:       '#2A3F5F',
  textPrimary:  '#F8FAFC',
  textSecondary:'#94A3B8',
  textMuted:    '#64748B',
  accent:       '#3B82F6',
  danger:       '#EF4444',
  success:      '#10B981',
  warning:      '#F59E0B',
  purple:       '#8B5CF6',

  thermal: {
    1: '#10B981',
    2: '#F59E0B',
    3: '#F97316',
    4: '#EF4444',
    5: '#7C3AED',
  } as Record<ThermalLevel, string>,

  thermalBg: {
    1: '#052E20',
    2: '#1C1400',
    3: '#1C0A00',
    4: '#1C0000',
    5: '#1A0A2E',
  } as Record<ThermalLevel, string>,
};

// ─── Volunteer Check-in Data (compatible with existing storage) ───────────────

interface VolunteerRequest {
  id: string;
  resident: string;
  address: string;
  age: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'assigned' | 'completed';
  notes: string;
  requestedAt: number;
}

const SAMPLE_REQUESTS: VolunteerRequest[] = [
  { id: 'v1', resident: 'Florence Nakamura', address: '302 E Lemon St, Apt 4A', age: 84, urgency: 'critical', status: 'open',      notes: 'AC unit failed this morning. No family nearby.',           requestedAt: Date.now() - 40 * 60000  },
  { id: 'v2', resident: 'Harold Simmons',    address: '78 N Scottsdale Rd',       age: 77, urgency: 'high',     status: 'open',      notes: 'Diabetic. Missed medication delivery yesterday.',          requestedAt: Date.now() - 2 * 3600000 },
  { id: 'v3', resident: 'Agnes Kowalski',    address: '1450 W Broadway Rd',       age: 91, urgency: 'medium',   status: 'assigned',  notes: 'Wellness check, does well but lives alone.',              requestedAt: Date.now() - 5 * 3600000 },
  { id: 'v4', resident: 'Thomas Osei',       address: '520 S Dobson Rd',          age: 73, urgency: 'low',      status: 'completed', notes: 'Completed. Comfortable, AC on, stocked with water.',       requestedAt: Date.now() - 8 * 3600000 },
  { id: 'v5', resident: 'Martha Delgado',    address: '900 E University Dr',      age: 80, urgency: 'high',     status: 'open',      notes: 'Window AC only, temp inside estimated 88°F.',             requestedAt: Date.now() - 1 * 3600000 },
];

const URGENCY_META = {
  critical: { color: '#7C3AED', bg: '#1A0A2E', label: 'Critical' },
  high:     { color: '#EF4444', bg: '#1C0000', label: 'High'     },
  medium:   { color: '#F97316', bg: '#1C0A00', label: 'Medium'   },
  low:      { color: '#10B981', bg: '#052E20', label: 'Low'      },
} as const;

// ─── Post Type Meta ───────────────────────────────────────────────────────────

const POST_META: Record<PostType, { label: string; color: string; icon: string }> = {
  alert:     { label: 'Alert',     color: '#EF4444', icon: 'warning'          },
  resource:  { label: 'Resource',  color: '#3B82F6', icon: 'cube-outline'     },
  wellness:  { label: 'Wellness',  color: '#10B981', icon: 'heart-outline'    },
  volunteer: { label: 'Volunteer', color: '#F59E0B', icon: 'people-outline'   },
};

const FEED_FILTERS: { key: PostType | 'all'; label: string }[] = [
  { key: 'all',      label: 'All'      },
  { key: 'alert',    label: 'Alerts'   },
  { key: 'wellness', label: 'Wellness' },
  { key: 'resource', label: 'Resources'},
  { key: 'volunteer',label: 'Volunteer'},
];

const VOLUNTEER_FILTERS = ['All', 'Open', 'Assigned', 'Completed'] as const;
type VolunteerFilter = (typeof VOLUNTEER_FILTERS)[number];

// ─── Compose Modal ────────────────────────────────────────────────────────────

interface ComposeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CommunityPost, 'id' | 'timestamp' | 'reactions' | 'resolved'>) => void;
}

function ComposeModal({ visible, onClose, onSubmit }: ComposeModalProps) {
  const [type, setType] = useState<PostType>('alert');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [location, setLocation] = useState('');
  const [thermalLevel, setThermalLevel] = useState<ThermalLevel>(3);

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Required', 'Please add a title and message.');
      return;
    }
    onSubmit({
      type,
      title: title.trim(),
      body: body.trim(),
      author: 'You',
      neighborhood: neighborhood.trim() || 'My Neighborhood',
      thermalLevel,
      location: location.trim() || undefined,
    });
    setTitle(''); setBody(''); setNeighborhood(''); setLocation('');
    setType('alert'); setThermalLevel(3);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={cs.overlay}>
        <ScrollView contentContainerStyle={cs.sheet} keyboardShouldPersistTaps="handled">
          <View style={cs.handle} />
          <Text style={cs.sheetTitle}>Post to Community</Text>

          {/* Type */}
          <Text style={cs.sectionLabel}>Post Type</Text>
          <View style={cs.typeGrid}>
            {(Object.entries(POST_META) as [PostType, typeof POST_META[PostType]][]).map(([t, meta]) => (
              <Pressable
                key={t}
                style={[cs.typeBtn, type === t && { borderColor: meta.color, backgroundColor: meta.color + '22' }]}
                onPress={() => setType(t)}
                accessibilityRole="radio"
                accessibilityState={{ checked: type === t }}
              >
                <Ionicons name={meta.icon as any} size={18} color={type === t ? meta.color : C.textMuted} />
                <Text style={[cs.typeBtnText, type === t && { color: meta.color }]}>{meta.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* Thermal Level */}
          <Text style={cs.sectionLabel}>Heat Severity</Text>
          <View style={cs.thermalRow}>
            {([1, 2, 3, 4, 5] as ThermalLevel[]).map((lvl) => (
              <Pressable
                key={lvl}
                style={[
                  cs.thermalBtn,
                  { backgroundColor: C.thermalBg[lvl], borderColor: C.thermal[lvl] + (thermalLevel === lvl ? 'FF' : '44') },
                  thermalLevel === lvl && cs.thermalBtnSelected,
                ]}
                onPress={() => setThermalLevel(lvl)}
                accessibilityRole="radio"
                accessibilityLabel={`Severity level ${lvl}`}
                accessibilityState={{ checked: thermalLevel === lvl }}
              >
                <Text style={[cs.thermalBtnText, { color: C.thermal[lvl] }]}>{lvl}</Text>
              </Pressable>
            ))}
          </View>

          {/* Text Fields */}
          {[
            { label: 'Title *',        value: title,        setter: setTitle,        placeholder: 'Brief summary of what\'s happening' },
            { label: 'Message *',      value: body,         setter: setBody,         placeholder: 'Details, location info, what people should know...', multiline: true },
            { label: 'Neighborhood',   value: neighborhood, setter: setNeighborhood, placeholder: 'e.g. South Tempe, Chandler' },
            { label: 'Specific Location', value: location,  setter: setLocation,     placeholder: 'Optional: address or landmark' },
          ].map((f) => (
            <View key={f.label} style={cs.fieldBlock}>
              <Text style={cs.fieldLabel}>{f.label}</Text>
              <TextInput
                style={[cs.fieldInput, f.multiline && { height: 80, paddingTop: 10 }]}
                value={f.value}
                onChangeText={f.setter}
                placeholder={f.placeholder}
                placeholderTextColor={C.textMuted}
                multiline={f.multiline}
                accessibilityLabel={f.label}
              />
            </View>
          ))}

          <View style={cs.actions}>
            <Pressable style={cs.cancelBtn} onPress={onClose} accessibilityRole="button">
              <Text style={cs.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={cs.submitBtn}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Post to community"
            >
              <Ionicons name="send" size={15} color="#fff" />
              <Text style={cs.submitText}>Post</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Feed Post Card ───────────────────────────────────────────────────────────

interface FeedCardProps {
  post: CommunityPost;
  onReact: (id: string, reaction: 'helpful' | 'onMyWay') => void;
  onResolve: (id: string) => void;
}

function FeedCard({ post, onReact, onResolve }: FeedCardProps) {
  const meta = POST_META[post.type];
  const thermalColor = C.thermal[post.thermalLevel];
  const thermalBg = C.thermalBg[post.thermalLevel];

  const timeAgo = (() => {
    const diff = Date.now() - post.timestamp;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  })();

  return (
    <View
      style={[cs.feedCard, post.resolved && cs.feedCardResolved]}
      accessibilityRole="none"
      accessibilityLabel={`${post.type} post: ${post.title}`}
    >
      {/* Header Row */}
      <View style={cs.feedCardHeader}>
        <View style={[cs.postTypeTag, { backgroundColor: meta.color + '22', borderColor: meta.color + '66' }]}>
          <Ionicons name={meta.icon as any} size={11} color={meta.color} />
          <Text style={[cs.postTypeTagText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <View style={[cs.thermalTag, { backgroundColor: thermalBg, borderColor: thermalColor + '88' }]}>
          <View style={[cs.thermalDot, { backgroundColor: thermalColor }]} />
          <Text style={[cs.thermalTagText, { color: thermalColor }]}>
            L{post.thermalLevel}
          </Text>
        </View>

        <Text style={cs.feedTime}>{timeAgo}</Text>

        {post.resolved && (
          <View style={cs.resolvedBadge}>
            <Ionicons name="checkmark-circle" size={11} color={C.success} />
            <Text style={cs.resolvedBadgeText}>Resolved</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <Text style={cs.feedTitle}>{post.title}</Text>
      <Text style={cs.feedBody} numberOfLines={3}>{post.body}</Text>

      {post.location && (
        <View style={cs.feedLocation}>
          <Ionicons name="location-outline" size={12} color={C.textMuted} />
          <Text style={cs.feedLocationText} numberOfLines={1}>{post.location}</Text>
        </View>
      )}

      {/* Footer */}
      <View style={cs.feedFooter}>
        <View style={cs.feedAuthorRow}>
          <View style={cs.authorDot} />
          <Text style={cs.feedAuthor}>{post.author}</Text>
          <Text style={cs.feedNeighborhood}>{post.neighborhood}</Text>
        </View>

        <View style={cs.feedReactions}>
          <Pressable
            style={[cs.reactionBtn, post.userReacted === 'helpful' && cs.reactionBtnActive]}
            onPress={() => onReact(post.id, 'helpful')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Mark helpful, ${post.reactions.helpful} reactions`}
          >
            <Ionicons
              name={post.userReacted === 'helpful' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={13}
              color={post.userReacted === 'helpful' ? C.accent : C.textMuted}
            />
            <Text style={[cs.reactionCount, post.userReacted === 'helpful' && { color: C.accent }]}>
              {post.reactions.helpful}
            </Text>
          </Pressable>

          <Pressable
            style={[cs.reactionBtn, post.userReacted === 'onMyWay' && cs.reactionBtnActive]}
            onPress={() => onReact(post.id, 'onMyWay')}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`On my way, ${post.reactions.onMyWay} responses`}
          >
            <Ionicons
              name={post.userReacted === 'onMyWay' ? 'car' : 'car-outline'}
              size={13}
              color={post.userReacted === 'onMyWay' ? C.success : C.textMuted}
            />
            <Text style={[cs.reactionCount, post.userReacted === 'onMyWay' && { color: C.success }]}>
              {post.reactions.onMyWay > 0 ? post.reactions.onMyWay : 'On way'}
            </Text>
          </Pressable>

          {!post.resolved && post.type === 'alert' && (
            <Pressable
              style={cs.resolveBtn}
              onPress={() => onResolve(post.id)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Mark as resolved"
            >
              <Text style={cs.resolveBtnText}>Resolved</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Volunteer Card ───────────────────────────────────────────────────────────

function VolunteerCard({ req }: { req: VolunteerRequest }) {
  const urgMeta = URGENCY_META[req.urgency];
  const timeAgo = (() => {
    const h = Math.floor((Date.now() - req.requestedAt) / 3600000);
    const m = Math.floor((Date.now() - req.requestedAt) / 60000);
    return h >= 1 ? `${h}h ago` : `${m}m ago`;
  })();

  return (
    <View style={[cs.volunteerCard, req.status === 'completed' && { opacity: 0.6 }]}>
      <View style={cs.vCardHeader}>
        <View style={[cs.urgencyBadge, { backgroundColor: urgMeta.bg, borderColor: urgMeta.color + '88' }]}>
          <View style={[cs.urgencyDot, { backgroundColor: urgMeta.color }]} />
          <Text style={[cs.urgencyText, { color: urgMeta.color }]}>{urgMeta.label}</Text>
        </View>
        <Text style={cs.vCardTime}>{timeAgo}</Text>
        {req.status === 'completed' && (
          <View style={cs.completedBadge}>
            <Ionicons name="checkmark-circle" size={11} color={C.success} />
            <Text style={cs.completedText}>Done</Text>
          </View>
        )}
        {req.status === 'assigned' && (
          <View style={cs.assignedBadge}>
            <Text style={cs.assignedText}>Assigned</Text>
          </View>
        )}
      </View>

      <Text style={cs.vResidentName}>{req.resident}</Text>
      <View style={cs.vAddressRow}>
        <Ionicons name="location-outline" size={12} color={C.textMuted} />
        <Text style={cs.vAddress}>{req.address}</Text>
        <Text style={cs.vAge}>{req.age} yrs</Text>
      </View>
      <Text style={cs.vNotes} numberOfLines={2}>{req.notes}</Text>

      {req.status === 'open' && (
        <Pressable
          style={cs.volunteerBtn}
          onPress={() => Alert.alert('Volunteer', `You've signed up to check on ${req.resident}. Please go within the next hour.`)}
          accessibilityRole="button"
          accessibilityLabel={`Volunteer to check on ${req.resident}`}
        >
          <Ionicons name="hand-right-outline" size={14} color={C.bg} />
          <Text style={cs.volunteerBtnText}>I'll Check On Them</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Quick Access Row ─────────────────────────────────────────────────────────

function QuickAccessRow() {
  const neighborStats = useMemo(() => getNeighborStats(loadNeighbors()), []);
  const resourceCount = useMemo(() => loadResources().filter((r) => !r.claimed).length, []);

  return (
    <View style={cs.quickRow}>
      <Pressable
        style={cs.quickCard}
        onPress={() => router.push('/community/neighbor-network')}
        accessibilityRole="button"
        accessibilityLabel={`Neighbor Network, ${neighborStats.needsCheckIn} need check-in`}
      >
        <View style={cs.quickIconWrap}>
          <Ionicons name="people" size={20} color={C.accent} />
          {neighborStats.needsCheckIn > 0 && (
            <View style={cs.quickBadge}>
              <Text style={cs.quickBadgeText}>{neighborStats.needsCheckIn}</Text>
            </View>
          )}
        </View>
        <Text style={cs.quickLabel}>Neighbors</Text>
        <Text style={cs.quickSub}>
          {neighborStats.needsCheckIn > 0
            ? `${neighborStats.needsCheckIn} need check-in`
            : `${neighborStats.total} registered`}
        </Text>
        <Ionicons name="chevron-forward" size={14} color={C.textMuted} style={{ marginTop: 2 }} />
      </Pressable>

      <Pressable
        style={cs.quickCard}
        onPress={() => router.push('/community/resources')}
        accessibilityRole="button"
        accessibilityLabel={`Resource Board, ${resourceCount} available`}
      >
        <View style={cs.quickIconWrap}>
          <Ionicons name="cube" size={20} color={C.success} />
          {resourceCount > 0 && (
            <View style={[cs.quickBadge, { backgroundColor: C.success }]}>
              <Text style={cs.quickBadgeText}>{resourceCount}</Text>
            </View>
          )}
        </View>
        <Text style={cs.quickLabel}>Resources</Text>
        <Text style={cs.quickSub}>{resourceCount} available now</Text>
        <Ionicons name="chevron-forward" size={14} color={C.textMuted} style={{ marginTop: 2 }} />
      </Pressable>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CommunityScreen() {
  const [activeSection, setActiveSection] = useState<'feed' | 'checkins'>('feed');
  const [posts, setPosts] = useState<CommunityPost[]>(() => loadPosts());
  const [feedFilter, setFeedFilter] = useState<PostType | 'all'>('all');
  const [volunteerFilter, setVolunteerFilter] = useState<VolunteerFilter>('All');
  const [showCompose, setShowCompose] = useState(false);

  // Feed data
  const displayedPosts = useMemo(() => {
    const filtered = feedFilter === 'all' ? posts : posts.filter((p) => p.type === feedFilter);
    return [...filtered].sort((a, b) => b.timestamp - a.timestamp);
  }, [posts, feedFilter]);

  const alertCount = useMemo(
    () => posts.filter((p) => p.type === 'alert' && !p.resolved).length,
    [posts]
  );

  // Volunteer data
  const displayedRequests = useMemo(() => {
    switch (volunteerFilter) {
      case 'Open':      return SAMPLE_REQUESTS.filter((r) => r.status === 'open');
      case 'Assigned':  return SAMPLE_REQUESTS.filter((r) => r.status === 'assigned');
      case 'Completed': return SAMPLE_REQUESTS.filter((r) => r.status === 'completed');
      default:          return SAMPLE_REQUESTS;
    }
  }, [volunteerFilter]);

  const openRequestCount = SAMPLE_REQUESTS.filter((r) => r.status === 'open').length;

  const handleCompose = useCallback(
    (data: Omit<CommunityPost, 'id' | 'timestamp' | 'reactions' | 'resolved'>) => {
      addPost(data);
      setPosts(loadPosts());
      setShowCompose(false);
    },
    []
  );

  const handleReact = useCallback((id: string, reaction: 'helpful' | 'onMyWay') => {
    setPosts(reactToPost(id, reaction));
  }, []);

  const handleResolve = useCallback((id: string) => {
    Alert.alert('Mark Resolved', 'Mark this alert as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolved', onPress: () => setPosts(resolvePost(id)) },
    ]);
  }, []);

  return (
    <SafeAreaView style={cs.safe}>
      {/* Header */}
      <View style={cs.header}>
        <View>
          <Text style={cs.headerTitle}>Community</Text>
          <Text style={cs.headerSub}>
            {alertCount > 0 ? `${alertCount} active alert${alertCount > 1 ? 's' : ''}` : 'Your heat network'}
          </Text>
        </View>
        <Pressable
          style={cs.composeHeaderBtn}
          onPress={() => setShowCompose(true)}
          accessibilityRole="button"
          accessibilityLabel="Post to community"
        >
          <Ionicons name="create-outline" size={20} color={C.textPrimary} />
        </Pressable>
      </View>

      {/* Section Tabs */}
      <View style={cs.sectionTabs}>
        {([
          { key: 'feed',     label: 'Activity Feed',    badge: alertCount  },
          { key: 'checkins', label: 'Volunteer',        badge: openRequestCount },
        ] as const).map((tab) => (
          <Pressable
            key={tab.key}
            style={[cs.sectionTab, activeSection === tab.key && cs.sectionTabActive]}
            onPress={() => setActiveSection(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeSection === tab.key }}
          >
            <Text style={[cs.sectionTabText, activeSection === tab.key && cs.sectionTabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge > 0 && (
              <View style={cs.sectionTabBadge}>
                <Text style={cs.sectionTabBadgeText}>{tab.badge}</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Feed Section ── */}
      {activeSection === 'feed' && (
        <>
          {/* Quick Access */}
          <QuickAccessRow />

          {/* Feed Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={cs.filterRow}
          >
            {FEED_FILTERS.map((f) => (
              <Pressable
                key={f.key}
                style={[cs.filterPill, feedFilter === f.key && cs.filterPillActive]}
                onPress={() => setFeedFilter(f.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: feedFilter === f.key }}
              >
                {f.key !== 'all' && (
                  <View
                    style={[
                      cs.filterDot,
                      { backgroundColor: feedFilter === f.key ? '#fff' : POST_META[f.key as PostType].color },
                    ]}
                  />
                )}
                <Text style={[cs.filterPillText, feedFilter === f.key && cs.filterPillTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Posts */}
          <ScrollView
            style={cs.scrollArea}
            contentContainerStyle={cs.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {displayedPosts.length === 0 ? (
              <View style={cs.emptyState}>
                <Ionicons name="megaphone-outline" size={44} color={C.textMuted} />
                <Text style={cs.emptyTitle}>Nothing posted yet</Text>
                <Text style={cs.emptyBody}>
                  Be the first to share a safety update, resource, or wellness check with your neighborhood.
                </Text>
                <Pressable
                  style={cs.emptyActionBtn}
                  onPress={() => setShowCompose(true)}
                  accessibilityRole="button"
                >
                  <Ionicons name="create-outline" size={15} color="#fff" />
                  <Text style={cs.emptyActionText}>Post Something</Text>
                </Pressable>
              </View>
            ) : (
              displayedPosts.map((post) => (
                <FeedCard
                  key={post.id}
                  post={post}
                  onReact={handleReact}
                  onResolve={handleResolve}
                />
              ))
            )}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}

      {/* ── Volunteer Section ── */}
      {activeSection === 'checkins' && (
        <>
          {/* Summary */}
          <View style={cs.volunteerSummary}>
            <View style={cs.volStat}>
              <Text style={[cs.volStatVal, { color: C.danger }]}>{openRequestCount}</Text>
              <Text style={cs.volStatLabel}>Open</Text>
            </View>
            <View style={cs.volStatDivider} />
            <View style={cs.volStat}>
              <Text style={[cs.volStatVal, { color: C.warning }]}>
                {SAMPLE_REQUESTS.filter((r) => r.status === 'assigned').length}
              </Text>
              <Text style={cs.volStatLabel}>Assigned</Text>
            </View>
            <View style={cs.volStatDivider} />
            <View style={cs.volStat}>
              <Text style={[cs.volStatVal, { color: C.success }]}>
                {SAMPLE_REQUESTS.filter((r) => r.status === 'completed').length}
              </Text>
              <Text style={cs.volStatLabel}>Done Today</Text>
            </View>
          </View>

          {openRequestCount > 0 && (
            <View style={cs.volunteerAlert}>
              <Ionicons name="alert-circle" size={14} color={C.danger} />
              <Text style={cs.volunteerAlertText}>
                {openRequestCount} neighbor{openRequestCount > 1 ? 's need' : ' needs'} a volunteer check-in
              </Text>
            </View>
          )}

          {/* Volunteer Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={cs.filterRow}
          >
            {VOLUNTEER_FILTERS.map((f) => (
              <Pressable
                key={f}
                style={[cs.filterPill, volunteerFilter === f && cs.filterPillActive]}
                onPress={() => setVolunteerFilter(f)}
                accessibilityRole="tab"
                accessibilityState={{ selected: volunteerFilter === f }}
              >
                <Text style={[cs.filterPillText, volunteerFilter === f && cs.filterPillTextActive]}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            style={cs.scrollArea}
            contentContainerStyle={cs.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {displayedRequests.map((req) => (
              <VolunteerCard key={req.id} req={req} />
            ))}
            <View style={{ height: 100 }} />
          </ScrollView>
        </>
      )}

      {/* FAB */}
      <Pressable
        style={cs.fab}
        onPress={() => setShowCompose(true)}
        accessibilityRole="button"
        accessibilityLabel="Post to community feed"
      >
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      {/* Compose Modal */}
      <ComposeModal
        visible={showCompose}
        onClose={() => setShowCompose(false)}
        onSubmit={handleCompose}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 8, paddingBottom: 12,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  headerSub: { fontSize: 12, color: C.textMuted, marginTop: 2 },
  composeHeaderBtn: { padding: 8, borderRadius: 10, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },

  // Section Tabs
  sectionTabs: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.border,
    paddingHorizontal: 16, gap: 4,
  },
  sectionTab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingBottom: 12, paddingHorizontal: 4, marginRight: 20,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  sectionTabActive: { borderBottomColor: C.accent },
  sectionTabText: { fontSize: 14, fontWeight: '600', color: C.textMuted },
  sectionTabTextActive: { color: C.textPrimary },
  sectionTabBadge: {
    backgroundColor: C.danger, minWidth: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  sectionTabBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // Quick Access
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  quickCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: C.border,
  },
  quickIconWrap: { position: 'relative', marginBottom: 8, alignSelf: 'flex-start' },
  quickBadge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: C.danger, minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  quickBadgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  quickLabel: { fontSize: 14, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold' },
  quickSub: { fontSize: 11, color: C.textSecondary, marginTop: 2 },

  // Filters
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignSelf: 'flex-start', height: 34,
  },
  filterPillActive: { backgroundColor: C.accent, borderColor: C.accent },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  filterPillText: { fontSize: 12, color: C.textSecondary, fontWeight: '500' },
  filterPillTextActive: { color: '#fff', fontWeight: '600' },

  // Scroll
  scrollArea: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },

  // Feed Card
  feedCard: {
    backgroundColor: C.card, borderRadius: 14, marginBottom: 12,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  feedCardResolved: { opacity: 0.65 },
  feedCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
  postTypeTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  postTypeTagText: { fontSize: 10, fontWeight: '700' },
  thermalTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  thermalDot: { width: 5, height: 5, borderRadius: 3 },
  thermalTagText: { fontSize: 10, fontWeight: '700' },
  feedTime: { fontSize: 11, color: C.textMuted, marginLeft: 'auto' as any },
  resolvedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
    backgroundColor: '#052E20',
  },
  resolvedBadgeText: { fontSize: 10, fontWeight: '600', color: C.success },

  feedTitle: { fontSize: 14, fontWeight: '700', color: C.textPrimary, marginBottom: 4, fontFamily: 'Inter_700Bold' },
  feedBody: { fontSize: 13, color: C.textSecondary, lineHeight: 19, marginBottom: 8 },
  feedLocation: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  feedLocationText: { fontSize: 11, color: C.textMuted, flex: 1 },

  feedFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
  authorDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.accent },
  feedAuthor: { fontSize: 11, color: C.textSecondary, fontWeight: '500' },
  feedNeighborhood: { fontSize: 11, color: C.textMuted },
  feedReactions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    minHeight: 28,
  },
  reactionBtnActive: { borderColor: C.accent, backgroundColor: C.accent + '22' },
  reactionCount: { fontSize: 11, color: C.textMuted, fontWeight: '500' },
  resolveBtn: {
    paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    minHeight: 28, justifyContent: 'center',
  },
  resolveBtnText: { fontSize: 11, color: C.textMuted, fontWeight: '500' },

  // Volunteer
  volunteerSummary: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  volStat: { flex: 1, alignItems: 'center' },
  volStatVal: { fontSize: 28, fontWeight: '800', fontFamily: 'Inter_700Bold' },
  volStatLabel: { fontSize: 11, color: C.textMuted, marginTop: 2 },
  volStatDivider: { width: 1, height: 36, backgroundColor: C.border },
  volunteerAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1C0000', borderWidth: 1, borderColor: '#7F1D1D',
    marginHorizontal: 16, marginTop: 12, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  volunteerAlertText: { color: '#FCA5A5', fontSize: 13, fontWeight: '600' },

  volunteerCard: {
    backgroundColor: C.card, borderRadius: 14, marginBottom: 12,
    padding: 14, borderWidth: 1, borderColor: C.border,
  },
  vCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1,
  },
  urgencyDot: { width: 6, height: 6, borderRadius: 3 },
  urgencyText: { fontSize: 11, fontWeight: '700' },
  vCardTime: { fontSize: 11, color: C.textMuted, marginLeft: 'auto' as any },
  completedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#052E20', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  completedText: { fontSize: 10, color: C.success, fontWeight: '600' },
  assignedBadge: { backgroundColor: '#1C1400', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  assignedText: { fontSize: 10, color: C.warning, fontWeight: '600' },
  vResidentName: { fontSize: 15, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold', marginBottom: 4 },
  vAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  vAddress: { fontSize: 12, color: C.textSecondary, flex: 1 },
  vAge: { fontSize: 11, color: C.textMuted },
  vNotes: { fontSize: 13, color: C.textSecondary, lineHeight: 19, marginBottom: 10 },
  volunteerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F8FAFC', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, alignSelf: 'flex-start', minHeight: 40,
  },
  volunteerBtnText: { fontSize: 13, fontWeight: '700', color: C.bg },

  // Empty State
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.textPrimary, marginTop: 16, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: C.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 },
  emptyActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.accent, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, marginTop: 24,
  },
  emptyActionText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, right: 20, width: 56, height: 56,
    borderRadius: 28, backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },

  // Compose Modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: C.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginBottom: 20,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: C.textPrimary, fontFamily: 'Inter_700Bold', marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 },

  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10,
    backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border,
    minWidth: '45%',
  },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: C.textMuted },

  thermalRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  thermalBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10,
    borderWidth: 1.5,
  },
  thermalBtnSelected: {},
  thermalBtnText: { fontSize: 16, fontWeight: '800', fontFamily: 'Inter_700Bold' },

  fieldBlock: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: C.textSecondary, marginBottom: 6, letterSpacing: 0.3 },
  fieldInput: {
    backgroundColor: C.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
    color: C.textPrimary, fontSize: 14, borderWidth: 1, borderColor: C.border,
    textAlignVertical: 'top',
  },

  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: C.card, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: C.textSecondary },
  submitBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: C.accent,
  },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
