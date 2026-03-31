// ─────────────────────────────────────────────
// Heat-Safe Route Planner Engine
// Shade-aware routing, UV exposure scoring,
// and route safety comparison
// ─────────────────────────────────────────────

export type RouteType = 'direct' | 'shaded' | 'scenic';
export type RiskLevel = 'low' | 'moderate' | 'high' | 'extreme';
export type SegmentSurface = 'sidewalk' | 'path' | 'road' | 'grass' | 'covered';

// ─── Route Segment ────────────────────────────────────────────────────────────

export interface RouteSegment {
  id: string;
  label: string;
  distanceMiles: number;
  /** 0–100: percentage of segment with shade/cover */
  shadePercent: number;
  surface: SegmentSurface;
  /** Notable landmarks or cross-streets */
  landmark: string;
  /** Relative SVG path points for visualization: [{x, y}] */
  points: { x: number; y: number }[];
}

// ─── Route ────────────────────────────────────────────────────────────────────

export interface Route {
  id: string;
  type: RouteType;
  label: string;
  tagline: string;
  segments: RouteSegment[];
  totalDistanceMiles: number;
  estimatedMinutes: number;
  /** 0–100 composite safety score (higher = safer) */
  safetyScore: number;
  /** Estimated UV dose (standard erythemal dose units) */
  uvExposure: number;
  /** Peak surface temperature °F */
  peakSurfaceTemp: number;
  /** Overall shade coverage across all segments */
  overallShadePercent: number;
  riskLevel: RiskLevel;
  /** Safety recommendations for this route */
  tips: string[];
  /** SVG color for map rendering */
  color: string;
}

// ─── Comparison Result ────────────────────────────────────────────────────────

export interface RouteComparison {
  routes: Route[];
  recommended: Route;
  uvSavings: number;           // UV units saved vs worst route
  timeCostMinutes: number;     // Extra minutes for safer route vs fastest
  temperatureF: number;
  uvIndex: number;
  computedAt: number;
}

// ─── Waypoint ─────────────────────────────────────────────────────────────────

export interface Waypoint {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  mapX: number;
  mapY: number;
}

// ─── Preset Waypoints (Tempe) ─────────────────────────────────────────────────

export const WAYPOINTS: Waypoint[] = [
  { id: 'home',       label: 'Home',               shortLabel: 'Home',    description: 'Your current location',           mapX: 48, mapY: 50 },
  { id: 'asu-main',   label: 'ASU Main Campus',     shortLabel: 'ASU',     description: 'University Dr & Mill Ave',        mapX: 42, mapY: 34 },
  { id: 'mill-ave',   label: 'Mill Avenue',         shortLabel: 'Mill',    description: 'Mill Ave & 5th St',               mapX: 45, mapY: 44 },
  { id: 'town-lake',  label: 'Tempe Town Lake',     shortLabel: 'Lake',    description: 'Rio Salado Pkwy',                 mapX: 38, mapY: 40 },
  { id: 'library',    label: 'Tempe Library',       shortLabel: 'Library', description: '3500 S Rural Rd',                mapX: 62, mapY: 55 },
  { id: 'mcclintock', label: 'McClintock Station',  shortLabel: 'METRO',   description: 'Light Rail - McClintock',         mapX: 70, mapY: 50 },
  { id: 'marketplace','label': 'Tempe Marketplace', shortLabel: 'Market',  description: 'Rio Salado Pkwy & Loop 202',      mapX: 80, mapY: 38 },
];

// ─── Surface Temperature Lookup ───────────────────────────────────────────────

function getSurfaceTemp(airTempF: number, surface: SegmentSurface): number {
  const offsets: Record<SegmentSurface, number> = {
    covered:  -10,
    grass:     +2,
    path:      +8,
    sidewalk: +18,
    road:     +28,
  };
  return airTempF + offsets[surface];
}

// ─── UV Dose Calculation ──────────────────────────────────────────────────────

