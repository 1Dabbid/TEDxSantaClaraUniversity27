import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { getSettings, getSpeakers } from '@/lib/content';
import { contentWarning, stripEmoji } from '@/lib/content-checks';
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

/**
 * The portrait as a small JPEG data URL, or null (the card is then drawn without
 * it). The loader has already checked the file type. The image is decoded and
 * resized to at most 800 px first: the share-image renderer cannot take a raw
 * phone photo (a portrait over ~7 MB used to fail the whole build). Any failure,
 * such as a corrupt or enormous file, falls back to the card without a portrait.
 */
async function portrait(publicPath: string | null, slug: string): Promise<string | null> {
  if (!publicPath) return null;
  try {
    const data = await sharp(join(process.cwd(), 'public', publicPath), { failOn: 'error' })
      .rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${data.toString('base64')}`;
  } catch (err) {
    contentWarning(
      `content/speakers/${slug}.yaml`,
      'Portrait',
      `the photo could not be read for the share image (${err instanceof Error ? err.message : String(err)}), so the share image has no portrait. Upload the photo again as a JPG under 2 MB.`,
    );
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
  const photo = announced ? await portrait(sp.photo, sp.slug) : null;
  const grey = '#a6a6a6';
  // No emoji in share images: the renderer would fetch emoji artwork from a CDN during the build.
  const name = (announced && stripEmoji(sp.name)) || 'To be announced';
  const talkTitle = announced ? stripEmoji(sp.talkTitle) : '';
  const themeName = stripEmoji(s.themeName);
  const place = stripEmoji(s.venueCampus || s.venueName);
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
            <div style={{ display: 'flex', fontSize: 32, color: grey, marginTop: 6 }}>{themeName}</div>
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
            {talkTitle ? (
              <div style={{ display: 'flex', fontSize: 36, lineHeight: 1.2, marginTop: 20, maxWidth: photo ? 640 : 1000 }}>
                {`“${talkTitle}”`}
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 30 }}>{`${s.dateMedium} · ${place}`}</div>
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
