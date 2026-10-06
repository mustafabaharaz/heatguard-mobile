// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/content/riskSources.ts   (NEW FILE)
// HeatGuard · Sources behind the heat-risk levels (checked Oct 2026)
// Shown on app/risk/index.tsx. Keep each claim on that page traceable here.
// ─────────────────────────────────────────────────────────────────────────────

export interface RiskSource {
  title: string;
  who: string;
  usedFor: string;
  url: string;
}

export const RISK_SOURCES: RiskSource[] = [
  {
    title: 'Heat Index and its categories',
    who: 'National Weather Service',
    usedFor: 'The four heat levels: Caution, Extreme caution, Danger, Extreme danger.',
    url: 'https://www.weather.gov/safety/heat-index',
  },
  {
    title: 'HeatRisk',
    who: 'National Weather Service & CDC',
    usedFor: 'Why heat-sensitive people should act at lower temperatures than everyone else.',
    url: 'https://www.wpc.ncep.noaa.gov/heatrisk/',
  },
  {
    title: 'Heat and chronic conditions',
    who: 'CDC',
    usedFor: 'Heart, lung, kidney and diabetes conditions as heat risk factors.',
    url: 'https://www.cdc.gov/heat-health/risk-factors/heat-and-chronic-conditions.html',
  },
  {
    title: 'Heat and health: who is at risk',
    who: 'CDC',
    usedFor: 'Adults over 65, chronic conditions, and outdoor exertion as risk factors.',
    url: 'https://www.cdc.gov/heat-health/hcp/clinical-overview/index.html',
  },
  {
    title: 'Heat and medications',
    who: 'CDC',
    usedFor: 'How common medicines can affect the body\'s response to heat.',
    url: 'https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html',
  },
  {
    title: 'Heat-related deaths in the 1995 Chicago heat wave',
    who: 'Semenza et al., New England Journal of Medicine, 1996',
    usedFor: 'Working AC protected people; living alone raised the risk.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Semenza+1996+heat-related+deaths+Chicago+heat+wave',
  },
  {
    title: 'Prognostic factors in heat wave–related deaths',
    who: 'Bouchama et al., Archives of Internal Medicine, 2007',
    usedFor: 'Review of heat-wave studies: home AC protective, isolation a risk.',
    url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Bouchama+2007+prognostic+factors+heat+wave+deaths+meta-analysis',
  },
  {
    title: 'Heat deaths in Maricopa County',
    who: 'Maricopa County Department of Public Health',
    usedFor: 'Local data: many indoor heat deaths involve AC that was off or broken.',
    url: 'https://www.maricopa.gov/heat',
  },
];

/** Official NWS/CDC HeatRisk lookup by ZIP code. */
export const HEATRISK_LOOKUP_URL = 'https://ephtracking.cdc.gov/Applications/HeatTracker/';
