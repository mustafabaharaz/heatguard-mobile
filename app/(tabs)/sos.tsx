// ─────────────────────────────────────────────────────────────────────────────
// HeatGuard · SOS tab slot
// This route only exists so the tab bar can reserve the center slot for the
// SOS hold button. The button never navigates here; if anything ever does,
// send the user back Home.
// ─────────────────────────────────────────────────────────────────────────────

import { Redirect } from 'expo-router';

export default function SOSTabPlaceholder() {
  return <Redirect href="/" />;
}