function calculateUVDose(
  uvIndex: number,
  durationMinutes: number,
  shadePercent: number,
): number {
  const shadeReduction = 1 - (shadePercent / 100) * 0.75;
  const baseDose = (uvIndex * durationMinutes) / 60;
  return Math.round(baseDose * shadeReduction * 10) / 10;
}

// ─── Safety Score ─────────────────────────────────────────────────────────────

function computeSafetyScore(
  shadePercent: number,
  uvExposure: number,
  peakSurfaceTemp: number,
  durationMinutes: number,
): number {
  const shadeScore  = shadePercent;                              // 0–100
  const uvScore     = Math.max(0, 100 - uvExposure * 15);       // penalize UV
  const tempScore   = Math.max(0, 100 - (peakSurfaceTemp - 90) * 2);
  const timeScore   = Math.max(0, 100 - durationMinutes * 1.2); // shorter = safer
  return Math.round(shadeScore * 0.35 + uvScore * 0.3 + tempScore * 0.25 + timeScore * 0.1);
}

function getRiskLevel(safetyScore: number): RiskLevel {
  if (safetyScore >= 70) return 'low';
  if (safetyScore >= 50) return 'moderate';
  if (safetyScore >= 30) return 'high';
  return 'extreme';
}

// ─── Route Tips ──────────────────────────────────────────────────────────────

function buildTips(route: Route, uvIndex: number, tempF: number): string[] {
  const tips: string[] = [];
  if (route.overallShadePercent < 30) tips.push('Carry and apply SPF 50+ sunscreen before departing');
  if (route.estimatedMinutes > 20)    tips.push('Bring at least 500 ml of water for this route');
  if (uvIndex >= 8)                   tips.push('UV is very high — wear a hat and UV-blocking clothing');
  if (tempF >= 105)                   tips.push('Pause in shade every 10 minutes if you feel overheated');
  if (route.riskLevel === 'extreme')  tips.push('Consider delaying until after 7 PM when temps drop');
  if (route.overallShadePercent >= 50) tips.push('Stay on the shaded side of the street throughout');
  if (route.riskLevel === 'low' || route.riskLevel === 'moderate') {
    tips.push('Wear light, breathable, light-colored clothing');
  }
  return tips.slice(0, 3);
}

// ─── Route Generation ─────────────────────────────────────────────────────────

function buildDirectRoute(
  from: Waypoint,
  to: Waypoint,
  airTempF: number,
  uvIndex: number,
): Route {
  const segments: RouteSegment[] = [
    {
      id: 'seg-d1',
      label: 'Main road stretch',
      distanceMiles: 0.4,
      shadePercent: 8,
      surface: 'road',
      landmark: `From ${from.shortLabel}`,
      points: [
        { x: from.mapX, y: from.mapY },
        { x: (from.mapX + to.mapX) / 2, y: (from.mapY + to.mapY) / 2 },
      ],
    },
    {
      id: 'seg-d2',
      label: 'Exposed sidewalk',
      distanceMiles: 0.35,
      shadePercent: 12,
      surface: 'sidewalk',
      landmark: `Approaching ${to.shortLabel}`,
      points: [
        { x: (from.mapX + to.mapX) / 2, y: (from.mapY + to.mapY) / 2 },
        { x: to.mapX, y: to.mapY },
      ],
    },
  ];

  const totalDistance = segments.reduce((s, seg) => s + seg.distanceMiles, 0);
  const estimatedMinutes = Math.round((totalDistance / 3.0) * 60); // 3 mph walk
  const overallShade = Math.round(segments.reduce((s, seg) => s + seg.shadePercent, 0) / segments.length);
  const peakSurface = Math.max(...segments.map((seg) => getSurfaceTemp(airTempF, seg.surface)));
  const uvExposure = calculateUVDose(uvIndex, estimatedMinutes, overallShade);
  const safetyScore = computeSafetyScore(overallShade, uvExposure, peakSurface, estimatedMinutes);
  const riskLevel = getRiskLevel(safetyScore);

  const route: Route = {
    id: 'route-direct',
    type: 'direct',
    label: 'Direct Route',
    tagline: 'Fastest but most exposed',
    segments,
    totalDistanceMiles: Math.round(totalDistance * 100) / 100,
    estimatedMinutes,
    safetyScore,
    uvExposure,
    peakSurfaceTemp: peakSurface,
    overallShadePercent: overallShade,
    riskLevel,
    tips: [],
    color: '#EF4444',
  };
  route.tips = buildTips(route, uvIndex, airTempF);
  return route;
}

