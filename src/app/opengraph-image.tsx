import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/content';
import { stripEmoji } from '@/lib/content-checks';
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
  // No emoji in share images: the renderer would fetch emoji artwork from a CDN during the build.
  const where = stripEmoji(s.venueCampus || s.venueName);
  const themeName = stripEmoji(s.themeName);
  const themeSize = themeName.length > 12 ? 100 : 140;

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
          padding: '52px 0 40px',
        }}
      >
        <div style={{ display: 'flex', fontFamily: 'Inter Display', fontWeight: 600, fontSize: 56, letterSpacing: -3 }}>
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
            {themeName}
          </div>
          {/* Two lines, so both stay inside the square centre crop. */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', fontSize: 34, lineHeight: 1.25, marginTop: 36 }}>
            <div style={{ display: 'flex' }}>{s.dateMedium}</div>
            <div style={{ display: 'flex', color: grey }}>{where}</div>
          </div>
        </div>

        <div style={{ display: 'flex', fontSize: 17, color: grey }}>
          This independent TEDx event is operated under license from TED.
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
