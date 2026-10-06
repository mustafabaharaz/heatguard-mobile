// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/content/acclimationAbout.ts   (NEW FILE)
// HeatGuard · "Why acclimate?" content for app/acclimation/index.tsx
// Plain-language, persuasive but honest. Every factual line traces to the
// OSHA/NIOSH sources below (checked Oct 2026).
// ─────────────────────────────────────────────────────────────────────────────

export const ACCLIM_HEADLINE = 'Train your body for the heat';

export const ACCLIM_PITCH =
  'Your body can learn to handle heat. With short, steady time in warm weather over one to two weeks, it adapts so the same hot day puts far less strain on you.';

export const ACCLIM_CHANGES: { title: string; body: string }[] = [
  { title: 'You sweat sooner and better', body: 'Sweat starts earlier and cools you more, so heat builds up less.' },
  { title: 'Your heart works less hard', body: 'Your blood volume grows, so your heart pumps less to keep you cool.' },
  { title: 'You run cooler', body: 'Your core temperature and heart rate stay lower for the same effort.' },
  { title: 'You keep more salt', body: 'Your sweat carries less salt, which helps prevent cramps.' },
];

export const ACCLIM_WHY_NOW: string[] = [
  'The first hot days are the most dangerous. OSHA reports that over 70% of heat-related worker deaths happen in a worker\'s first week in the heat.',
  'It fades. After a week or two away from heat, or a cool stretch, much of the adaptation is lost. Coming back from a trip counts.',
  'In Arizona, it\'s the difference between a hard first week on the job and a dangerous one.',
];

export const ACCLIM_HOW: string[] = [
  '14 days in four phases: Intro, Adapt, Progressive, Final.',
  'Start with about 20 minutes in the cooler early morning or evening, then build up a little each day.',
  'This follows the same idea as the OSHA and NIOSH "Rule of 20 percent": start small and add a bit each day. Some people need up to 14 days.',
  'Stop right away if you feel dizzy, sick, confused, or stop sweating.',
];

export const ACCLIM_FOR = [
  'Outdoor workers: construction, landscaping, delivery, roofing',
  'Runners, hikers, and anyone training outside',
  'People new to Arizona, or back from time somewhere cooler',
];

export const ACCLIM_NOT_FOR =
  'Age 65+, a heart, lung, kidney, or diabetes condition, or daily medicines? Talk to your doctor before adding heat exposure. For many people, the safer plan is to limit time in the heat, not build it up.';

export const ACCLIM_SOURCES = [
  {
    title: 'Protecting new workers: acclimatization and the Rule of 20 percent',
    who: 'OSHA',
    url: 'https://www.osha.gov/heat-exposure/protecting-new-workers',
  },
  {
    title: 'OSHA-NIOSH Heat Safety Tool app',
    who: 'OSHA & NIOSH',
    url: 'https://www.osha.gov/heat/heat-app',
  },
];
