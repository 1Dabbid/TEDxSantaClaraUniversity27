/**
 * The site's small analytics vocabulary and `track()`, the only way an event is
 * sent. `track()` does nothing until src/components/Analytics.tsx has switched
 * analytics on for this visit, which it only does when the build has a
 * Measurement ID (src/lib/analytics-id.ts) and the browser has not asked not to
 * be tracked. So it is safe to call from anywhere, on the server too.
 *
 * What is sent is deliberately little: the event name and the few fixed words
 * below. No free text, no link addresses, no names, no email addresses, and
 * nothing a visitor types (the site has no forms; sign-up and ticket forms live on
 * other services and are never read).
 *
 * Owner-facing description of every event: docs/ANALYTICS.md.
 */

/** Where on the page a link was clicked. */
export type Place =
  | 'header'
  | 'footer'
  | 'closing_band'
  | 'page'
  // On the home page: the section the link is in.
  | 'hero'
  | 'theme'
  | 'speakers'
  | 'schedule'
  | 'venue'
  | 'tickets'
  | 'team'
  | 'faq'
  | 'newsletter';

/** Ticket status in Keystatic at the time of the click. */
export type TicketStateParam = 'coming_soon' | 'on_sale' | 'sold_out' | 'closed';

/**
 * Which version of the site the visitor got:
 * - motion_3d: the scroll-driven motion design with the live 3D scene;
 * - motion_stills: the motion design over still frames (no usable GPU, or the scene was not started);
 * - static_stills: the static design (Save-Data, a very slow connection, no WebGL);
 * - reduced_motion: the static design because the visitor asked for less motion
 *   (system setting or the footer switch).
 */
export type SiteTier = 'motion_3d' | 'motion_stills' | 'static_stills' | 'reduced_motion';

/** Every event the site sends itself, with its parameters. */
export type AnalyticsEvents = {
  /** A page was opened (first load or a client-side navigation). Sent by Analytics.tsx only. */
  page_view: { page_location: string; page_title: string; page_referrer?: string };
  /** A Tickets / Get tickets / Go to checkout button was clicked. */
  ticket_click: { place: Place; ticket_state: TicketStateParam };
  /** A link to the interest form was clicked. */
  interest_form_click: { place: Place };
  /** A link to the mailing-list sign-up form (hosted elsewhere) was clicked. */
  newsletter_click: { place: Place };
  /** A home-page section was on screen for about a second; once per section per visit. */
  section_view: { section: Exclude<Place, 'header' | 'footer' | 'closing_band' | 'page' | 'hero'> };
};

type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let on = false;

/**
 * Switches `track()` on and returns gtag(). Called once by Analytics.tsx. The
 * commands queue in `window.dataLayer` until gtag.js has loaded, and gtag.js only
 * understands the `arguments` object there, not an array.
 */
export function enableAnalytics(): Gtag {
  window.dataLayer = window.dataLayer ?? [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  on = true;
  return window.gtag;
}

export const analyticsEnabled = () => on;

/** Sends one event. A no-op when analytics is off. */
export function track<K extends keyof AnalyticsEvents>(name: K, params: AnalyticsEvents[K]): void {
  if (!on || typeof window === 'undefined') return;
  window.gtag?.('event', name, params);
}