function buildShadedRoute(
  from: Waypoint,
  to: Waypoint,
  airTempF: number,
  uvIndex: number,
): Route {
  const midX = (from.mapX + to.mapX) / 2 - 8;
  const midY = (from.mapY + to.mapY) / 2 + 6;

  const segments: RouteSegment[] = [
    {
      id: 'seg-s1',
      label: 'Tree-lined path',
      distanceMiles: 0.28,
      shadePercent: 68,
      surface: 'path',
      landmark: `Shaded exit from ${from.shortLabel}`,
      points: [{ x: from.mapX, y: from.mapY }, { x: midX, y: midY }],
    },
    {
      id: 'seg-s2',
      label: 'Covered walkway',
      distanceMiles: 0.22,
      shadePercent: 90,
      surface: 'covered',
      landmark: 'Covered arcade section',
      points: [{ x: midX, y: midY }, { x: midX + 6, y: midY - 4 }],
    },
    {
      id: 'seg-s3',
      label: 'Shaded side street',
      distanceMiles: 0.31,
      shadePercent: 55,
      surface: 'sidewalk',
      landmark: `Arrival at ${to.shortLabel}`,
      points: [{ x: midX + 6, y: midY - 4 }, { x: to.mapX, y: to.mapY }],
    },
  ];

  const totalDistance = segments.reduce((s, seg) => s + seg.distanceMiles, 0);
  const estimatedMinutes = Math.round((totalDistance / 3.0) * 60);
  const overallShade = Math.round(segments.reduce((s, seg) => s + seg.shadePercent, 0) / segments.length);
  const peakSurface = Math.max(...segments.map((seg) => getSurfaceTemp(airTempF, seg.surface)));
  const uvExposure = calculateUVDose(uvIndex, estimatedMinutes, overallShade);
  const safetyScore = computeSafetyScore(overallShade, uvExposure, peakSurface, estimatedMinutes);
  const riskLevel = getRiskLevel(safetyScore);

  const route: Route = {
    id: 'route-shaded',
    type: 'shaded',
    label: 'Shade-First Route',
    tagline: 'Maximizes cover, small detour',
    segments,
    totalDistanceMiles: Math.round(totalDistance * 100) / 100,
    estimatedMinutes,
    safetyScore,
    uvExposure,
    peakSurfaceTemp: peakSurface,
    overallShadePercent: overallShade,
    riskLevel,
    tips: [],
    color: '#22C55E',
  };
  route.tips = buildTips(route, uvIndex, airTempF);
  return route;
}

