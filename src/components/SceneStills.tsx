import styles from './SceneStills.module.css';

/**
 * Still frames of the 3D scene, for every visitor who does not get the live
 * canvas: no JavaScript, reduced motion, Save-Data, no WebGL, a software-only
 * renderer, or simply the seconds before the canvas has drawn. Rendered on the
 * server and driven by CSS only (SceneStills.module.css, plus the "Scene
 * stills" block in globals.css):
 *
 * - One fixed, full-viewport stack under the sections' scrims (same place as
 *   the canvas). Each section's still cross-fades in over the previous one as
 *   the section reaches the middle of the viewport (scroll-driven animations).
 *   A still is `display: none` until its section is close, so its lazy image
 *   is only requested then.
 * - Reduced motion, or browsers without scroll-driven animations (and no
 *   motion): no fixed stack; each section carries its still as its own
 *   background plate instead (globals.css).
 * - SceneGate sets `html.scene-pending` once it knows the live scene will load
 *   (non-hero stills are then never requested) and `html.scene-live` once the
 *   canvas has drawn and faded up; the stack then fades out and is removed.
 *
 * The images are frames of the real scene, captured by `npm run stills`
 * (scripts/capture-stills.mjs) into public/stills. Width and height below must
 * match that script's output sizes.
 */

const SHOTS = ['hero', 'theme', 'speakers', 'schedule', 'venue'] as const;
/** Same breakpoint as the scene's portrait choreography (aspect < 0.9). */
const PORTRAIT = '(max-aspect-ratio: 9/10)';
const LANDSCAPE_SIZE = { width: 1600, height: 900 };
const PORTRAIT_SIZE = { width: 780, height: 1560 };

export function SceneStills() {
  return (
    <div className={styles.stack} data-scene-stills aria-hidden="true">
      {SHOTS.map((name) => {
        const hero = name === 'hero';
        return (
          <picture key={name} className={`${styles.layer} ${styles[name]}`} data-still={name}>
            <source media={PORTRAIT} type="image/avif" srcSet={`/stills/${name}-portrait.avif`} {...PORTRAIT_SIZE} />
            <source media={PORTRAIT} type="image/webp" srcSet={`/stills/${name}-portrait.webp`} {...PORTRAIT_SIZE} />
            <source type="image/avif" srcSet={`/stills/${name}-landscape.avif`} {...LANDSCAPE_SIZE} />
            {/* A plain <picture>: art direction by orientation and format, and no JavaScript. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/stills/${name}-landscape.webp`}
              {...LANDSCAPE_SIZE}
              alt=""
              loading={hero ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority="low"
            />
          </picture>
        );
      })}
      {/* Fades the room to black after the venue, as the live scene does. */}
      <div className={`${styles.layer} ${styles.end}`} />
    </div>
  );
}
