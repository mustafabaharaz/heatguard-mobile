// ─────────────────────────────────────────────
// Neighborhood Heat Watch Engine
// Block-level heat index computation with
// hyperlocal variance, alerts, and trend tracking
// ─────────────────────────────────────────────

export type ThermalLevel = 'safe' | 'caution' | 'high_alert' | 'extreme' | 'crisis';

export type TrendDirection = 'rising' | 'stable' | 'falling';

export interface NeighborhoodBlock {
  id: string;
  name: string;
  district: string;
  tagline: string;
  /** Multiplier applied to base temperature: 0.85 – 1.25 */
  heatFactor: number;
  /** 0–100: higher = more canopy / shade coverage */
  shadeScore: number;
  /** 0–1: fraction of surface that is paved */
  pavementRatio: number;
  /** 0–1: fraction of surface with vegetation */
  greenSpaceRatio: number;
  isUserBlock: boolean;
}

export interface BlockReading {
  block: NeighborhoodBlock;
  temperature: number;
  heatIndex: number;
  thermalLevel: ThermalLevel;
  uvIndex: number;
  alertActive: boolean;
  trend: TrendDirection;
  /** °F change over last hour (positive = hotter) */
  trendDelta: number;
  /** Apparent heat index for last 24 hours, oldest → newest */
  hourlyHistory: number[];
}

export interface NeighborhoodAlert {
  id: string;
  blockId: string;
  blockName: string;
  type: 'threshold_exceeded' | 'rapid_rise' | 'extreme_forecast' | 'all_clear';
  severity: ThermalLevel;
  message: string;
  timestamp: number;
  dismissed: boolean;
}

export interface NeighborhoodSnapshot {
  blocks: BlockReading[];
  alerts: NeighborhoodAlert[];
  baseTemperature: number;
  humidityPercent: number;
  generatedAt: number;
}

// ─── Block Registry (Tempe / East Valley) ───────────────────────────────────

export const BLOCKS: NeighborhoodBlock[] = [
  {
    id: 'your-block',
    name: 'Your Block',
    district: 'Current Location',
    tagline: 'Hyperlocal reading for where you are',
    heatFactor: 1.0,
    shadeScore: 35,
    pavementRatio: 0.7,
    greenSpaceRatio: 0.15,
    isUserBlock: true,
  },
  {
    id: 'downtown-tempe',
    name: 'Downtown Tempe',
    district: 'Mill Avenue District',
    tagline: 'Dense pavement, minimal tree cover',
    heatFactor: 1.18,
    shadeScore: 18,
    pavementRatio: 0.92,
    greenSpaceRatio: 0.04,
    isUserBlock: false,
  },
  {
    id: 'asu-campus',
    name: 'ASU Campus',
    district: 'University District',
    tagline: 'Mature trees provide moderate relief',
    heatFactor: 1.06,
    shadeScore: 52,
    pavementRatio: 0.62,
    greenSpaceRatio: 0.28,
    isUserBlock: false,
  },
  {
    id: 'town-lake',
    name: 'Town Lake Area',
    district: 'Lakefront District',
    tagline: 'Water proximity creates slight breeze',
    heatFactor: 0.96,
    shadeScore: 42,
    pavementRatio: 0.55,
    greenSpaceRatio: 0.36,
    isUserBlock: false,
  },
  {
    id: 'south-tempe',
    name: 'South Tempe',
    district: 'Ahwatukee Foothills',
    tagline: 'Suburban with scattered tree canopy',
    heatFactor: 0.92,
    shadeScore: 50,
    pavementRatio: 0.5,
    greenSpaceRatio: 0.38,
    isUserBlock: false,
  },
  {
    id: 'mcclintock',
    name: 'McClintock Corridor',
    district: 'Central Tempe',
    tagline: 'Mixed commercial and residential',
    heatFactor: 1.09,
    shadeScore: 28,
    pavementRatio: 0.76,
    greenSpaceRatio: 0.18,
    isUserBlock: false,
  },
  {
    id: 'rural-east',
    name: 'East Mesa Border',
    district: 'Suburban Outskirts',
    tagline: 'Lower density, more open space',
    heatFactor: 0.87,
    shadeScore: 62,
    pavementRatio: 0.38,
    greenSpaceRatio: 0.47,
    isUserBlock: false,
  },
];

// ─── Thermal Helpers ─────────────────────────────────────────────────────────

export function getThermalLevel(heatIndex: number): ThermalLevel {
  if (heatIndex < 90) return 'safe';
  if (heatIndex < 100) return 'caution';
  if (heatIndex < 110) return 'high_alert';
  if (heatIndex < 120) return 'extreme';
  return 'crisis';
}

