import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/content';
import { ogAlt, SITE_NAME } from '@/lib/site';
import { ogFonts } from './_og/fonts';

// Built from content at build time (top-level await), like the image itself.
export const alt = ogAlt(await getSettings());
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Typographic card: black, the full event name, the theme, date and campus.
 * Deliberately no TEDx logo or imitation of it, no uppercasing of the name and
 * no web address. Everything is centred, so a square centre crop (the 630 × 630
 * middle, used by some chat apps) keeps all of it, and every line stays
 * readable when the card is shown 300 px wide. Rendered once at build time.
 */
export default async function OpenGraphImage() {
  const [s, fonts] = await Promise.all([getSettings(), ogFonts()]);
  const grey = '#a6a6a6';
  const where = s.venueCampus || s.venueName;
  const themeSize = s.themeName.length > 12 ? 112 : 150;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          textAlign: 'center',
          background: '#000',
          color: '#fff',
          fontFamily: 'Inter',
          padding: '64px 0 44px',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Inter Display', fontWeight: 600, fontSize: 56, letterSpacing: -2 }}>
          {SITE_NAME}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              fontFamily: 'Inter Display',
              fontWeight: 600,
              fontSize: themeSize,
              letterSpacing: -themeSize * 0.05,
              lineHeight: 0.95,
            }}
          >
            {s.themeName}
            <div
              style={{
                display: 'flex',
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: themeSize * 0.22,
                color: '#fff',
                marginLeft: 8,
                marginTop: themeSize * 0.08,
                letterSpacing: 0,
              }}
            >
              1
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 34, marginTop: 36 }}>{`${s.dateMedium} · ${where}`}</div>
        </div>

        <div style={{ display: 'flex', fontSize: 18, color: grey }}>
          Independently organized TEDx event, operated under license from TED
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
