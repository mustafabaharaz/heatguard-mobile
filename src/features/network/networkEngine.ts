// ─────────────────────────────────────────────
// Emergency Network Hub Engine
// Shelter capacity, volunteer dispatch,
// and live status management
// ─────────────────────────────────────────────

export type ShelterStatus = 'open' | 'limited' | 'full' | 'closed';
export type VolunteerSkill = 'medical' | 'transport' | 'hydration' | 'welfare_check' | 'translation' | 'general';
export type DispatchStatus = 'available' | 'en_route' | 'on_site' | 'returning';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

// ─── Shelter ─────────────────────────────────────────────────────────────────

export interface Shelter {
  id: string;
  name: string;
  type: 'cooling_center' | 'emergency_shelter' | 'hospital' | 'community_center';
  address: string;
  district: string;
  status: ShelterStatus;
  capacity: number;
  currentOccupancy: number;
  /** Miles from user */
  distanceMiles: number;
  phone: string;
  amenities: string[];
  /** 24h open */
  isOpenNow: boolean;
  hoursLabel: string;
  /** Relative SVG map position: 0–100 */
  mapX: number;
  mapY: number;
}

// ─── Volunteer ────────────────────────────────────────────────────────────────

export interface Volunteer {
  id: string;
  name: string;
  initials: string;
  skills: VolunteerSkill[];
  status: DispatchStatus;
  distanceMiles: number;
  /** ISO timestamp of last status update */
  lastUpdate: string;
  /** Current assignment description, null if available */
  currentTask: string | null;
  checksCompleted: number;
  rating: number;
}

// ─── Dispatch Request ────────────────────────────────────────────────────────

export interface DispatchRequest {
  id: string;
  requestedAt: number;
  urgency: UrgencyLevel;
  skillNeeded: VolunteerSkill;
  location: string;
  description: string;
  assignedVolunteerId: string | null;
  resolved: boolean;
}

// ─── Network Snapshot ────────────────────────────────────────────────────────

