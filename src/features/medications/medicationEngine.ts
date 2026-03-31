/**
 * Medication Heat Interaction Engine
 *
 * Eight common drug categories that impair the body's ability to
 * regulate heat. Each has a specific mechanism, a severity level,
 * and actionable warnings tailored to current temperature.
 *
 * Sources: CDC Heat Stress in Older Adults, FDA drug labeling,
 * APHA Heat & Medications guidelines.
 */

// ── Types ─────────────────────────────────────────────────────────────────

export type MedSeverity = 'moderate' | 'high' | 'critical';

export interface MedCategory {
  id: string;
  name: string;
  examples: string;         // Common brand/generic names users recognise
  mechanism: string;        // How it impairs heat regulation
  severity: MedSeverity;
  warnings: {
    any: string;            // Always shown when taking this med
    caution: string;        // 25–30°C
    high: string;           // 30–35°C
    extreme: string;        // 35–40°C
    crisis: string;         // 40°C+
  };
  actions: string[];        // Specific things to do/avoid
}

export interface MedWarning {
  categoryId: string;
  categoryName: string;
  severity: MedSeverity;
  headline: string;
  body: string;
  actions: string[];
}

// ── Medication categories ─────────────────────────────────────────────────

export const MED_CATEGORIES: MedCategory[] = [
  {
    id: 'diuretics',
    name: 'Diuretics (water pills)',
    examples: 'Furosemide, Hydrochlorothiazide, Lasix, HCTZ',
    mechanism: 'Increase urinary fluid loss, accelerating dehydration in heat',
    severity: 'high',
    warnings: {
      any:     'Diuretics reduce your fluid reserves — you dehydrate faster than others.',
      caution: 'Drink an extra 500ml water today. Monitor urine colour — dark yellow means dehydration.',
      high:    'High heat + diuretics is dangerous. Drink water every 20 minutes. Avoid prolonged outdoor exposure.',
      extreme: 'Extreme risk. Your medication is actively depleting fluids in this heat. Stay indoors with AC.',
      crisis:  'Life-threatening combination. Seek cool shelter immediately and hydrate aggressively.',
    },
    actions: [
      'Drink 500ml extra water per hour in the heat',
      'Check urine colour — aim for pale yellow',
      'Ask your doctor about temporary dose adjustment in heatwaves',
      'Never skip doses without medical advice',
    ],
  },
  {
    id: 'beta_blockers',
    name: 'Beta blockers',
    examples: 'Metoprolol, Atenolol, Propranolol, Carvedilol',
    mechanism: 'Limit heart rate increase and reduce sweating, both critical heat-coping responses',
    severity: 'high',
    warnings: {
      any:     'Beta blockers cap your heart rate and reduce sweating — your body cannot cool itself normally.',
      caution: 'Exertion feels easier than it is. Take frequent shade breaks even when you feel fine.',
      high:    'Your heart cannot speed up to compensate for heat load. Avoid physical exertion entirely.',
      extreme: 'Very high risk. You may not feel heat stress until it is severe. Get indoors now.',
      crisis:  'Critical. Without normal heart rate response you cannot survive prolonged crisis-level heat. Emergency shelter now.',
    },
    actions: [
      'Never rely on how you feel — monitor time outdoors, not exertion level',
      'Take pulse periodically — if unusually low in heat, seek shade',
      'Avoid exercise outdoors above 30°C',
      'Wear lightweight, light-coloured clothing to reduce heat absorption',
    ],
  },
  {
    id: 'anticholinergics',
    name: 'Anticholinergics / antipsychotics',
    examples: 'Oxybutynin, Benztropine, Clozapine, Olanzapine, Chlorpromazine',
    mechanism: 'Block the nervous system signals that trigger sweating, eliminating your primary cooling mechanism',
    severity: 'critical',
    warnings: {
      any:     'These medications block sweating — your most important cooling mechanism is impaired.',
      caution: 'You may not sweat normally. Check for dry, hot skin even when warm.',
      high:    'High danger. Without sweating, heat builds rapidly. 30-minute outdoor limit.',
      extreme: 'Severe risk. Dry hot skin in this heat can escalate to heat stroke within minutes. Go indoors.',
      crisis:  'Extreme emergency risk. Heat stroke is likely without immediate cooling. Call 911 if you feel confused or stop sweating.',
    },
    actions: [
      'Check your skin regularly — dry + hot skin without sweating is an emergency sign',
      'Set a 20-minute outdoor timer as your absolute limit above 30°C',
      'Use cooling towels, fans, and misting to compensate for absent sweating',
      'Tell someone your location whenever going outdoors',
    ],
  },
  {
    id: 'lithium',
    name: 'Lithium',
    examples: 'Lithium carbonate, Lithobid, Eskalith',
    mechanism: 'Dehydration from sweating raises blood lithium to toxic levels rapidly',
    severity: 'critical',
    warnings: {
      any:     'Lithium levels rise dangerously when you are dehydrated — heat + sweating is a real toxicity risk.',
      caution: 'Drink extra fluids today. Know the signs of lithium toxicity: tremor, nausea, confusion.',
      high:    'High risk of toxicity. Drink at least 3L of water today. Avoid all strenuous outdoor activity.',
      extreme: 'Toxic levels are possible in this heat. Consider calling your prescriber. Stay indoors.',
      crisis:  'Medical emergency risk. Lithium toxicity can occur quickly. If trembling, confused, or unable to urinate — call 911.',
    },
    actions: [
      'Drink at minimum 3L of water on hot days',
      'Know toxicity signs: hand tremor, nausea, blurred vision, confusion, muscle twitching',
      'Do not restrict salt intake in hot weather (salt loss raises lithium levels)',
      'Contact your prescriber if exposed to prolonged heat',
    ],
  },
  {
    id: 'antihistamines',
    name: 'Antihistamines',
    examples: 'Diphenhydramine, Benadryl, Hydroxyzine, Promethazine',
    mechanism: 'First-generation antihistamines suppress sweating via anticholinergic effects',
    severity: 'moderate',
    warnings: {
      any:     'Sedating antihistamines reduce sweating and can mask heat symptoms with drowsiness.',
      caution: 'Drowsiness from antihistamines can make heat symptoms harder to recognise.',
      high:    'Reduced sweating + sedation in this heat. Take shade breaks every 20 minutes.',
      extreme: 'Do not stay outdoors. Sedation and impaired sweating together are dangerous above 35°C.',
      crisis:  'Stay inside. If you feel confused, extremely drowsy, or stop sweating — seek help immediately.',
    },
    actions: [
      'Prefer non-sedating antihistamines (loratadine, cetirizine) in hot weather if possible',
      'Do not drive or operate machinery if drowsy in heat',
      'Avoid alcohol — it compounds dehydration and sedation',
    ],
  },
  {
    id: 'ace_inhibitors_arbs',
    name: 'ACE inhibitors / ARBs',
    examples: 'Lisinopril, Enalapril, Losartan, Valsartan, Ramipril',
    mechanism: 'Affect blood pressure regulation, which can cause dangerous drops during heat-induced vasodilation',
    severity: 'moderate',
    warnings: {
      any:     'Blood pressure medications can cause sudden drops when blood vessels dilate in the heat.',
      caution: 'Rise slowly from sitting or lying. Dizziness on standing is more likely today.',
      high:    'Significant dizziness and fainting risk. Avoid standing for long periods in the heat.',
      extreme: 'Blood pressure can drop sharply. Stay seated or lying in a cool environment. Hydrate well.',
      crisis:  'Fainting risk is high. Do not stand in the heat. If dizzy or faint — lie down and call for help.',
    },
    actions: [
      'Rise slowly from lying or sitting — count to 5 before standing',
      'Sit down immediately if you feel lightheaded',
      'Drink extra water — dehydration worsens the blood pressure drop',
      'Check BP if you have a home monitor during heatwaves',
    ],
  },
  {
    id: 'stimulants',
    name: 'Stimulants (ADHD / appetite)',
    examples: 'Adderall, Ritalin, Vyvanse, Phentermine, Methylphenidate',
    mechanism: 'Increase metabolic heat production and can cause vasoconstriction that impairs cooling',
    severity: 'high',
    warnings: {
      any:     'Stimulants increase your body\'s heat production and can interfere with normal cooling.',
      caution: 'You are generating more internal heat than others. Hydrate frequently.',
      high:    'Your medication is adding to your heat load. Reduce outdoor time and physical activity significantly.',
      extreme: 'Very high internal heat production. Prolonged outdoor exposure can escalate to heat stroke quickly.',
      crisis:  'Critical risk. Get to AC immediately. Your body is producing excess heat it cannot shed.',
    },
    actions: [
      'Drink water every 15–20 minutes during activity',
      'Take cooling breaks more frequently than you think you need',
      'Avoid pre-workout supplements or caffeine on hot days',
      'Discuss timing of doses with your doctor during heatwaves',
    ],
  },
  {
    id: 'nsaids',
    name: 'NSAIDs (anti-inflammatory)',
    examples: 'Ibuprofen, Naproxen, Advil, Aleve, Aspirin (high dose)',
    mechanism: 'Reduce kidney blood flow, increasing acute kidney injury risk when combined with dehydration',
    severity: 'moderate',
    warnings: {
      any:     'NSAIDs reduce kidney blood flow, which is more dangerous when you are losing fluids via sweat.',
      caution: 'Stay well hydrated. Avoid NSAIDs on empty stomach in the heat.',
      high:    'Dehydration + NSAIDs strains kidneys. Drink 2–3L water today. Consider paracetamol instead.',
      extreme: 'High kidney stress risk. Avoid NSAIDs if possible above 35°C. If pain requires them, hydrate aggressively.',
      crisis:  'Avoid NSAIDs in crisis heat if at all possible. Kidney injury risk is significant. Use paracetamol if needed.',
    },
    actions: [
      'Always take NSAIDs with a full glass of water',
      'Consider switching to paracetamol (acetaminophen) on very hot days',
      'Never take NSAIDs if you are already dehydrated',
      'Monitor urine output — reduced output is a kidney warning sign',
    ],
  },
];

