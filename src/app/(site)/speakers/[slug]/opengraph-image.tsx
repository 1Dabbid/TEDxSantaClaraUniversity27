import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { ImageResponse } from 'next/og';
import { getSettings, getSpeakers } from '@/lib/content';
import { SITE_NAME } from '@/lib/site';
import { ogFonts } from '../../../_og/fonts';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
const settings = await getSettings();
export const alt = `A speaker at ${SITE_NAME}: ${settings.themeName}, ${settings.dateLong}.`;

// Only the speakers known at build time: an unknown slug is a 404, never a freshly generated (and cached) image.
export const dynamicParams = false;

export async function generateStaticParams() {
  const speakers = await getSpeakers();
  return speakers.map((s) => ({ slug: s.slug }));
}

const MIME: Record<string, string> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

/** The portrait as a data URL (JPG/PNG under public/), or null. */
async function portrait(publicPath: string | null): Promise<string | null> {
  if (!publicPath) return null;
  const mime = MIME[extname(publicPath).toLowerCase()];
  if (!mime) return null;
  try {
    const data = await readFile(join(process.cwd(), 'public', publicPath));
    return `data:${mime};base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

/**
 * Per-speaker share card: name, talk title, event and theme, date; the portrait
 * in black and white when there is one. Unannounced speakers get a generic card
 * that reveals nothing. Plain type only: never the TEDx logo or an imitation of
 * it, and the event name is always set exactly as written (no uppercasing).
 */
export default async function SpeakerImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [s, speakers, fonts] = await Promise.all([getSettings(), getSpeakers(), ogFonts()]);
  const index = speakers.findIndex((sp) => sp.slug === slug);
  const sp = speakers[index];
  const announced = Boolean(sp?.announced);
  const photo = announced ? await portrait(sp.photo) : null;
  const grey = '#a6a6a6';
  const name = announced ? sp.name : 'To be announced';
  const nameSize = name.length > 22 ? 72 : name.length > 14 ? 88 : 104;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#000', color: '#fff', fontFamily: 'Inter' }}>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '56px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 56, fontFamily: 'Inter Display', fontWeight: 600, letterSpacing: -1.5 }}>
              {SITE_NAME}
            </div>
            <div style={{ display: 'flex', fontSize: 32, color: grey, marginTop: 6 }}>{s.themeName}</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 24, color: grey }}>
              {`Speaker ${String(index + 1).padStart(2, '0')}`}
            </div>
            <div
              style={{
                display: 'flex',
                fontFamily: 'Inter Display',
                fontWeight: 600,
                fontSize: nameSize,
                letterSpacing: -nameSize * 0.04,
                lineHeight: 0.95,
                marginTop: 12,
              }}
            >
              {name}
            </div>
            {announced && sp.talkTitle ? (
              <div style={{ display: 'flex', fontSize: 36, lineHeight: 1.2, marginTop: 20, maxWidth: photo ? 640 : 1000 }}>
                {`“${sp.talkTitle}”`}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 30 }}>{`${s.dateMedium} · ${s.venueCampus || s.venueName}`}</div>
            <div style={{ display: 'flex', fontSize: 18, color: grey, marginTop: 14 }}>
              Independently organized TEDx event, operated under license from TED
            </div>
          </div>
        </div>
        {photo ? (
          <div style={{ display: 'flex', width: 420, height: '100%' }}>
            <img
              src={photo}
              alt=""
              width={420}
              height={630}
              style={{ width: 420, height: 630, objectFit: 'cover', filter: 'grayscale(1) contrast(1.08)' }}
            />
          </div>
        ) : null}
      </div>
    ),
    { ...size, fonts },
  );
}
