import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/content';
import { OG_ALT } from '@/lib/site';

export const alt = OG_ALT;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Typographic card: black, the theme, date and venue, and the event name set
 * in plain text. Deliberately no TEDx logo or imitation of it.
 */
export default async function OpenGraphImage() {
  const s = await getSettings();
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
          padding: '56px 72px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', ...mono }}>
          <div style={{ display: 'flex' }}>§ 01 · The theme</div>
          <div style={{ display: 'flex' }}>fineprint.tedxscu.com</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', fontSize: 196, letterSpacing: -11, lineHeight: 0.9 }}>
            {s.themeName}
            <div style={{ display: 'flex', fontSize: 40, color: s.accentColor, marginLeft: 10, marginTop: 18, letterSpacing: 0 }}>
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
                {`${s.dateLong} · ${s.venueName}, ${s.venueCampus || 'Santa Clara University'}`}
              </div>
            </div>
            <div style={{ display: 'flex', ...mono, fontSize: 16 }}>100 seats</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