// ── Engine functions ───────────────────────────────────────────────────────

/**
 * Returns active warnings for a given set of medication category IDs
 * and a current temperature in Celsius.
 */
export function getMedicationWarnings(
  selectedCategoryIds: string[],
  tempC: number
): MedWarning[] {
  if (selectedCategoryIds.length === 0) return [];

  const heatKey = getHeatKey(tempC);

  return selectedCategoryIds
    .map(id => MED_CATEGORIES.find(c => c.id === id))
    .filter((c): c is MedCategory => c !== undefined)
    .map(cat => ({
      categoryId:   cat.id,
      categoryName: cat.name,
      severity:     cat.severity,
      headline:     getSeverityHeadline(cat.severity, tempC),
      body:         cat.warnings[heatKey],
      actions:      cat.actions,
    }))
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

/**
 * Returns the single highest-severity warning to show inline
 * on the home screen card.
 */
export function getTopMedicationWarning(
  selectedCategoryIds: string[],
  tempC: number
): MedWarning | null {
  const warnings = getMedicationWarnings(selectedCategoryIds, tempC);
  return warnings.length > 0 ? warnings[0] : null;
}

/**
 * Whether the user should receive the generic "you take medications"
 * prompt to identify their categories.
 */
export function shouldPromptMedSetup(
  takesMedications: boolean,
  selectedCategoryIds: string[]
): boolean {
  return takesMedications && selectedCategoryIds.length === 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getHeatKey(tempC: number): keyof MedCategory['warnings'] {
  if (tempC >= 40) return 'crisis';
  if (tempC >= 35) return 'extreme';
  if (tempC >= 30) return 'high';
  if (tempC >= 25) return 'caution';
  return 'any';
}

function getSeverityHeadline(severity: MedSeverity, tempC: number): string {
  if (tempC < 25) return 'Medication note';
  if (severity === 'critical') return '⚠ Critical medication risk';
  if (severity === 'high')     return '⚠ High medication risk';
  return 'Medication caution';
}

function severityRank(s: MedSeverity): number {
  return s === 'critical' ? 3 : s === 'high' ? 2 : 1;
}

export function severityColor(s: MedSeverity): string {
  return s === 'critical' ? '#7C2D12'
    : s === 'high'        ? '#DC2626'
    :                       '#D97706';
}

export function severityBg(s: MedSeverity): string {
  return s === 'critical' ? '#FEF2F2'
    : s === 'high'        ? '#FFF1F1'
    :                       '#FFFBEB';
}
