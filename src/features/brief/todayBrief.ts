// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/brief/todayBrief.ts   (NEW FILE)
// HeatGuard · Build today's brief from live data
// Shared by Home and the "Your heat risk" page so they always show the same
// card. Falls back to the cached brief when the forecast isn't loaded.
// ─────────────────────────────────────────────────────────────────────────────

import type { WeatherSnapshot } from '../../services/weather/weatherStore';
import { getTodayHighF } from '../../services/weather/weatherStore';
import type { HeatProfile } from '../profile/storage/profileStorage';
import { generateDailyBrief, getCachedBrief, type DailyBrief } from './briefEngine';
import { getTodayPeakFeelsF } from '../risk/riskEngine';
import { calculateHydrationTarget, computeHydrationSummary, mlToOz } from '../hydration/hydrationEngine';
import { getHydrationLogs } from '../hydration/hydrationStorage';
import { getAcclimationScore } from '../acclimation/acclimationEngine';
import { getAcclimationState } from '../acclimation/acclimationStorage';

export function buildTodayBrief(snapshot: WeatherSnapshot | null, profile: HeatProfile): DailyBrief | null {
  const highF = getTodayHighF(snapshot);
  if (highF === null) return getCachedBrief();
  try {
    const acclim = getAcclimationState();
    const target = calculateHydrationTarget(profile, highF);
    return generateDailyBrief({
      profile,
      forecastHighF: highF,
      forecastFeelsMaxF: getTodayPeakFeelsF(snapshot) ?? undefined,
      hydrationTargetOz: mlToOz(target.dailyTargetMl),
      hydrationPercentComplete: computeHydrationSummary(target, getHydrationLogs()).percentComplete,
      acclimationDay: acclim.isActive ? acclim.currentDay : null,
      acclimationScore: getAcclimationScore(acclim.completedDays.length),
      medicationWarnings: profile.takesMedications ? 1 : 0,
    });
  } catch {
    return getCachedBrief();
  }
}
