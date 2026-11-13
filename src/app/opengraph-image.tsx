import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getSettings } from '@/lib/content';

export const alt = 'TEDxSantaClaraUniversity: Fine Print';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpenGraphImage() {
  const s = await getSettings();
  const logo = await readFile(join(process.cwd(), 'public/brand/logo-on-black.png'));
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`;

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
          padding: 72,
        }}
      >
        {/* Logo on solid black with clear space, unaltered. */}
        <img src={logoSrc} width={205} height={120} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 150, fontWeight: 700, letterSpacing: -8, lineHeight: 1 }}>{s.themeName}</div>
          <div style={{ fontSize: 32, color: '#a6a6a6', marginTop: 24 }}>{s.themeTagline}</div>
          <div style={{ fontSize: 24, color: '#fff', marginTop: 36, letterSpacing: 2, textTransform: 'uppercase' }}>
            {`${s.dateLong} · ${s.venueName}`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
