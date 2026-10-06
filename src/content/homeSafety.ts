// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/content/homeSafety.ts   (NEW FILE)
// HeatGuard · Home safety content
//  - Free ways to keep a home cooler
//  - Arizona power-bill help (checked Oct 2026: ACC, DES, APS, SRP, TEP)
//  - Safety-check questions and the one tip shown after a "no"
// Keep wording plain and specific. Review the bill-help list each spring.
// ─────────────────────────────────────────────────────────────────────────────

import type { HeatProfile } from '../features/profile/storage/profileStorage';

// ── Free cooling tips ────────────────────────────────────────────────────────

export const COOLING_TIPS: { title: string; body: string }[] = [
  {
    title: 'Set it to 78–80°F, don\'t switch it off',
    body: 'A home that heats up all day can become dangerous. A higher setting saves money and keeps you safe. On a time-of-use plan, cool the house before the expensive afternoon hours.',
  },
  {
    title: 'Block the sun',
    body: 'Close blinds and curtains on sunny windows during the day. A sheet or foil over a west-facing window helps a lot.',
  },
  {
    title: 'Cool your body, not just the room',
    body: 'A cool shower, wet cloths on your neck and wrists, or feet in cool water bring your temperature down fast.',
  },
  {
    title: 'Fans have limits',
    body: 'A fan helps when the room is warm. When it is in the mid-90s indoors, a fan alone will not keep you safe. Go somewhere cool.',
  },
  {
    title: 'Spend the hottest hours somewhere cool',
    body: 'From noon to 6 PM, a cooling center, library, or mall is free and air conditioned. Cool Spots shows the ones near you.',
  },
  {
    title: 'Keep heat out of the kitchen',
    body: 'Skip the oven on hot days. Use a microwave or slow cooker, or eat cold meals.',
  },
];

// ── Arizona bill help ────────────────────────────────────────────────────────

export interface BillHelpLink {
  title: string;
  detail: string;
  url: string;
  phone?: string;
}

export const AZ_SHUTOFF_NOTE =
  'From June 1 to October 15, APS and TEP don\'t shut off homes for late payment. Bills still add up, so ask about a payment plan early.';

export const AZ_BILL_HELP: BillHelpLink[] = [
  {
    title: 'State help: LIHEAP & Power AZ',
    detail: 'One application through Arizona DES covers both. Power AZ helps working families who earn too much for LIHEAP.',
    url: 'https://des.az.gov/liheap',
    phone: '1-866-494-1981',
  },
  {
    title: 'APS customers',
    detail: 'Monthly bill discounts, crisis bill help, and a Safety Net option that alerts someone you choose if a bill is late.',
    url: 'https://www.aps.com/assistance',
    phone: '602-371-7171',
  },
  {
    title: 'SRP customers',
    detail: 'Income-Qualified Discount, payment plans, and SRP Safety Net to alert someone you choose if a bill is late.',
    url: 'https://www.srpnet.com/heretohelp',
    phone: '602-236-8888',
  },
  {
    title: 'TEP customers',
    detail: 'Payment plans, short-term help, and bill discounts for qualifying households.',
    url: 'https://www.tep.com/summer-disconnection-moratorium',
    phone: '520-623-7711',
  },
  {
    title: 'Wildfire: energy help near you',
    detail: 'Arizona nonprofit that lists bill help and community action agencies by area.',
    url: 'https://wildfireaz.org/find-help/energy-assistance/',
  },
  {
    title: '2-1-1 Arizona',
    detail: 'Free, 24/7 help finding cooling, bill, and AC repair resources. Dial 2-1-1.',
    url: 'https://211arizona.org',
    phone: '211',
  },
];

// ── Safety check ─────────────────────────────────────────────────────────────

export type SafetyKey = 'water' | 'medicine' | 'cool' | 'phone';
export type SafetyAnswer = 'yes' | 'no' | 'na';

export interface SafetyQuestion {
  key: SafetyKey;
  question: string;
  short: string;          // used in the buddy text
  allowNA?: boolean;      // "I don't take any"
}

export const SAFETY_QUESTIONS: SafetyQuestion[] = [
  { key: 'water', question: 'Drinking water within reach?', short: 'Water' },
  { key: 'medicine', question: 'Your medicine for the next few days?', short: 'Medicine', allowNA: true },
  { key: 'cool', question: 'Is your home cool right now?', short: 'Home cool' },
  { key: 'phone', question: 'Phone charged above half?', short: 'Phone charged' },
];

export type TipAction = 'coolSpots' | 'billHelp' | null;

export interface SafetyTip {
  text: string;
  action: TipAction;
}

/** The one specific tip shown after a "no". */
export function tipFor(key: SafetyKey, p: HeatProfile): SafetyTip {
  switch (key) {
    case 'water':
      return {
        text: 'Fill a large bottle now and keep it where you sit. Sip often, even if you aren\'t thirsty. If your doctor limits fluids, ask how much is right in the heat.',
        action: null,
      };
    case 'medicine':
      return {
        text: 'Call your pharmacy today for a refill. Many deliver. Keep medicine out of hot cars and sunny windows; heat can ruin it.',
        action: null,
      };
    case 'cool':
      if (p.acOffToSave) {
        return {
          text: 'Please turn the AC on now. Setting it to 78–80°F instead of off keeps you safe and still saves money. Help with your bill is available.',
          action: 'billHelp',
        };
      }
      if (p.acUnreliable) {
        return {
          text: 'If the AC isn\'t keeping up, go somewhere cool for the afternoon and call for a repair. Don\'t wait it out in a hot house.',
          action: 'coolSpots',
        };
      }
      return {
        text: 'Head somewhere cool for the hottest hours, noon to 6 PM: a cooling center, library, or mall. Meanwhile, close the blinds and cool your skin with water.',
        action: 'coolSpots',
      };
    case 'phone':
      return {
        text: 'Plug it in now. If the power goes out, a charged phone is how you reach help. Keep a charged power bank too.',
        action: null,
      };
  }
}

/** Shown when the user says they don't feel well. */
export const UNWELL_GUIDANCE = {
  call911:
    'Call 911 now if you feel confused, faint, stop sweating, have a racing heart, or someone says you aren\'t acting like yourself.',
  steps: [
    'Move to the coolest place you can.',
    'Sip cool water.',
    'Cool your skin: wet cloths, a cool shower, or ice packs on your neck and armpits.',
    'Let someone know how you feel.',
  ],
};