function buildScenicRoute(
  from: Waypoint,
  to: Waypoint,
  airTempF: number,
  uvIndex: number,
): Route {
  const viaX = from.mapX - 6;
  const viaY = (from.mapY + to.mapY) / 2;

  const segments: RouteSegment[] = [
    {
      id: 'seg-sc1',
      label: 'Lakeside path',
      distanceMiles: 0.35,
      shadePercent: 42,
      surface: 'path',
      landmark: 'Along water — cooler microclimate',
      points: [{ x: from.mapX, y: from.mapY }, { x: viaX, y: viaY }],
    },
    {
      id: 'seg-sc2',
      label: 'Grass walkway',
      distanceMiles: 0.2,
      shadePercent: 38,
      surface: 'grass',
      landmark: 'Park green space',
      points: [{ x: viaX, y: viaY }, { x: viaX + 5, y: viaY - 8 }],
    },
    {
      id: 'seg-sc3',
      label: 'Shaded corridor',
      distanceMiles: 0.33,
      shadePercent: 61,
      surface: 'path',
      landmark: `Final approach to ${to.shortLabel}`,
      points: [{ x: viaX + 5, y: viaY - 8 }, { x: to.mapX, y: to.mapY }],
    },
  ];

  const totalDistance = segments.reduce((s, seg) => s + seg.distanceMiles, 0);
  const estimatedMinutes = Math.round((totalDistance / 3.0) * 60);
  const overallShade = Math.round(segments.reduce((s, seg) => s + seg.shadePercent, 0) / segments.length);
  const peakSurface = Math.max(...segments.map((seg) => getSurfaceTemp(airTempF, seg.surface)));
  const uvExposure = calculateUVDose(uvIndex, estimatedMinutes, overallShade);
  const safetyScore = computeSafetyScore(overallShade, uvExposure, peakSurface, estimatedMinutes);
  const riskLevel = getRiskLevel(safetyScore);

  const route: Route = {
    id: 'route-scenic',
    type: 'scenic',
    label: 'Lakeside Route',
    tagline: 'Water + shade, longest path',
    segments,
    totalDistanceMiles: Math.round(totalDistance * 100) / 100,
    estimatedMinutes,
    safetyScore,
    uvExposure,
    peakSurfaceTemp: peakSurface,
    overallShadePercent: overallShade,
    riskLevel,
    tips: [],
    color: '#3B82F6',
  };
  route.tips = buildTips(route, uvIndex, airTempF);
  return route;
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function computeRouteComparison(
  from: Waypoint,
  to: Waypoint,
  airTempF: number = 108,
  uvIndex: number = 9,
): RouteComparison {
  const direct  = buildDirectRoute(from, to, airTempF, uvIndex);
  const shaded  = buildShadedRoute(from, to, airTempF, uvIndex);
  const scenic  = buildScenicRoute(from, to, airTempF, uvIndex);

  const routes = [direct, shaded, scenic];

  // Recommended = highest safety score
  const recommended = routes.reduce((best, r) => r.safetyScore > best.safetyScore ? r : best);

  const worstUV   = Math.max(...routes.map((r) => r.uvExposure));
  const fastestTime = Math.min(...routes.map((r) => r.estimatedMinutes));

  return {
    routes,
    recommended,
    uvSavings: Math.round((worstUV - recommended.uvExposure) * 10) / 10,
    timeCostMinutes: recommended.estimatedMinutes - fastestTime,
    temperatureF: airTempF,
    uvIndex,
    computedAt: Date.now(),
  };
}

// ─── Config Helpers ───────────────────────────────────────────────────────────

export function getRiskConfig(level: RiskLevel): {
  color: string;
  background: string;
  label: string;
  icon: string;
} {
  switch (level) {
    case 'low':      return { color: '#22C55E', background: 'rgba(34,197,94,0.12)',   label: 'Low Risk',      icon: '✓' };
    case 'moderate': return { color: '#F59E0B', background: 'rgba(245,158,11,0.12)', label: 'Moderate Risk', icon: '!' };
    case 'high':     return { color: '#F97316', background: 'rgba(249,115,22,0.12)', label: 'High Risk',     icon: '▲' };
    case 'extreme':  return { color: '#EF4444', background: 'rgba(239,68,68,0.12)',  label: 'Extreme Risk',  icon: '✕' };
  }
}

export function getSurfaceLabel(surface: SegmentSurface): string {
  const labels: Record<SegmentSurface, string> = {
    covered:  'Covered walkway',
    grass:    'Grass path',
    path:     'Paved path',
    sidewalk: 'Sidewalk',
    road:     'Road crossing',
  };
  return labels[surface];
}

export function getSurfaceColor(surface: SegmentSurface): string {
  const colors: Record<SegmentSurface, string> = {
    covered:  '#22C55E',
    grass:    '#4ADE80',
    path:     '#60A5FA',
    sidewalk: '#F59E0B',
    road:     '#EF4444',
  };
  return colors[surface];
}

export function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(2)} mi`;
}