export function getThermalConfig(level: ThermalLevel): {
  color: string;
  dimColor: string;
  background: string;
  label: string;
  emoji: string;
} {
  switch (level) {
    case 'safe':
      return {
        color: '#22C55E',
        dimColor: '#16A34A',
        background: 'rgba(34,197,94,0.12)',
        label: 'Safe',
        emoji: '✓',
      };
    case 'caution':
      return {
        color: '#F59E0B',
        dimColor: '#D97706',
        background: 'rgba(245,158,11,0.12)',
        label: 'Caution',
        emoji: '⚡',
      };
    case 'high_alert':
      return {
        color: '#F97316',
        dimColor: '#EA580C',
        background: 'rgba(249,115,22,0.12)',
        label: 'High Alert',
        emoji: '▲',
      };
    case 'extreme':
      return {
        color: '#EF4444',
        dimColor: '#DC2626',
        background: 'rgba(239,68,68,0.12)',
        label: 'Extreme',
        emoji: '!!',
      };
    case 'crisis':
      return {
        color: '#A855F7',
        dimColor: '#7C3AED',
        background: 'rgba(168,85,247,0.15)',
        label: 'Crisis',
        emoji: '☠',
      };
  }
}

// ─── Heat Index (Rothfusz Regression) ────────────────────────────────────────

function computeHeatIndex(tempF: number, humidity: number): number {
  if (tempF < 80) return tempF;
  const T = tempF;
  const R = humidity;
  const hi =
    -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;
  return Math.round(hi);
}

// ─── UV Attenuation by Shade ─────────────────────────────────────────────────

function computeUVIndex(baseUV: number, shadeScore: number): number {
  const reduction = (shadeScore / 100) * 0.72;
  return Math.max(0, Math.round((baseUV * (1 - reduction)) * 10) / 10);
}

// ─── Diurnal History Simulation ──────────────────────────────────────────────

function generateHourlyHistory(currentHeatIndex: number): number[] {
  const nowHour = new Date().getHours();
  return Array.from({ length: 24 }, (_, i) => {
    const hour = (nowHour - 23 + i + 24) % 24;
    // Sinusoidal diurnal: min ~6 am, max ~3 pm
    const phase = ((hour - 6) / 24) * 2 * Math.PI;
    const offset = Math.sin(phase) * 16;
    const noise = (Math.random() - 0.5) * 2.5;
    return Math.round(currentHeatIndex + offset + noise);
  });
}

// ─── Snapshot Computation ─────────────────────────────────────────────────────

export function computeNeighborhoodSnapshot(
  baseTemperatureF: number = 108,
  humidityPercent: number = 20,
  baseUVIndex: number = 9,
): NeighborhoodSnapshot {
  const blocks: BlockReading[] = BLOCKS.map((block) => {
    const temperature = Math.round(baseTemperatureF * block.heatFactor);
    const heatIndex = computeHeatIndex(temperature, humidityPercent);
    const thermalLevel = getThermalLevel(heatIndex);
    const uvIndex = computeUVIndex(baseUVIndex, block.shadeScore);
    const hourlyHistory = generateHourlyHistory(heatIndex);

    // Trend: compare current to 1h ago (index 22 in 24h array)
    const oneHourAgo = hourlyHistory[22] ?? heatIndex;
    const trendDelta = heatIndex - oneHourAgo;
    const trend: TrendDirection =
      trendDelta > 2 ? 'rising' : trendDelta < -2 ? 'falling' : 'stable';

    return {
      block,
      temperature,
      heatIndex,
      thermalLevel,
      uvIndex,
      alertActive: thermalLevel === 'extreme' || thermalLevel === 'crisis',
      trend,
      trendDelta,
      hourlyHistory,
    };
  });

  // Sort: user block first, rest by descending heat index
  const sorted = [
    ...blocks.filter((b) => b.block.isUserBlock),
    ...blocks
      .filter((b) => !b.block.isUserBlock)
      .sort((a, b) => b.heatIndex - a.heatIndex),
  ];

  const alerts: NeighborhoodAlert[] = sorted
    .filter((b) => b.alertActive)
    .map((b) => ({
      id: `alert-${b.block.id}-${Date.now()}`,
      blockId: b.block.id,
      blockName: b.block.name,
      type: b.trend === 'rising' ? 'rapid_rise' : 'threshold_exceeded',
      severity: b.thermalLevel,
      message:
        b.trend === 'rising'
          ? `${b.block.name} temperature is climbing fast — up ${Math.abs(b.trendDelta)}°F this hour.`
          : `${b.block.name} heat index is ${b.heatIndex}°F — dangerous conditions.`,
      timestamp: Date.now(),
      dismissed: false,
    }));

  return {
    blocks: sorted,
    alerts,
    baseTemperature: baseTemperatureF,
    humidityPercent,
    generatedAt: Date.now(),
  };
}

// ─── Block Comparison ─────────────────────────────────────────────────────────

export function compareToUserBlock(
  userReading: BlockReading,
  otherReading: BlockReading,
): {
  delta: number;
  description: string;
  safer: boolean;
} {
  const delta = otherReading.heatIndex - userReading.heatIndex;
  const safer = delta < 0;
  const absDelta = Math.abs(delta);
  const description =
    absDelta < 2
      ? 'Similar to your block'
      : safer
      ? `${absDelta}°F cooler than your block`
      : `${absDelta}°F hotter than your block`;
  return { delta, description, safer };
}