export interface NetworkSnapshot {
  shelters: Shelter[];
  volunteers: Volunteer[];
  activeRequests: DispatchRequest[];
  totalCapacity: number;
  totalOccupancy: number;
  systemStatus: 'normal' | 'elevated' | 'critical';
  generatedAt: number;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

export const SHELTERS: Shelter[] = [
  {
    id: 'tempe-library',
    name: 'Tempe Public Library',
    type: 'cooling_center',
    address: '3500 S Rural Rd, Tempe',
    district: 'Central Tempe',
    status: 'open',
    capacity: 120,
    currentOccupancy: 43,
    distanceMiles: 0.8,
    phone: '(480) 350-5500',
    amenities: ['AC', 'Water', 'Seating', 'WiFi', 'Restrooms'],
    isOpenNow: true,
    hoursLabel: 'Open until 9 PM',
    mapX: 48,
    mapY: 44,
  },
  {
    id: 'tempe-rec-center',
    name: 'Tempe Recreation Center',
    type: 'cooling_center',
    address: '3500 S Rural Rd, Tempe',
    district: 'Central Tempe',
    status: 'limited',
    capacity: 200,
    currentOccupancy: 178,
    distanceMiles: 1.2,
    phone: '(480) 350-5200',
    amenities: ['AC', 'Water', 'Seating', 'Medical Support'],
    isOpenNow: true,
    hoursLabel: 'Open 24 hours',
    mapX: 52,
    mapY: 56,
  },
  {
    id: 'mesa-community',
    name: 'Mesa Community Center',
    type: 'community_center',
    address: '201 N Center St, Mesa',
    district: 'West Mesa',
    status: 'open',
    capacity: 350,
    currentOccupancy: 89,
    distanceMiles: 3.4,
    phone: '(480) 644-2178',
    amenities: ['AC', 'Water', 'Cots', 'Food', 'Medical'],
    isOpenNow: true,
    hoursLabel: 'Open 24 hours',
    mapX: 72,
    mapY: 38,
  },
  {
    id: 'banner-urgent',
    name: 'Banner Urgent Care',
    type: 'hospital',
    address: '1400 S Dobson Rd, Mesa',
    district: 'Dobson Ranch',
    status: 'open',
    capacity: 60,
    currentOccupancy: 31,
    distanceMiles: 4.1,
    phone: '(480) 784-5500',
    amenities: ['Emergency Care', 'AC', 'IV Fluids', 'Medical Staff'],
    isOpenNow: true,
    hoursLabel: 'Open 24 hours',
    mapX: 78,
    mapY: 62,
  },
  {
    id: 'scottsdale-shelter',
    name: 'Scottsdale Emergency Shelter',
    type: 'emergency_shelter',
    address: '7447 E Indian School Rd',
    district: 'Scottsdale',
    status: 'full',
    capacity: 150,
    currentOccupancy: 150,
    distanceMiles: 6.2,
    phone: '(480) 312-2273',
    amenities: ['AC', 'Cots', 'Food', 'Showers'],
    isOpenNow: true,
    hoursLabel: 'Open 24 hours',
    mapX: 82,
    mapY: 28,
  },
  {
    id: 'chandler-civic',
    name: 'Chandler Civic Center',
    type: 'community_center',
    address: '55 N Arizona Ave, Chandler',
    district: 'Chandler',
    status: 'open',
    capacity: 280,
    currentOccupancy: 64,
    distanceMiles: 7.8,
    phone: '(480) 782-2000',
    amenities: ['AC', 'Water', 'Seating', 'Food', 'Childcare'],
    isOpenNow: true,
    hoursLabel: 'Open until 10 PM',
    mapX: 55,
    mapY: 78,
  },
];

export const VOLUNTEERS: Volunteer[] = [
  {
    id: 'v1',
    name: 'Maria Santos',
    initials: 'MS',
    skills: ['medical', 'welfare_check'],
    status: 'available',
    distanceMiles: 0.4,
    lastUpdate: new Date(Date.now() - 8 * 60000).toISOString(),
    currentTask: null,
    checksCompleted: 47,
    rating: 4.9,
  },
  {
    id: 'v2',
    name: 'James Okafor',
    initials: 'JO',
    skills: ['transport', 'general'],
    status: 'en_route',
    distanceMiles: 1.1,
    lastUpdate: new Date(Date.now() - 3 * 60000).toISOString(),
    currentTask: 'Transporting elderly resident to Tempe Library',
    checksCompleted: 23,
    rating: 4.7,
  },
  {
    id: 'v3',
    name: 'Aisha Rahman',
    initials: 'AR',
    skills: ['hydration', 'translation', 'general'],
    status: 'on_site',
    distanceMiles: 2.3,
    lastUpdate: new Date(Date.now() - 14 * 60000).toISOString(),
    currentTask: 'Distributing water — Mill Ave corridor',
    checksCompleted: 61,
    rating: 5.0,
  },
  {
    id: 'v4',
    name: 'Derek Huang',
    initials: 'DH',
    skills: ['welfare_check', 'general'],
    status: 'available',
    distanceMiles: 0.9,
    lastUpdate: new Date(Date.now() - 2 * 60000).toISOString(),
    currentTask: null,
    checksCompleted: 18,
    rating: 4.6,
  },
  {
    id: 'v5',
    name: 'Linda Chavez',
    initials: 'LC',
    skills: ['medical', 'hydration', 'translation'],
    status: 'returning',
    distanceMiles: 1.7,
    lastUpdate: new Date(Date.now() - 22 * 60000).toISOString(),
    currentTask: 'Returning from welfare check — South Tempe',
    checksCompleted: 84,
    rating: 4.9,
  },
];

export const ACTIVE_REQUESTS: DispatchRequest[] = [
  {
    id: 'req1',
    requestedAt: Date.now() - 12 * 60000,
    urgency: 'high',
    skillNeeded: 'welfare_check',
    location: '1200 S Mill Ave, Tempe',
    description: 'Elderly resident unresponsive to door knock, needs wellness check',
    assignedVolunteerId: 'v4',
    resolved: false,
  },
  {
    id: 'req2',
    requestedAt: Date.now() - 34 * 60000,
    urgency: 'medium',
    skillNeeded: 'transport',
    location: '420 W University Dr',
    description: 'Person without transport needs ride to cooling center',
    assignedVolunteerId: 'v2',
    resolved: false,
  },
  {
    id: 'req3',
    requestedAt: Date.now() - 5 * 60000,
    urgency: 'critical',
    skillNeeded: 'medical',
    location: '850 E Apache Blvd',
    description: 'Suspected heat stroke — confusion and hot dry skin',
    assignedVolunteerId: null,
    resolved: false,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getShelterStatusConfig(status: ShelterStatus): {
  color: string;
  background: string;
  label: string;
  dotColor: string;
} {
  switch (status) {
    case 'open':
      return { color: '#22C55E', background: 'rgba(34,197,94,0.12)', label: 'Open', dotColor: '#22C55E' };
    case 'limited':
      return { color: '#F59E0B', background: 'rgba(245,158,11,0.12)', label: 'Limited', dotColor: '#F59E0B' };
    case 'full':
      return { color: '#EF4444', background: 'rgba(239,68,68,0.12)', label: 'Full', dotColor: '#EF4444' };
    case 'closed':
      return { color: '#64748B', background: 'rgba(100,116,139,0.12)', label: 'Closed', dotColor: '#64748B' };
  }
}

export function getDispatchStatusConfig(status: DispatchStatus): {
  color: string;
  label: string;
  icon: string;
} {
  switch (status) {
    case 'available':
      return { color: '#22C55E', label: 'Available', icon: '●' };
    case 'en_route':
      return { color: '#3B82F6', label: 'En Route', icon: '►' };
    case 'on_site':
      return { color: '#F59E0B', label: 'On Site', icon: '◆' };
    case 'returning':
      return { color: '#94A3B8', label: 'Returning', icon: '◀' };
  }
}

export function getUrgencyConfig(urgency: UrgencyLevel): {
  color: string;
  background: string;
  label: string;
} {
  switch (urgency) {
    case 'low':
      return { color: '#22C55E', background: 'rgba(34,197,94,0.12)', label: 'Low' };
    case 'medium':
      return { color: '#F59E0B', background: 'rgba(245,158,11,0.12)', label: 'Medium' };
    case 'high':
      return { color: '#F97316', background: 'rgba(249,115,22,0.12)', label: 'High' };
    case 'critical':
      return { color: '#EF4444', background: 'rgba(239,68,68,0.15)', label: 'Critical' };
  }
}

export function getSkillLabel(skill: VolunteerSkill): string {
  const labels: Record<VolunteerSkill, string> = {
    medical: 'Medical',
    transport: 'Transport',
    hydration: 'Hydration',
    welfare_check: 'Welfare Check',
    translation: 'Translation',
    general: 'General',
  };
  return labels[skill];
}

export function getOccupancyPercent(shelter: Shelter): number {
  return Math.round((shelter.currentOccupancy / shelter.capacity) * 100);
}

export function computeNetworkSnapshot(): NetworkSnapshot {
  const totalCapacity = SHELTERS.reduce((s, sh) => s + sh.capacity, 0);
  const totalOccupancy = SHELTERS.reduce((s, sh) => s + sh.currentOccupancy, 0);
  const occupancyRatio = totalOccupancy / totalCapacity;
  const hasCritical = ACTIVE_REQUESTS.some((r) => r.urgency === 'critical' && !r.resolved);
  const systemStatus =
    hasCritical || occupancyRatio > 0.9
      ? 'critical'
      : occupancyRatio > 0.7
      ? 'elevated'
      : 'normal';

  return {
    shelters: [...SHELTERS].sort((a, b) => a.distanceMiles - b.distanceMiles),
    volunteers: [...VOLUNTEERS].sort((a, b) => {
      const order: Record<DispatchStatus, number> = { available: 0, returning: 1, en_route: 2, on_site: 3 };
      return order[a.status] - order[b.status];
    }),
    activeRequests: [...ACTIVE_REQUESTS].sort((a, b) => {
      const order: Record<UrgencyLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.urgency] - order[b.urgency];
    }),
    totalCapacity,
    totalOccupancy,
    systemStatus,
    generatedAt: Date.now(),
  };
}

export function formatMinutesAgo(isoTimestamp: string): string {
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  return `${mins} mins ago`;
}

export function formatRequestAge(timestamp: number): string {
  const ms = Date.now() - timestamp;
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}
