'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { analyticsEnabled, enableAnalytics, track, type Place, type SiteTier, type TicketStateParam } from '@/lib/analytics';
import { SCENE_LIKELY_CLASS, SCENE_SLOW_EVENT, SCENE_SLOW_KEY } from '@/lib/motion-pref';
import { getQuality, getReduceMotion, sceneEnabled, subscribeQuality } from '@/lib/quality';
import { TICKET_CHECKOUT_ID } from '@/lib/tickets';

/**
 * Google Analytics 4, for the public site only. SiteShell renders this component
 * only when the build has a valid NEXT_PUBLIC_GA_MEASUREMENT_ID
 * (src/lib/analytics-id.ts): without it, nothing here is in the page. The admin
 * (/keystatic) is outside SiteShell and never gets it. Owner guide: docs/ANALYTICS.md.
 *
 * PRIVACY, and why each choice is made
 * - A browser that sends Global Privacy Control (navigator.globalPrivacyControl) or
 *   Do Not Track has already answered the question "may this visit be measured?"
 *   with no. For such a visitor nothing is loaded from Google, no cookie is set and
 *   no request is made: the site behaves exactly as it does with analytics off.
 * - Google signals and ad personalization are off (allow_google_signals: false,
 *   allow_ad_personalization_signals: false) and the advertising consent types are
 *   denied. The numbers are for the organizers to see whether the site works; they
 *   are never joined to Google accounts or used for advertising. This also keeps the
 *   Content-Security-Policy small: no advertising host is ever allowed.
 * - No user identifier is set (no user_id). Google's own first-party cookie (_ga) is
 *   the only thing that tells two visits apart.
 * - Only fixed words are sent with events (see src/lib/analytics.ts): never a link
 *   address, a name, an email address or anything typed. The site has no forms; the
 *   mailing-list, interest and ticket forms live on other services and are not read.
 * - Page addresses are sent without their #section and without their query string
 *   (only utm_* campaign tags are kept), so nothing that happens to be in a link can
 *   end up in the reports.
 *
 * PAGE VIEWS are sent by hand (send_page_view: false, then one `page_view` per
 * pathname) rather than by GA4's "page changes based on browser history events".
 * The home page is one long scroll whose #section links add history entries
 * (src/motion/inPage.ts), and QA links carry ?quality=; GA4's history listener
 * would count each of those as another page. Keyed on the pathname alone, each
 * real page is counted once per visit to it: first load and client-side
 * navigations, Back and Forward included. For this to hold, that one GA4 setting
 * must be switched off in the data stream (docs/ANALYTICS.md, step 4).
 *
 * PERFORMANCE: gtag.js is not in the HTML. It is added after the page has loaded,
 * after the 3D scene (when one is coming) has drawn its first frames, and then only
 * when the main thread is idle. Events that happen before that wait in
 * `window.dataLayer` and are sent once the script arrives.
 */

type Links = {
  /** Ticket shop link ('' when there is none). */
  ticket: string;
  /** Interest form link ('' when there is none). */
  interest: string;
  /** Mailing-list sign-up link ('' when there is none). */
  newsletter: string;
};

type Props = { id: string; ticketState: string; links: Links };

const SECTION_PLACES = new Set<string>(['hero', 'theme', 'speakers', 'schedule', 'venue', 'tickets', 'team', 'faq', 'newsletter']);
const SECTIONS_SEEN_KEY = 'fp:ga-sections';
/** A section counts as reached once it has held the middle of the screen this long (a jump past it does not count). */
const SECTION_DWELL_MS = 1000;
/** Longest wait for the 3D scene's first frames before loading gtag.js anyway. */
const SCENE_WAIT_MS = 8000;

// Module state: the site shell is mounted again when a visitor moves between a 404
// and a real page, and none of this may happen twice in one document.
let scriptRequested = false;
let lastPath: string | null = null;
let lastLocation = '';
let lastTier: SiteTier | null = null;
let sceneSlow = false;

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const dnt = nav.doNotTrack ?? (window as Window & { doNotTrack?: string }).doNotTrack ?? nav.msDoNotTrack;
  return nav.globalPrivacyControl === true || dnt === '1' || dnt === 'yes';
}

/** The address reported to Google: no #section, and of the query string only utm_* campaign tags. */
function cleanLocation(): string {
  const kept = new URLSearchParams();
  new URLSearchParams(window.location.search).forEach((value, key) => {
    if (/^utm_[a-z_]+$/.test(key)) kept.append(key, value);
  });
  const query = kept.toString();
  return window.location.origin + window.location.pathname + (query ? `?${query}` : '');
}

function siteTier(): SiteTier {
  if (getQuality() === 'static') {
    const reduced = getReduceMotion() || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduced ? 'reduced_motion' : 'static_stills';
  }
  return sceneEnabled() && !sceneSlow ? 'motion_3d' : 'motion_stills';
}

/** Runs `run` after window load, after the 3D scene (if one is expected) is live, at an idle moment. */
function whenSettled(run: () => void) {
  const idle = () => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 1200);
  };
  const afterLoad = () => {
    const root = document.documentElement;
    // SiteShell's boot script and SceneGate: the scene is expected but has not drawn yet.
    const waiting = () =>
      !root.classList.contains('scene-live') &&
      (root.classList.contains(SCENE_LIKELY_CLASS) || root.classList.contains('scene-pending'));
    if (!waiting()) return idle();
    const done = () => {
      observer.disconnect();
      clearTimeout(timer);
      idle();
    };
    const observer = new MutationObserver(() => {
      if (!waiting()) done();
    });
    const timer = setTimeout(done, SCENE_WAIT_MS);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
  };
  if (document.readyState === 'complete') afterLoad();
  else window.addEventListener('load', afterLoad, { once: true });
}

