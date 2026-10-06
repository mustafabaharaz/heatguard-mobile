// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/features/emergency/types/contact.types.ts
// HeatGuard · Emergency contact
// isBuddy: a "heat buddy" gets the user's check-in results by text.
// ─────────────────────────────────────────────────────────────────────────────

export interface EmergencyContact {
  id: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  isPrimary: boolean;
  isBuddy?: boolean;
}
