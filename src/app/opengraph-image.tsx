import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/content';
import { ogAlt, seatsLabel, venueLine } from '@/lib/site';

// Built from content at build time (top-level await), like the image itself.
export const alt = ogAlt(await getSettings());
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Typographic card: black, the theme, date and venue, and the event name set
 * in plain text. Deliberately no TEDx logo or imitation of it.
 *
 * Set in Inter (the site face): the OG renderer cannot read woff2, so OTF
 * copies live next to this file in `_og/` (SIL OFL, see LICENSE-Inter.txt).
 * Rendered once at build time.
 */
const fontFile = (name: string) => readFile(join(process.cwd(), 'src/app/_og', name));

export default async function OpenGraphImage() {
  const [s, regular, display] = await Promise.all([
    getSettings(),
    fontFile('Inter-Regular.otf'),
    fontFile('InterDisplay-SemiBold.otf'),
  ]);
  const grey = '#8c8c8c';
  const line = '#2a2a2a';
  const mono = { fontSize: 18, letterSpacing: 4, textTransform: 'uppercase' as const, color: grey };

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#000',
          color: '#fff',
          fontFamily: 'Inter',
          padding: '56px 72px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', ...mono }}>
          <div style={{ display: 'flex' }}>§ 01 · The theme</div>
          <div style={{ display: 'flex' }}>fineprint.tedxscu.com</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              fontFamily: 'Inter Display',
              fontWeight: 600,
              fontSize: 208,
              letterSpacing: -11,
              lineHeight: 0.9,
            }}
          >
            {s.themeName}
            <div
              style={{
                display: 'flex',
                fontFamily: 'Inter',
                fontWeight: 400,
                fontSize: 40,
                color: s.accentColor,
                marginLeft: 12,
                marginTop: 20,
                letterSpacing: 0,
              }}
            >
              1
            </div>
          </div>
          <div style={{ display: 'flex', fontSize: 30, color: '#a6a6a6', marginTop: 28, maxWidth: 900 }}>
            {s.themeTagline}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', height: 1, background: line, marginBottom: 24 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 30 }}>{s.eventName}</div>
              <div style={{ display: 'flex', fontSize: 22, color: '#a6a6a6', marginTop: 8 }}>
                {`${s.dateLong} · ${venueLine(s)}`}
              </div>
            </div>
            <div style={{ display: 'flex', ...mono, fontSize: 16 }}>{seatsLabel(s.capacity)}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Inter', data: regular, weight: 400, style: 'normal' },
        { name: 'Inter Display', data: display, weight: 600, style: 'normal' },
      ],
    },
  );
}