function placeOf(el: Element): Place {
  if (el.closest('header')) return 'header';
  if (el.closest('footer')) return 'footer';
  const section = el.closest('[data-section]')?.getAttribute('data-section');
  if (section && SECTION_PLACES.has(section)) return section as Place;
  // The closing band of a topic page (src/components/pages/ClosingBand.tsx).
  if (el.closest('section[aria-labelledby="next-title"]')) return 'closing_band';
  return 'page';
}

const sameUrl = (href: string, target: string) => {
  if (!target) return false;
  try {
    return new URL(href).href === new URL(target).href;
  } catch {
    return false;
  }
};

function readSeen(): Set<string> {
  try {
    return new Set((sessionStorage.getItem(SECTIONS_SEEN_KEY) ?? '').split(',').filter(Boolean));
  } catch {
    return new Set();
  }
}

export default function Analytics({ id, ticketState, links }: Props) {
  const pathname = usePathname();

  // Once per document: the privacy decision, the configuration, and the deferred script.
  useEffect(() => {
    if (analyticsEnabled() || optedOut() || window.location.pathname.startsWith('/keystatic')) return;
    const gtag = enableAnalytics();
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    });
    gtag('js', new Date());
    gtag('config', id, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    whenSettled(() => {
      if (scriptRequested) return;
      scriptRequested = true;
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);
    });
  }, [id]);

  // Which version of the site this visitor got, as a user property (kept up to date:
  // the GPU probe, the footer's motion switch and a too-slow scene can change it).
  useEffect(() => {
    if (!analyticsEnabled()) return;
    try {
      sceneSlow = sceneSlow || sessionStorage.getItem(SCENE_SLOW_KEY) === '1';
    } catch {
      /* storage blocked */
    }
    const report = () => {
      const tier = siteTier();
      if (tier === lastTier) return;
      lastTier = tier;
      window.gtag?.('set', 'user_properties', { site_tier: tier });
    };
    const onSlow = () => {
      sceneSlow = true;
      report();
    };
    report();
    const unsubscribe = subscribeQuality(report);
    window.addEventListener(SCENE_SLOW_EVENT, onSlow);
    return () => {
      unsubscribe();
      window.removeEventListener(SCENE_SLOW_EVENT, onSlow);
    };
  }, []);

  // One page_view per pathname: a #section or a query string never makes another.
  useEffect(() => {
    if (!analyticsEnabled() || pathname === lastPath || pathname.startsWith('/keystatic')) return;
    const first = lastPath === null;
    lastPath = pathname;
    const location = cleanLocation();
    const referrer = first ? undefined : lastLocation;
    lastLocation = location;
    // Later events (GA4's own scroll and outbound-click events too) report this clean address.
    window.gtag?.('set', { page_location: location, page_title: document.title });
    track('page_view', {
      page_location: location,
      page_title: document.title,
      ...(referrer ? { page_referrer: referrer } : {}),
    });
  }, [pathname]);

  // Clicks, through one listener: which link it is comes from where it leads (the
  // links set in Keystatic), where it is from the landmark it sits in.
  useEffect(() => {
    if (!analyticsEnabled()) return;
    const state = ticketState.replace(/-/g, '_') as TicketStateParam;
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      // The Tickets buttons: to the ticket shop once on sale, else to the Tickets
      // section or the checkout embedded in it. (Plain navigation links to
      // #tickets are navigation, not a ticket click.)
      const toTicketsSection =
        target.classList.contains('btn') &&
        target.origin === window.location.origin &&
        target.pathname === '/' &&
        (target.hash === '#tickets' || target.hash === `#${TICKET_CHECKOUT_ID}`);
      if (sameUrl(target.href, links.ticket) || toTicketsSection) {
        track('ticket_click', { place: placeOf(target), ticket_state: state });
      } else if (sameUrl(target.href, links.interest)) {
        track('interest_form_click', { place: placeOf(target) });
      } else if (sameUrl(target.href, links.newsletter)) {
        track('newsletter_click', { place: placeOf(target) });
      }
    };
    // Capture phase: the motion engine handles some clicks itself (in-page scrolling).
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [ticketState, links.ticket, links.interest, links.newsletter]);

  // Home page: which sections visitors actually reach, once each per visit.
  useEffect(() => {
    if (!analyticsEnabled() || pathname !== '/' || !('IntersectionObserver' in window)) return;
    const seen = readSeen();
    const timers = new Map<Element, ReturnType<typeof setTimeout>>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const section = entry.target.getAttribute('data-section') ?? '';
          clearTimeout(timers.get(entry.target));
          if (!entry.isIntersecting || seen.has(section)) continue;
          timers.set(
            entry.target,
            setTimeout(() => {
              if (seen.has(section)) return;
              seen.add(section);
              try {
                sessionStorage.setItem(SECTIONS_SEEN_KEY, [...seen].join(','));
              } catch {
                /* storage blocked: once per page load instead */
              }
              observer.unobserve(entry.target);
              track('section_view', { section: section as Exclude<Place, 'header' | 'footer' | 'closing_band' | 'page' | 'hero'> });
            }, SECTION_DWELL_MS),
          );
        }
      },
      // A section is "reached" when it crosses the middle of the screen, whatever its height.
      { rootMargin: '-50% 0px -50% 0px', threshold: 0 },
    );
    document.querySelectorAll('[data-section]').forEach((el) => {
      const section = el.getAttribute('data-section') ?? '';
      if (section !== 'hero' && SECTION_PLACES.has(section) && !seen.has(section)) observer.observe(el);
    });
    return () => {
      observer.disconnect();
      timers.forEach((t) => clearTimeout(t));
    };
  }, [pathname]);

  return null;
}
