import { Vector3 } from 'three';
import { MIC, MIC_AXIS, VIEW_AZ, fromHouse, micToWorld } from './layout';
import type { SectionId } from './scrollState';
import { SECTION_IDS } from './scrollState';

/**
 * Camera choreography as data.
 *
 * THE PRINCIPLE: ONE SUBJECT, ONE CONTINUOUS MOVE.
 *
 * The subject of the whole page is the microphone on its stand at the centre
 * of the red rug. It is always the subject and, once the engraving macro is
 * over, in frame until the very end, where the camera stands behind it and
 * the grille is the soft foreground of the speaker's view. The camera makes
 * ONE move over the whole journey, the way a motion-control crane shot in a
 * car film travels round its car: every frame follows from the one before,
 * nothing ever cuts, whips or reverses, and while a 3D section is on screen
 * the move never quite stops. Within that one shot each section has its own
 * moment: a different height, distance and lens, reached by a continuous move.
 *
 * The move, beat by beat (landscape; portrait is the same story with smaller
 * angles where the narrow frame needs them and the subject small and high in
 * the frame while copy passes):
 * 1. Hero -> Theme: one push in along the camera axis to the engraved band
 *    (an even zoom profile, at most about 1.45x per filmstrip step). In the
 *    macro the camera travels down the engraved barrel through the whole
 *    Theme pin (DESCENT), from the title row at the top of the band to the
 *    closing title at its foot, so the fine print passes up the frame line by
 *    line like a contract being read, while the sleeve turns a few degrees on
 *    its own axis (`turn`) and the rows roll sideways past the raking light.
 * 2. Theme -> Speakers, the reveal: one spiral pull out (J 1.6 to 2.85).
 *    The camera retreats from the foot of the band while it swings round the
 *    microphone (towards the grille side, about 26 degrees) and sinks below
 *    it, so the barrel, then the grille, sweep past close in the foreground
 *    and the stand, the beam and the curtain arrive with parallax. The light
 *    follows the reveal (keyed by the distance).
 * 3. Speakers, the low pass: the camera near the floor (knee height, about
 *    2 m from the stand, a wider lens) still circling; the microphone high in
 *    the frame under the beam, the rug along the bottom of the frame, the
 *    stand and its cable crossing the curtain's folds.
 * 4. Schedule, the orbit: the same orbit visibly goes round (about 65
 *    degrees over the section) while the camera rises and draws back; the
 *    beam and the microphone's silhouette against the back of the stage.
 *    Schedule's light beat is the beam's colour temperature going from warm
 *    to cool as the programme passes (`warm`).
 * 5. Venue, the crane: up to about 4 m, an oblique look down (about 25
 *    degrees, not straight down: a round rug seen from above does not change
 *    as the camera circles it) on the pool of light, with the rows of the
 *    house sweeping across the top of the frame as the orbit keeps going
 *    (about 8 to 9 degrees per filmstrip step); the crane peaks halfway
 *    through the section and starts down and in towards the house.
 * 6. Tickets, the speaker's view: the orbit carries on while the crane comes
 *    down and in, until (about J 5.7) the camera stands behind the microphone
 *    at a speaker's eye height, just over the grille, looking out at the 100
 *    seats of the house (HOUSE_LOOK; the aim leaves the stand for the house,
 *    Aim `out`), the grille close and dark in the foreground. The seat counter
 *    (numerals, ruler, caption) scrolls up through the whole frame here, so
 *    the grille is led by the page (endKeys): it comes down between the two
 *    numerals to the foot of the frame, then rides up under the counter's
 *    caption, in the empty space above the end of the section, drifting to
 *    the right, while the camera sinks behind it to a speaker's eye. It holds
 *    that view, lit, to about J 5.9 (while the counter runs), then the lights
 *    go down. About 190 degrees of orbit in all as keyed, one way.
 * 7. After Tickets: the lights go down; the move eases to a stop in the dark,
 *    and the scene stays dark (and stops drawing) under Team, FAQ, Newsletter
 *    and the footer.
 * 8. Idle: with the page at rest the frame still breathes (a few millimetres
 *    of camera float, the dust and the haze rolling in the beam). The static
 *    tier (reduced motion) has no canvas at all.
 * 9. Reacting: on top of these keys (never changing them), rig.ts (REACT)
 *    orbits the camera a little round the subject with the pointer, the
 *    device tilt or a slow sway, gives the view a little weight, and the
 *    lights follow the pointer. The subject keeps its place on screen (the
 *    room slides behind it), and the speaker's view answers least (`react`).
 *
 * The camera is held on a sphere round the subject: an aim point (`aim`,
 * held at the screen anchor), a distance (`dist`), an orbit angle (`orbit`,
 * degrees round the vertical, 0 = the hero's heading VIEW_AZ) and an
 * elevation (`elev`, degrees). The whole move is written as a few keys per
 * channel (the *_MOVE tables below) and the shot list is sampled from them at
 * an even spacing, so the speed of the move is decided in one place and stays
 * even across section boundaries. Where the subject sits across the width over
 * Speakers, Venue and Tickets is measured from the page layout
 * (contentLayout.ts), so it keeps clear of the copy at every desktop width.
 *
 * When you edit the move, keep to the rules the debug simulator checks
 * (`__sceneSim.motion()` with ?scene-debug=1; it prints pass / fail):
 * - the orbit angle never reverses; the distance to the subject only grows
 *   through the pull out; the camera only rises from the low pass to the top
 *   of the crane, and only comes down and in from there to the speaker's
 *   view (MOTION_LIMITS.pullJ, riseJ, comeDownJ);
 * - per filmstrip step (2.5% of the Theme..Tickets journey, J 0.125) the
 *   view direction turns by at most MOTION_LIMITS.viewDeg, the subject moves
 *   by at most MOTION_LIMITS.screen of the frame and the scale changes by at
 *   most MOTION_LIMITS.zoom (log of the distance), with no single step more
 *   than MOTION_LIMITS.spike times the median step of its beat and no sudden
 *   change of speed between neighbouring steps (MOTION_LIMITS.accel,
 *   zoomAccel): the channels are monotone cubics, velocity continuous;
 * - no run of more than MOTION_LIMITS.stillRun steps without camera change
 *   while a 3D section is on screen;
 * - through the Theme pin (DESCENT_J) the macro descends the engraved band:
 *   down the barrel axis at every step, never turning back, never still, at
 *   most MOTION_LIMITS.descentMax of the frame's height per step, and over at
 *   least MOTION_LIMITS.descentMin of the band in all;
 * - the speaker's view (MOTION_LIMITS.speakerJ) stands behind the microphone
 *   at a speaker's eye height with the seats filling the frame and the grille
 *   in the foreground band, above where the page below Tickets starts (the
 *   audit passes that edge, measured at each step);
 * - over the stage the camera keeps MOTION_LIMITS.curtainAir in front of the
 *   back curtain;
 * - the subject stays inside the frame and, given the copy boxes of the page
 *   at each step (the audit script collects them), clear of every line of
 *   text and every panel (landscape), or behind headings, buttons and panels
 *   only briefly or under the band veil (portrait);
 * - light changes ride on the move (never in one step), and nothing bright
 *   passes behind body copy (the veils: scrim, scrimEdge, band, shade; the
 *   rendered frames are checked for the contrast behind the copy).
 *
 * Journey coordinate `J`: continuous over the home page, 0 at the top to 9 at
 * the foot (Team, FAQ and Newsletter are sections 6 to 8; the scene is dark
 * from DARK_FROM = 6 on); section k (in SECTION_IDS order) spans [k, k+1) and
 * the fraction is how far the viewport centre has travelled through it. So J = 0.5 is the hero's middle at the
 * viewport centre; on a 1440x900 screen 1.22..1.78 is the pinned part of the
 * 225vh theme runway and the speakers stage pins at about 2.25; 2.5 is
 * speakers centred, and so on.
 *
 * Every channel (distance, orbit, elevation, aim point, anchor, roll, light)
 * is interpolated with a monotone cubic (Fritsch-Carlson) through the shots:
 * no overshoot, velocity continuous across shots, zero velocity where two
 * shots hold the same value. The camera then follows that path with
 * critically damped springs (rig.ts).
 */

export type V3 = readonly [number, number, number];

/** The point of the subject held at the screen anchor. */
export type Aim =
  /** A point on the microphone's axis, mic-space height (m, tail = 0, the engraved band is 0.05..0.10). */
  | { mic: number }
  /**
   * A height above the floor (m) on the vertical line through the barrel's middle (the stand line);
   * `out` (0..1) carries the aim from there towards HOUSE_LOOK, out in the house, while the camera
   * still circles the subject (the speaker's view at the end of Tickets looks past the grille);
   * `outX` moves that point across the house (house-space x, m; phones look a little to one side,
   * so the narrow frame keeps the grille in it).
   */
  | { stand: number; out?: number; outX?: number };

export type Shot = {
  at: number;
  aim: Aim;
  /** Camera distance (m) from the aim's track origin. */
  dist: number;
  /**
   * Orbit angle round the vertical through the subject (degrees, 0 = the hero's
   * heading VIEW_AZ; negative swings the camera round towards the grille side).
   */
  orbit?: number;
  /** Elevation of the camera above the subject (degrees, default TRACK_ELEV). */
  elev?: number;
  /** Extra camera height (m), straight up. */
  lift?: number;
  /** Where the aim point sits on screen, [x from the left, y from the top], 0..1. Applied as a lens shift. */
  anchor: readonly [number, number];
  /** Roll about the view axis towards the barrel: 0 horizon level, 1 the barrel upright on screen (engraved rows level). */
  roll?: number;
  fov: number;
  exposure: number;
  /** Edge blur 0..1 (fake depth of field). */
  dof?: number;
  /** Idle drift amplitude, metres. */
  drift?: number;
  /** Pointer parallax amplitude, metres. */
  parallax?: number;
  /** Volumetric cone visibility multiplier. */
  cone?: number;
  /** Overhead spot intensity multiplier. */
  spot?: number;
  /** Extra environment rotation (radians): moves the reflected strip highlights. */
  envRot?: number;
  /** Darken the right side of the frame (0..1), for text over the canvas. */
  shade?: number;
  /** Key light on the mic, multiplier. */
  key?: number;
  /** 0: key light orbits the mic; 1: key light rides with the camera (macro glints). */
  keyCam?: number;
  vignette?: number;
  /** Rim light on the mic and hardware, multiplier (default 1). */
  rim?: number;
  /** Where the rim light sits around the view axis, radians: 0 = above, +PI/2 = screen right. */
  rimAng?: number;
  /** Soft atmospheric glow behind the subject, 0..1. */
  haze?: number;
  /** Out-of-focus dust motes in front of the lens, 0..1. */
  motes?: number;
  /**
   * Camera-relative position of the key light while it rides the camera
   * (keyCam = 1): [right, up, forward] in multiples of the focus distance.
   */
  keyDir?: V3;
  /** Screen point that stays sharp under the edge blur, 0..1 (x right, y up); defaults to the anchor. */
  focus?: readonly [number, number];
  /** Darken the left / centre of the frame (0..1) behind headline type. */
  scrim?: number;
  /** Darken thin bands along the top and bottom edges (0..1), behind section labels and captions. */
  scrimEdge?: number;
  /** Darken a soft horizontal band across the upper middle of the frame (0..1), behind a full-width heading. */
  band?: number;
  /** Highlight bloom multiplier (high tier). */
  bloom?: number;
  /** Studio environment (reflection strips) intensity, default 1. */
  env?: number;
  /** Colour temperature of the overhead spot and its beam: +1 warm, 0 neutral, -1 cool. */
  warm?: number;
  /** Turn of the barrel sleeve (engraving, knurl) about the mic axis, radians. */
  turn?: number;
  /**
   * How much the camera answers the visitor here (pointer, tilt, sway, scroll kick; rig.ts REACT),
   * 0..1, default 1. Turned down where the framing has no room to give: the speaker's view, where
   * the grille is a hand's breadth from the lens.
   */
  react?: number;
};

export type ResolvedShot = {
  at: number;
  /** Camera position. */
  pos: Vector3;
  /** Aim point (held at the screen anchor). */
  target: Vector3;
  /** Unit offset from the target to the camera, and the log of that distance (the rig damps these, not pos). */
  dir: Vector3;
  logDist: number;
  up: Vector3;
  /**
   * Track: origin, log of the distance, orbit and elevation (radians), lift.
   * The camera is origin + trackDir(orbit, elev) * exp(logU) + lift * Y.
   */
  origin: Vector3;
  logU: number;
  orbit: number;
  elev: number;
  lift: number;
  /** Roll about the view axis (radians). */
  roll: number;
  /** Screen anchor of the target (fractions from the left / top). */
  shiftX: number;
  shiftY: number;
  fov: number;
  exposure: number;
  dof: number;
  drift: number;
  parallax: number;
  cone: number;
  spot: number;
  envRot: number;
  shade: number;
  key: number;
  keyCam: number;
  vignette: number;
  rim: number;
  rimAng: number;
  haze: number;
  motes: number;
  keyDir: Vector3;
  focusX: number;
  focusY: number;
  scrim: number;
  scrimEdge: number;
  band: number;
  bloom: number;
  env: number;
  warm: number;
  turn: number;
  react: number;
};

/**
 * Camera rig tuning. The rig follows the sampled path as a target point plus
 * an offset (direction on the sphere, distance in log space), each critically
 * damped (`follow`, seconds), so the camera can never pass through its own
 * subject however fast the page is flung. The view direction trails that
 * through a critically damped spring (no overshoot: nothing swings back).
 */
export const RIG = {
  /** Smoothing of the journey coordinate itself (seconds). */
  journeySmooth: 0.5,
  /** Offset (direction, distance) follow time (seconds). */
  follow: 0.3,
  /** Target point follow time (seconds). */
  targetFollow: 0.3,
  /** View-direction spring frequency (Hz) and damping ratio (1: critically damped). */
  targetFreq: 1.2,
  targetZeta: 1,
  /**
   * Bank angle per unit of lateral angular velocity (rad per rad/s), and its
   * limit: the camera leans into its turns like a hand-operated head, bounded
   * to under two degrees however fast the page is flung.
   */
  rollGain: 0.05,
  rollMax: 0.03,
  /** Lens-shift (screen anchor) follow time (seconds). */
  anchorFollow: 0.4,
};

/* ------------------------------------------------------------------------- */
/* The sphere round the subject                                              */
/* ------------------------------------------------------------------------- */

/** Point on the mic (mic-space y), in world space. */
export const micPoint = (y: number) => micToWorld(new Vector3(0, y, 0));

/** The middle of the barrel (the hero's aim): the top of the stand line and the centre of the orbit. */
export const SPINE = micPoint(0.095);
/** The centre of the grille: the point the end of Tickets is framed by (Move.holdHead). */
export const GRILLE = micPoint(MIC.grilleC);
/** Elevation of the hero's camera axis (radians): the camera looks a little down on the subject. */
export const TRACK_ELEV = 0.07;
const DEG = Math.PI / 180;

/** Unit direction from the subject towards the camera for an orbit and an elevation (radians). */
export function trackDir(orbit: number, elev: number, out = new Vector3()): Vector3 {
  const az = VIEW_AZ + orbit;
  return out.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), Math.cos(az) * Math.cos(elev));
}
/** The hero's camera axis (orbit 0). */
export const TRACK = trackDir(0, TRACK_ELEV);

/**
 * The limits of the move (checked by `__sceneSim.motion()`), per filmstrip step of J 0.125 (2.5% of
 * the Theme..Tickets journey, about 150 to 250 px of scroll on a desktop screen). Set for an
 * "in between" energy: bigger arcs, closer passes and a clear moment in each section, but one
 * connected shot that never cuts, whips or flies.
 */
export const MOTION_LIMITS = {
  /**
   * Largest turn of the view direction per step (degrees). 11 (the calm cut had 3.5): the orbit
   * visibly goes round over Schedule and Venue (about 65 and 60 degrees in eight steps each, 8 to
   * 10 per step) and the view lifts from the stand to the house as the camera comes down behind
   * the microphone; still far from a whip (the first cut turned 60 degrees and more between two
   * neighbouring frames).
   */
  viewDeg: 11,
  /**
   * Per beat, a tighter limit on the view turn per step, so that a later edit cannot spend the
   * Schedule orbit's budget somewhere else (a whip confined to a single step of a calm beat).
   */
  viewDegBeat: { 'b1 hero+macro': 3, 'b2 pull out': 9, 'b4 crane': 10, 'b5 come down': 10, "b6 speaker's view": 6 },
  /**
   * Largest move of the subject on screen per step (fraction of the frame's long side). 7% (the
   * calm cut had 3%): the subject now travels on screen with the low pass and the orbit (the stand
   * crossing the frame as the camera circles it close, its foot rising up the frame as the camera
   * climbs out of the low pass).
   */
  screen: 0.07,
  /**
   * From `screenNear.from` (the crane coming down over Tickets) the grille is the near foreground:
   * coming down onto it and lifting the view past it to the house moves it down the frame faster,
   * by at most `screenNear.limit` per step (the parallax of a close pass is the point of the shot).
   */
  screenNear: { from: 5.0, limit: 0.14 },
  /**
   * From `rideFrom` the grille meets the seat counter and then rides up the frame with the page, in
   * the empty space under the counter's caption (endKeys): it keeps its place against the copy the
   * reader is following. A step is judged there by the smaller of the subject's move on screen and
   * its move against the page (the page's own scroll over the step taken out).
   */
  rideFrom: 5.625,

  /** No step may be more than this many times the median step of its beat. */
  spike: 2.2,
  /** Largest change of scale per step: |change of ln(camera-to-aim distance)| (0.47 is 1.6x). */
  zoom: 0.55,
  /**
   * Velocity continuity: the largest change between neighbouring steps, relative to the larger of
   * the two, for the view turn and for the change of scale (counted once the step is visible).
   */
  accel: 0.5,
  zoomAccel: 0.5,
  /** The scale continuity rule counts once a step changes the scale by more than this (ln; 0.15 is 16%). */
  zoomAccelFrom: 0.15,
  /**
   * Copy keep-out with the real layout (the audit script passes the copy boxes): from the landing of
   * the pull out on the stage to the moment the Tickets copy fills the frame. Landscape: the
   * subject never touches a line of text or a panel, with `copyAirPx` of air round text and
   * `copyPanelAirPx` round a panel's edge. The window ends at 5.3 (the calm cut: 5.45): from there
   * the camera comes down behind the microphone, the grille is the near foreground of the speaker's
   * view, and the seat counter's numerals and the ticket details close the gap the stand stood in
   * (on wide screens to a few dozen pixels); the legibility of the copy over the frame is checked on
   * the rendered frames from there to the end of Tickets instead (legib.py with the page's own
   * backgrounds, the veils taking the frame down where needed).
   */
  copyJ: [2.25, 5.3] as const,
  copyAirPx: 24,
  copyPanelAirPx: 12,
  /**
   * Portrait: the copy runs the full width and scrolls through the whole height, so no screen place
   * stays clear of it. Headings, buttons and panels may pass the subject only briefly (at most
   * `portraitRun` consecutive steps, at most `portraitShare` of the steps) unless the band veil is
   * at least `portraitVeil` there (the subject taken down under the heading); body text may pass
   * over it where the frame behind the text stays dark enough (checked on the rendered frames).
   */
  portraitRun: 2,
  portraitShare: 0.3,
  portraitVeil: 0.45,
  /**
   * The subject's frame: the whole microphone in frame from `frameMicFrom` (the pull out has left the
   * barrel; before it the aim point's lens shift is what moves on screen), the stand's foot from
   * `frameFootFrom` (the pull out has landed; before it the foot rising into the frame as the stand
   * shrinks is the reveal itself, and its speed is the pull out's, which the scale rule limits).
   */
  frameMicFrom: 2.375,
  frameFootFrom: 3.45,
  /** ...and to `frameFootTo`: then the camera comes down behind the microphone and the stand runs out of the frame below it. */
  frameFootTo: 5.2,
  /** The tail of the microphone to `frameTailTo`: in the speaker's view it runs out of the frame below the grille. */
  frameTailTo: 5.55,
  /**
   * The monotonic stretches (besides the orbit, one way round from J 1.9 to the end): the distance
   * to the subject grows through the pull out (`pullJ`); the camera rises from the low pass to the
   * top of the crane (`riseJ`); from there it comes down and in to the speaker's view (`comeDownJ`):
   * lower and closer at every step.
   */
  pullJ: [1.7, 2.85] as const,
  riseJ: [3.2, 4.45] as const,
  comeDownJ: [4.55, 6.0] as const,
  /**
   * The speaker's view (`speakerJ`): the camera behind the microphone (upstage of the stand) at a
   * speaker's eye height (`speakerEye`, m); at least `speakerSeats` of the 100 seats in frame (phones `speakerSeatsPortrait`),
   * spread over at least `speakerSeatSpan` of its width; the grille in the foreground band: within
   * `speakerHeadSide` of a side of the frame or of its foot (it arrives at the foot of the frame and
   * rides up the right side under the seat counter's caption) and nearer than `speakerHeadNear` of the
   * distance to the nearest seat. The window is the held part of the view, from the arrival to the
   * moment the page below Tickets comes up over the lower frame.
   */
  speakerJ: [5.7, 5.9] as const,
  /** Phones: the grille comes down between the counter's numerals a little later (the frame's long side is its height), so the view arrives later. */
  speakerJPortrait: [5.75, 5.9] as const,

  speakerEye: [1.5, 1.9] as const,
  speakerSeats: 70,
  /** Phones: the narrow frame takes the middle of the house. */
  speakerSeatsPortrait: 20,
  speakerSeatSpan: 0.6,
  speakerHeadSide: 0.37,

  speakerHeadNear: 0.2,
  /** With the page's edges: the grille at least this far (fraction of the height) above where the page below Tickets starts. */
  speakerEdgeAir: 0.04,
  /**
   * With the page's copy: from `speakerClear` to the fade, with the page at rest, the grille's disc
   * keeps at least `speakerCopyAirPx` from every line of text: it rides in the empty space under the
   * seat counter's caption, never on the numerals, the ruler's numbers or the caption. Phones, from
   * `speakerClearPortrait`: the counter runs the full width there and the grille has to cross its
   * ruler and caption on the way down (to about J 5.8), so until it is under the caption it either
   * keeps that air or is taken down to a dark shape behind the text: its own light (key plus rim)
   * at most `speakerDimPortrait`. The same on a phone on its side (sidewaysPhone), from
   * `speakerClearSideways`: its counter is stacked like a phone's and the frame is short, so the
   * grille meets the numerals earlier.
   */
  speakerClear: 5.75,
  speakerClearPortrait: 5.6,
  speakerClearSideways: 5.5,
  speakerDimPortrait: 0.2,
  speakerCopyAirPx: 6,

  /** Over the stage (J 3 to 6) the camera stays at least this far (m) in front of the back curtain. */
  curtainAir: 0.3,
  /** While a 3D section is on screen, at most this many consecutive steps without camera change. */
  stillRun: 3,
  /**
   * The descent down the engraved band through the Theme pin (DESCENT_J): the aim travels down the
   * barrel axis at every step (at least `descentStepMin` metres, about a third of a line of the fine
   * print, so it never reads as a hold), never back up by more than `descentBackTol` metres, by at
   * most `descentMax` of the frame's height per step (the rows stay readable as they pass), and over
   * at least `descentMin` of the band's height in all.
   */
  descentStepMin: 0.0006,
  descentBackTol: 0.0001,
  descentMax: 0.3,
  descentMin: 0.5,
};

/**
 * Where the speaker's view looks: a point on the house's centre line over the middle rows of
 * seats, a little below a speaker's eye, so the 100 seats fill the middle of the frame round it
 * and the grille sits below them.
 */
export const HOUSE_LOOK = fromHouse(new Vector3(0, 1.35, 9.0));
const houseLook = new Vector3();

/** World position of an aim point on the subject (the move out into the house is applied in resolveShot). */
export function aimPoint(aim: Aim, out = new Vector3()): Vector3 {
  if ('mic' in aim) return micToWorld(out.set(0, aim.mic, 0), out);
  return out.set(SPINE.x, aim.stand, SPINE.z);
}

/**
 * The aim carried out into the house (Aim `out`): the view direction turns from the point on the
 * stand towards HOUSE_LOOK by that fraction of the angle between them, as seen from the camera, and
 * the aim's distance follows, so the turn runs at the pace of the keys (a straight blend of the two
 * points would do most of the turn in its first few centimetres).
 */
const aimA = new Vector3();
const aimB = new Vector3();
function aimOut(pos: Vector3, target: Vector3, out: number, outX: number): Vector3 {
  const look = outX ? fromHouse(houseLook.set(outX, HOUSE_LOOK.y, 9.0), houseLook) : HOUSE_LOOK;
  const a = aimA.subVectors(target, pos);
  const la = a.length();
  const b = aimB.subVectors(look, pos);
  const lb = b.length();
  a.divideScalar(la);
  b.divideScalar(lb);
  const ang = Math.acos(Math.min(1, Math.max(-1, a.dot(b))));
  if (ang < 1e-6) return target;
  const s = Math.sin(ang);
  const wa = Math.sin((1 - out) * ang) / s;
  const wb = Math.sin(out * ang) / s;
  return target.copy(pos).addScaledVector(a.multiplyScalar(wa).addScaledVector(b, wb), la + (lb - la) * out);
}
/**
 * The centre of the camera's sphere: the aim point itself on the barrel (a
 * slide along the barrel carries the camera with it, so it never turns), the
 * top of the stand line otherwise (the camera orbits and rises round the stand
 * line while the aim moves down it).
 */
function trackOrigin(aim: Aim, out = new Vector3()): Vector3 {
  return 'mic' in aim ? aimPoint(aim, out) : out.copy(SPINE);
}

/* ------------------------------------------------------------------------- */
/* Shots                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Where the page puts its copy (desktop 1440x900), which the subject keeps
 * clear of (the audit checks it against the real copy boxes at every width):
 * - hero 0..0.55 (scroll 0 lands near J 0.45): the text column covers the left 60%
 * - theme J 0.8..2.02: headline phrases left / centre, the right 42% open for the engraving
 * - speakers J 2..3: heading top left, a glass panel along the bottom (at most
 *   60% of the width on large screens); the subject sits right of it; when
 *   speakers are announced, a strip of cards along the lower edge
 * - schedule J 3..4: a column on the left 40%
 * - venue J 4..5: heading top left, a location plate on its own dark ground at
 *   the top right, then a full-width row of facts: the subject rides in the
 *   gutter between the facts' text and the plate (measured)
 * - tickets J 5..6: heading left, ticket details right (the subject in the gap
 *   between them, measured), big numerals at the bottom
 *
 * Phones: the copy runs the full width and scrolls through the whole height;
 * the subject sits small in the upper middle, and the band veil takes it down
 * while a section's opening lines pass it.
 */

const DARK = { exposure: 0, drift: 0, parallax: 0, key: 0, spot: 0, cone: 1, vignette: 0.8 };

/**
 * Look values: everything a shot carries besides its geometry. The key light's
 * camera-relative direction (Shot.keyDir) is carried as three numbers and the
 * sharp point of the edge blur as an offset from the screen anchor, so that
 * every field interpolates along the move.
 */
type Look = Omit<Shot, 'at' | 'aim' | 'dist' | 'orbit' | 'elev' | 'lift' | 'anchor' | 'roll' | 'keyDir' | 'focus' | 'turn' | 'react'> & {
  kx?: number;
  ky?: number;
  kz?: number;
  /** Sharp point of the edge blur relative to the anchor (fractions of the frame; x right, y up). */
  fdx?: number;
  fdy?: number;
};
/** Every look field with its neutral value: each light key starts from it, so every key carries every field. */
const LOOK_BASE: Required<Look> = {
  fov: 30,
  exposure: 1,
  dof: 0,
  drift: 0,
  parallax: 0,
  cone: 1,
  spot: 1,
  envRot: 0,
  shade: 0,
  key: 1,
  keyCam: 0,
  vignette: 0.6,
  rim: 1,
  rimAng: 0.5,
  haze: 0,
  motes: 0,
  scrim: 0,
  scrimEdge: 0,
  band: 0,
  bloom: 1,
  env: 1,
  warm: 0,
  kx: -0.18,
  ky: 0.9,
  kz: 0,
  fdx: 0,
  fdy: 0,
};

/** Macro look shared by the engraving shots: raking key from screen right, bright side right. */
const MACRO = {
  fov: 28,
  exposure: 1.12,
  dof: 0.85,
  drift: 0.0012,
  parallax: 0.0018,
  cone: 0,
  spot: 0,
  key: 0.75,
  keyCam: 1,
  rim: 0.4,
  rimAng: 1.2,
  haze: 0,
  motes: 1,
  vignette: 0.85,
  // The studio strips walk round the barrel (the macro itself holds orbit 0): the streak runs down
  // the engraved column, a little right of the row starts, so the etched copy reads bright.
  envRot: -0.72,
  env: 0.4,
  fdx: -0.02,
  scrim: 0.55,
  scrimEdge: 0.9,
  bloom: 1.3,
};

const HERO_LOOK = { fov: 30, exposure: 1.05, drift: 0.012, parallax: 0.022, cone: 0.05, spot: 0.45, key: 1.15, rim: 1.5, rimAng: 0.45, haze: 1, vignette: 0.6, bloom: 1 };
/** Halfway along the push in: the barrel fills the right of the frame, the key starts to ride the camera. */
const PUSH_LOOK = { fov: 28, exposure: 1.05, dof: 0.45, drift: 0.004, parallax: 0.006, cone: 0.015, spot: 0.15, key: 0.7, keyCam: 0.7, kx: 1.1, ky: 1.8, kz: 0.4, rim: 0.7, rimAng: 1.0, haze: 0.3, motes: 0.5, vignette: 0.75, envRot: 0.4, env: 0.5, scrim: 0.4, scrimEdge: 0.85, bloom: 1.2 };
/** The stage under its light: Speakers and everything after it. */
const STAGE_LOOK = { fov: 32, exposure: 1, dof: 0.1, drift: 0.006, parallax: 0.025, cone: 1.3, spot: 1, key: 0.5, keyCam: 0, rim: 0.9, rimAng: -0.6, haze: 0, motes: 0, vignette: 0.62, bloom: 1.1, env: 1 };
/**
 * The low pass over Speakers: a wider lens near the floor, the beam bright above the microphone
 * (looking up into the haze), the rug soft along the bottom of the frame.
 */
const LOW_LOOK = { ...STAGE_LOOK, fov: 48, dof: 0.28, cone: 0.85, spot: 0.82, key: 0.62, rim: 1.15, rimAng: -0.4, vignette: 0.64, warm: 0.15 };
/**
 * The speaker's view at the end of Tickets: from inside the beam behind the microphone, looking
 * out over the house; the haze kept thin so the seats read, the grille lit from behind by the rim
 * and soft under the edge blur, which keeps the middle rows sharp.
 */
const SPEAKER_LOOK = { ...STAGE_LOOK, fov: 38, exposure: 1.0, dof: 0.5, cone: 0.4, spot: 0.8, key: 0.35, rim: 1.4, rimAng: 0.9, haze: 0, vignette: 0.58, scrimEdge: 0.7, warm: -0.18 };

/*
 * Looks along the spiral pull out, between the macro and the lit stage. The key light leaves the
 * camera (keyCam 1 -> 0) and the rim swings from screen right to the upstage side. The stage is
 * never dark behind the subject: the overhead spot already glows warm in the haze while the whole
 * microphone is still in frame on its own, and the shaft grows as the stand and the rug arrive.
 */
/** The barrel standing back from upright, the engraving still lit by the raking key. */
const PULL_BARREL = { fov: 29, exposure: 1.06, dof: 0.5, drift: 0.003, parallax: 0.006, cone: 0, spot: 0, key: 0.8, keyCam: 0.75, kx: 1.8, ky: 1.7, kz: 0.35, rim: 0.7, rimAng: 0.6, haze: 0.15, motes: 0.5, vignette: 0.8, envRot: -0.5, env: 0.45, scrim: 0.45, scrimEdge: 0.75, bloom: 1.2 };
/** Barrel and grille; the spot starts to warm the haze behind. */
const PULL_MIC = { fov: 29.5, exposure: 1.03, dof: 0.4, drift: 0.004, parallax: 0.008, cone: 0.1, spot: 0.32, key: 0.85, keyCam: 0.5, kx: 1.5, ky: 1.6, kz: 0.3, rim: 1.0, rimAng: 0.1, haze: 0.3, motes: 0.2, vignette: 0.75, envRot: -0.2, env: 0.55, scrim: 0.4, scrimEdge: 0.6, bloom: 1.1 };
/** The whole microphone in the warm haze of the spot. */
const PULL_WHOLE = { fov: 30, exposure: 1, dof: 0.3, drift: 0.004, parallax: 0.012, cone: 0.2, spot: 0.46, key: 0.85, keyCam: 0.3, kx: 1.4, ky: 1.6, kz: 0.3, rim: 1.2, rimAng: -0.3, haze: 0.25, motes: 0, vignette: 0.72, envRot: 0, env: 0.6, scrim: 0.35, scrimEdge: 0.5, bloom: 1.1 };
/** Microphone and upper stand, the spot warming. */
const PULL_STAND = { fov: 31, exposure: 1, dof: 0.22, drift: 0.005, parallax: 0.016, cone: 0.26, spot: 0.55, key: 0.8, keyCam: 0.1, rim: 1.15, rimAng: -0.45, haze: 0.08, motes: 0, vignette: 0.68, env: 0.75, scrim: 0.2, scrimEdge: 0.3, bloom: 1.1 };

/**
 * Journey position at or beyond which the scene is fully dark: the end of
 * Tickets. The journey carries on below it (the partner band has no
 * data-section, so J rests at 6 while it scrolls past, then Team, FAQ and
 * Newsletter take J on to 9 at the foot of the page); the scene is black
 * behind all of it and the render loop sleeps (Experience.tsx). The shot list
 * always carries a shot exactly here (moveShots), whatever its sampling grid.
 */
export const DARK_FROM = 6.0;

/**
 * In the macro the barrel slides right so its engraved column clears the theme headline (left edge past ~58%),
 * but not so far that the lit half of the engraving runs off the right edge while the rows pass (each row
 * should read whole, not cut mid-word).
 */
const ANCHOR_MACRO: readonly [number, number] = [0.765, 0.5];

/* ------------------------------------------------------------------------- */
/* The move: keys per channel                                                */
/* ------------------------------------------------------------------------- */

/** Keys of one channel: [J, value] pairs, J increasing. */
type Keys = readonly (readonly [number, number])[];

const trackSlopes = new WeakMap<Keys, number[]>();
/** Monotone cubic through `keys` at J (held flat outside the keys). */
export function track(keys: Keys, J: number): number {
  const n = keys.length;
  if (J <= keys[0][0] || n === 1) return keys[0][1];
  if (J >= keys[n - 1][0]) return keys[n - 1][1];
  let m = trackSlopes.get(keys);
  if (!m) {
    m = pchipSlopes(
      keys.map((k) => k[0]),
      keys.map((k) => k[1]),
    );
    trackSlopes.set(keys, m);
  }
  let i = 0;
  while (i < n - 2 && J >= keys[i + 1][0]) i++;
  const h = keys[i + 1][0] - keys[i][0];
  return hermite(keys[i][1], keys[i + 1][1], m[i], m[i + 1], h, (J - keys[i][0]) / h);
}

/** Filmstrip step (J): 2.5% of the Theme..Tickets journey. The speed limits are per step. */
const FILM_STEP = 0.125;

/**
 * Keys for a change of distance (log space) from d0 to d1 starting at J0, one
 * key per filmstrip step, with the given relative speed for each step (scaled
 * so the steps add up to the whole change). The speed profile is the shape of
 * the zoom: ramps of at most 2x between neighbouring steps, a flat top, so the
 * scale changes at an even, readable rate and starts and stops softly.
 */
function zoomKeys(J0: number, d0: number, d1: number, profile: readonly number[]): [number, number][] {
  const total = profile.reduce((a, b) => a + b, 0);
  const l0 = Math.log(d0);
  const dl = Math.log(d1) - l0;
  const keys: [number, number][] = [[J0, l0]];
  let acc = 0;
  profile.forEach((p, k) => {
    acc += p;
    keys.push([+(J0 + (k + 1) * FILM_STEP).toFixed(4), l0 + (dl * acc) / total]);
  });
  return keys;
}
/** The push in from the hero to the engraving: nine filmstrip steps, at most 1.45x per step. */
const PUSH_PROFILE = [0.15, 0.3, 0.55, 0.85, 1, 0.85, 0.55, 0.3, 0.15];
/**
 * The spiral pull out (desktop): ten filmstrip steps from the foot of the engraved band to the low
 * pass over Speakers, at most about 1.7x per step. Its first three steps are those of the calm cut's
 * pull out (the end of the descent through the Theme pin is unchanged); then a full swing and a
 * soft landing near the floor.
 */
const PULL_PROFILE = [0.25, 0.4, 0.6, 0.81, 0.98, 1.03, 0.98, 0.83, 0.6, 0.38];
/** Phones pull further out (the subject is smaller in the frame): one more step, at most about 1.65x per step. */
const PULL_PROFILE_PORTRAIT = [0.25, 0.4, 0.6, 0.8, 0.95, 1, 1, 0.92, 0.75, 0.45, 0.257];

/**
 * The whole camera move, hero to the end of Tickets, one set of keys per channel:
 * - `push`: the push in (start, distances); then the macro holds its distance
 *   while it travels down the barrel (`mic`, DESCENT) and the sleeve turns,
 *   until `pull.from`;
 * - `pull`: the spiral pull out (start, landing distance, speed profile); it
 *   lands at `pull.to` (derived) and `dist` continues from there, slowly, to
 *   the end: from the start of the pull out the distance never stops growing;
 * - `orbit`, `elev` (degrees) swing round in one direction and rise;
 * - the aim: a point on the mic axis (`mic`, mic-space height) until
 *   `micUntil`, then on the stand line: first so that the middle of the barrel
 *   glides evenly from the anchor to its stage place on screen (`barrelY`,
 *   fraction from the top, its first key at `micUntil`; the aim height follows
 *   from the distance), from the last `barrelY` key on by height (`stand`, m);
 * - `ax`, `ay`: the screen anchor (a lens shift); `roll`: the barrel standing
 *   upright for the macro and unwinding in the pull out;
 * - `looks`: the light keys before the pull out (by J), along it (by the log of
 *   the distance: the light follows the reveal), and on the stage (by J).
 */
type Move = {
  push: { from: number; d0: number; d1: number };
  pull: { from: number; d0: number; d1: number; profile: readonly number[] };
  dist: Keys;
  micUntil: number;
  mic: Keys;
  barrelY: Keys;
  stand: Keys;
  orbit: Keys;
  elev: Keys;
  ax: Keys;
  ay: Keys;
  roll: Keys;
  /** Optional: the aim's move from the stand line out into the house (Aim `out`), 0..1, by J. */
  out?: Keys;
  /** Optional: where across the house the aim goes (Aim `outX`, house-space x, m). */
  outX?: number;
  /**
   * Optional, with `out`: while the aim swings out into the house the anchor keys (`ax`, `ay`) give
   * where the point on the stand stays on screen, by this weight (0..1, by J); the lens shift that
   * holds it there is worked out from the pose (at the move's nominal `aspect`). At 0 the anchor
   * keys place the aim itself, as everywhere else.
   */
  hold?: Keys;
  /**
   * Optional, with `hold`: which point is held at the anchor keys, by J: 0 the point on the stand
   * line at the aim's height, 1 the centre of the grille (GRILLE).
   */
  holdHead?: Keys;
  /** Nominal width / height of the frame, for `hold`. */
  aspect?: number;
  looks: { open: readonly LightKey[]; pull: readonly LightKey[]; stage: readonly LightKey[] };
  /** Optional: the upper-middle band veil (Shot.band) by J, over the looks. */
  band?: Keys;
  /** Optional: how much the camera answers the visitor (Shot.react) by J; 1 where there are no keys. */
  react?: Keys;
  /**
   * Optional: from `from` (the last `elev` key) the camera's height above the top of the stand line
   * (m, by J) is keyed instead of its elevation, which follows from it and the distance: close
   * behind the microphone the height is what the eye reads, and it has to fall at every step.
   */
  rise?: { from: number; keys: Keys };
};
type LightKey = { at: number } & Required<Look>;
const lk = (at: number, ...parts: Partial<Look>[]): LightKey => Object.assign({ at }, LOOK_BASE, ...parts);

const lightTracks = new WeakMap<readonly LightKey[], Map<string, Keys>>();
/** The look at x (J, or the log of the distance for the pull out), every field interpolated through the keys. */
function lightAt(keys: readonly LightKey[], x: number): Required<Look> {
  let tracks = lightTracks.get(keys);
  if (!tracks) {
    tracks = new Map();
    for (const f of Object.keys(LOOK_BASE)) tracks.set(f, keys.map((k) => [k.at, (k as unknown as Record<string, number>)[f]] as const));
    lightTracks.set(keys, tracks);
  }
  const out: Record<string, number> = {};
  for (const [f, ks] of tracks) out[f] = track(ks, x);
  return out as unknown as Required<Look>;
}

/** Sleeve turn along the hero, the push in, the macro and the start of the pull out (radians). */
const TURN: Keys = [
  [0, 0.08],
  [0.5, 0.078],
  [0.95, 0.075],
  [1.25, 0.07],
  [1.8, -0.045],
  [2.25, -0.07],
];

/**
 * The descent down the engraved band (the aim's mic-space height, m; the band is 0.05..0.10, its
 * top title row near 0.097 and its closing title near 0.054). From the end of the push in to the
 * start of the pull out the aim travels down the barrel at an even pace (it gets going while the
 * push in settles, and no step is more than about 1.4x another), never stopping and never turning
 * back (DESCENT_J; `__sceneSim.motion()` measures it), so the engraved rows pass up the frame like
 * a contract read from the top; at the foot of the band it slows to a creep, still downwards (no drift
 * back up), while the pull out begins (to DESCENT_HOLD_TO, also checked), then slides back to the
 * barrel's middle (SPINE) as the camera draws away. The creep keeps the view turning at an even rate
 * into the pull out (a dead stop there reads as a jolt).
 */
export const DESCENT_J: readonly [number, number] = [1.05, 1.7];
/** End of the creep at the foot of the band: from DESCENT_J[0] to here the aim never goes back up the barrel. */
export const DESCENT_HOLD_TO = 1.95;
const DESCENT: Keys = [
  [0.5, 0.095],
  [0.85, 0.0935],
  [1.05, 0.0905],
  [1.3, 0.0795],
  [1.55, 0.0675],
  [1.7, 0.0615],
  [1.95, 0.0602],
  [2.4, 0.095],
];
/**
 * Phones: the same descent over a little more of the band (31 mm against about 29 on desktop), so the rows
 * rise faster than the page scrolls and the camera's travel shows, not a texture moving with the copy.
 */
const DESCENT_PORTRAIT: Keys = [
  [0.45, 0.1],
  [0.85, 0.093],
  [1.05, 0.0905],
  [1.3, 0.0788],
  [1.55, 0.0662],
  [1.7, 0.0595],
  [1.95, 0.0583],
  [2.4, 0.095],
];

/*
 * Landscape. The hero holds, then one push in along the camera axis (J 0.5 to
 * 1.25) settles on the engraved band; the macro tracks down the barrel while
 * the sleeve turns; the spiral pull out (J 1.6 to 2.85) swings round towards
 * the grille side and sinks to knee height for the low pass over Speakers.
 * The orbit carries on in the same direction (about 65 degrees over Schedule,
 * 60 over Venue, 35 over Tickets) while the camera rises from the floor to a
 * crane about 4 m up, looking obliquely down on the rug with the house beyond,
 * and comes down again over Tickets to a speaker's eye height behind the
 * microphone.
 */
/**
 * The hero's anchor x: held, then the slide right into the macro starts a
 * little ahead of the push in, so the growing grille keeps its air from the
 * headline while the headline drifts out.
 */
function heroAx(hx: number): [number, number][] {
  return [
    [0.45, hx],
    [0.6, hx + 0.022],
  ];
}

/** Hero, Speakers, Venue and Tickets x when the layout is not measured (1440 wide). */
const HERO_X = 0.68;
const SPEAKERS_X = 0.73;
const VENUE_X = 0.64;
const TICKETS_X = 0.56;
/* ------------------------------------------------------------------------- */
/* The end of Tickets: the grille and the seat counter                       */
/* ------------------------------------------------------------------------- */

/**
 * The Tickets room figure as the page lays it out (contentLayout.ts, measureTicketsRoom): the two
 * big numerals of the seat counter with a gap between them, the ruler, a caption line, then empty
 * space down to the end of the section. Fractions of the viewport: `gapL`, `gapR` the gap between
 * the numerals (of the width); `hv` the section's height, `gap` the empty space under the caption,
 * `num` from the foot of the numerals to the end of the section and `air` 12 px (of the height).
 */
export type TicketsRoom = { gapL: number; gapR: number; hv: number; gap: number; num: number; air: number };
/** The room at 1440x900 and on a 390x844 phone, when the page is not measured. */
const ROOM_DESKTOP: TicketsRoom = { gapL: 0.373, gapR: 0.579, hv: 1.54, gap: 0.16, num: 0.316, air: 0.013 };
const ROOM_PORTRAIT: TicketsRoom = { gapL: 0.373, gapR: 0.579, hv: 1.668, gap: 0.114, num: 0.376, air: 0.014 };

/**
 * How the grille is placed over the end of Tickets, where the seat counter (numerals, ruler,
 * caption) scrolls up through the whole frame while the camera stands behind the microphone. No
 * fixed place on screen stays clear of it, so the grille is led by the page:
 * - it comes down the frame (`descent`, its height by J) in the lane between the two numerals
 *   while the counter rises to meet it, so it passes the counter quickly and between the figures;
 * - once it is under the caption it rides up with the page in the empty space between the caption
 *   and the end of the section (its disc, of radius `r` there, keeps the room's `air` from the
 *   caption, and its centre END_EDGE_AIR above the end of the section, where the next band's
 *   ground comes up), as near as that space allows to where it sits in the nominal room, so the
 *   house behind it stays put, and drifts to the side (`vx` of the width per J, to `xEnd`).
 * `rLane` is its radius while it passes between the numerals (the camera is still further off).
 * All of it is a lens shift on top of the camera's own move (Move.hold), which is written so that
 * in the nominal room the shift barely moves the house. With the page at rest the grille sits in
 * its place; behind a page that is still scrolling it trails a little, as the whole camera does.
 */
type EndSpec = { from: number; r: number; rLane: number; yMax: number; descent: Keys; nominal: TicketsRoom; vx: number; xEnd: number };
/** The grille's centre stays this far (of the height) above the end of the Tickets section (MOTION_LIMITS.speakerEdgeAir and a little). */
const END_EDGE_AIR = 0.047;

const END_DESKTOP: EndSpec = {
  from: 5.5,
  r: 0.048,
  rLane: 0.03,
  yMax: 0.885,
  descent: [
    [5.5, 0.55],
    [5.6, 0.7],
    [5.72, 0.88],
    [6.0, 0.885],
  ],
  nominal: ROOM_DESKTOP,
  vx: 0.66,
  xEnd: 0.8,
};
const END_PORTRAIT: EndSpec = {
  from: 5.5,
  r: 0.036,
  rLane: 0.024,
  yMax: 0.93,
  descent: [
    [5.5, 0.497],
    [5.6, 0.584],
    [5.7, 0.671],
    [5.8, 0.758],
    [5.9, 0.845],
    [6.0, 0.93],
  ],
  nominal: ROOM_PORTRAIT,
  vx: 0.8,
  xEnd: 0.76,
};

/** The grille's place on screen (anchor keys, x and y) from `spec.from` to the end of Tickets. */
function endKeys(spec: EndSpec, room: TicketsRoom, aspect: number): { ax: [number, number][]; ay: [number, number][] } {
  const mid = (room.gapL + room.gapR) / 2;
  // In the gap between the numerals, towards the second one where the gap is wide (the bar between
  // them sits in its left half).
  const lane = Math.max(mid, room.gapR - spec.rLane / aspect - 0.03);
  const edge = (r: TicketsRoom, J: number) => 0.5 + (6 - J) * r.hv;
  const ax: [number, number][] = [];
  const ay: [number, number][] = [];
  let xFrom = -1;
  for (let k = 0; ; k++) {
    const J = +(spec.from + k * 0.025).toFixed(3);
    if (J > 6 + 1e-9) break;
    const lo = edge(room, J) - room.gap + spec.r + room.air;
    const hi = edge(room, J) - END_EDGE_AIR;
    const nominal = edge(spec.nominal, J) - spec.nominal.gap / 2;
    const ride = lo <= hi ? Math.min(hi, Math.max(lo, nominal)) : (lo + hi) / 2;
    const y = Math.min(track(spec.descent, J), ride, spec.yMax);
    // Sideways once the grille is below the foot of the numerals.
    if (xFrom < 0 && y - spec.rLane >= edge(room, J) - room.num) xFrom = J;
    ax.push([J, xFrom < 0 ? lane : Math.min(Math.max(lane, spec.xEnd), lane + spec.vx * (J - xFrom))]);
    ay.push([J, y]);
  }
  return { ax, ay };
}

/**
 * How much the camera answers the visitor over the end of Tickets (Shot.react): fully until the
 * crane starts down behind the microphone, a third in the speaker's view.
 */
const SPEAKER_REACT: Keys = [
  [5.25, 1],
  [5.65, 0.35],
];

const DESKTOP_MOVE: Move = {
  // The macro a little open (0.071 m), so the rows of the engraving fit across the frame as they pass.
  push: { from: 0.45, d0: 0.4, d1: 0.071 },
  pull: { from: 1.6, d0: 0.072, d1: 2.3, profile: PULL_PROFILE },
  // After the landing of the pull out (J 2.85): the low pass draws back a little over Speakers, the
  // orbit widens over Schedule, the crane holds wide over Venue, then over Tickets the camera comes
  // down and in until it stands behind the microphone, and keeps closing in slowly to the end.
  dist: [
    [3.0, 2.45],
    [3.25, 2.9],
    [3.5, 3.5],
    [3.75, 4.15],
    [4.0, 4.75],
    [4.25, 5.15],
    [4.45, 5.45],
    [4.6, 5.3],
    [4.75, 4.95],
    [4.9, 4.55],
    [5.0, 4.25],
    [5.125, 3.8],
    [5.25, 3.0],
    [5.375, 2.2],
    [5.5, 1.45],
    [5.625, 1.05],
    [5.75, 0.86],
    [5.875, 0.8],
    [6.0, 0.765],
  ],
  micUntil: 2.4,
  // The descent: through the Theme pin the camera travels down the engraved barrel, from the title
  // row at the top of the band to the closing title at its foot, reading the fine print line by line
  // while the sleeve turns. The pull out starts from the foot of the band; once the camera is far
  // enough away for it to read as part of the retreat, the aim slides back to the barrel's middle.
  mic: DESCENT,
  // No glide by screen place: from the end of the descent the aim slides straight down the stand line.
  barrelY: [[2.4, 0.43]],
  // The aim on the stand: from the barrel's middle down the stand as the camera spirals out and
  // sinks; low over Speakers (the camera near the floor looks a little up, the microphone high in
  // the frame over the beam), down the stand from the crane over Venue, then up to the grille as the
  // camera comes down behind it.
  stand: [
    [2.6, 1.46],
    [2.85, 1.0],
    [3.0, 0.65],
    [3.15, 0.56],
    [3.3, 0.58],
    [3.5, 0.65],
    [4.0, 0.7],
    [4.5, 0.55],
    [4.9, 0.45],
    [5.1, 0.75],
    [5.3, 1.25],
    [5.45, 1.42],
    [5.75, 1.45],
    [6.0, 1.45],
  ],
  // The aim leaves the stand for the house as the camera passes behind the grille.
  out: [
    [4.2, 0],
    [4.6, 0.22],
    [4.9, 0.34],
    [5.1, 0.4],
    [5.4, 0.6],
    [5.5, 0.7],
    [5.625, 0.85],
    [5.75, 0.924],
    [5.875, 0.96],
    [6.0, 1],
  ],
  // The stand keeps its place on screen (in the gutter by the Venue plate, then in the gap between
  // the Tickets heading and the ticket details) while the aim starts out into the house, so the
  // crane's view lifts towards the stage edge and the first rows; from J 5.3 the point that is held
  // becomes the grille itself, which comes down between the seat counter's numerals to the foot of
  // the frame and rides up under the counter's caption (endKeys).
  hold: [
    [4.2, 1],
    [6.0, 1],
  ],
  holdHead: [
    [5.3, 0],
    [5.5, 1],
  ],
  aspect: 1.7,
  // Over Venue the stand rides in a gutter a few dozen pixels wide beside the location plate, seen
  // from the crane (the grille and the foot at different depths, so an orbit moves one against the
  // other): the camera barely answers there (0.15). The speaker's view has no room to give either: the
  // grille is close to the lens and the seat counter runs across the frame (rig.ts keeps the grille
  // in its place and lets the house slide behind it).
  react: [
    [3.9, 1],
    [4.3, 0.15],
    [4.85, 0.15],
    [5.05, 1],
    ...SPEAKER_REACT,
  ],
  // The orbit and the sink set off a step early, while the descent slows at the foot of the band, so
  // the turn builds up evenly into the pull out; then one direction all the way round to behind the
  // microphone: in line with the house while the grille comes down between the seat counter's
  // numerals (the orbit all but rests there), then a little past the line as the grille rides up the
  // right of the frame (about 190 degrees as keyed).
  orbit: [
    [1.5, 0],
    [2.0, -0.6],
    [2.3, -2.5],
    [2.6, -11],
    [2.85, -26],
    [3.0, -37],
    [3.5, -68],
    [4.0, -101],
    [4.5, -137.5],
    [4.9, -164],
    [5.2, -176],
    [5.4, -177.3],
    [5.6, -178.6],
    [5.7, -181.7],
    [5.8, -185.2],
    [5.9, -188.7],
    [6.0, -191.5],
  ],
  // Down from the hero's slight look down to near the floor for the Speakers pass, up through
  // Schedule to the crane over Venue, and down again to a speaker's eye height over Tickets.
  elev: [
    [1.5, TRACK_ELEV / DEG],
    [2.0, 1.8],
    [2.3, -1.5],
    [2.6, -10.5],
    [2.85, -22],
    [3.0, -24.5],
    [3.25, -19],
    [3.5, -6],
    [3.75, 6],
    [4.0, 18],
    [4.45, 25],
    [4.7, 24.2],
    [5.0, 22.5],
    [5.2, 20],
    [5.35, 18],
    [5.5, 16],
  ],
  // Behind the microphone the camera's height is what counts (it only comes down): it stays high
  // over the grille, which sits at the foot of the frame under the seats, until the grille has
  // passed the seat counter (about J 5.7), then sinks behind it to a speaker's eye, so the grille
  // rises up the frame with the page.
  rise: {
    from: 5.5,
    keys: [
      [5.6, 0.374],
      [5.7, 0.357],
      [5.8, 0.26],
      [5.9, 0.171],
      [6.0, 0.095],
    ],
  },
  // The barrel's slide right for the macro (even, about 2% of the width per step); an even slide
  // over the pull out to its place right of the Speakers panel; then an even drift left over Schedule
  // into the gutter between the Venue facts and the location plate; over Tickets into the gap between
  // the heading and the ticket details (stageAx), and from there the grille's own place (endKeys).
  ax: [
    ...heroAx(HERO_X),
    [1.3, 0.758],
    [1.45, ANCHOR_MACRO[0]],
    [1.75, 0.763],
    ...stageAx(SPEAKERS_X, VENUE_X, TICKETS_X),
    ...endKeys(END_DESKTOP, ROOM_DESKTOP, 1.7).ax,
  ],
  ay: [
    [0.45, 0.4],
    [0.6, 0.418],
    [1.3, 0.495],
    [1.45, ANCHOR_MACRO[1]],
    [1.9, 0.49],
    [2.4, 0.43],
    [2.6, 0.445],
    [2.8, 0.54],
    [2.95, 0.62],
    [3.25, 0.64],
    [3.6, 0.47],
    [3.9, 0.39],
    [4.2, 0.425],
    [4.5, 0.475],
    [4.85, 0.485],
    [5.0, 0.428],
    [5.12, 0.422],
    [5.25, 0.41],
    [5.3, 0.425],
    ...endKeys(END_DESKTOP, ROOM_DESKTOP, 1.7).ay,
  ],
  roll: [
    [0.5, 0],
    [0.95, 0.7],
    [1.25, 0.94],
    [1.55, 0.88],
    [2.1, 0.45],
    [2.75, 0],
  ],
  looks: {
    open: [
      lk(0.5, HERO_LOOK),
      lk(0.95, PUSH_LOOK),
      lk(1.25, MACRO, { kx: 1.1, ky: 2.2, kz: 0.3 }),
      lk(1.45, MACRO, { kx: 1.5, ky: 2.0, kz: 0.3 }),
      lk(1.6, MACRO, { kx: 2.0, ky: 1.6, kz: 0.3, dof: 0.7, motes: 0.8, scrim: 0.5 }),
    ],
    pull: [
      lk(Math.log(0.072), MACRO, { kx: 2.0, ky: 1.6, kz: 0.3, dof: 0.7, motes: 0.8, scrim: 0.5 }),
      lk(Math.log(0.12), PULL_BARREL),
      lk(Math.log(0.3), PULL_MIC),
      lk(Math.log(0.7), PULL_WHOLE),
      lk(Math.log(1.3), PULL_STAND, { fov: 34, cone: 0.4, spot: 0.62 }),
      lk(Math.log(2.3), LOW_LOOK),
    ],
    // The low pass looks up the beam; over Schedule the beam's colour temperature goes from warm to
    // cool as the programme passes; over Venue the crane looks down on the pool of light; over
    // Tickets the camera comes down into the beam behind the microphone and looks out over the
    // house, the grille soft at the edge of the frame; after Tickets the lights go down.
    stage: [
      lk(2.85, LOW_LOOK),
      lk(3.15, LOW_LOOK, { fov: 41, cone: 1.05, spot: 0.92, warm: 0.3 }),
      lk(3.5, STAGE_LOOK, { fov: 35, cone: 1.25, warm: 0.4 }),
      lk(4.0, STAGE_LOOK, { fov: 34, cone: 1.35, spot: 0.95, warm: -0.45 }),
      lk(4.3, STAGE_LOOK, { fov: 34, cone: 1.2, spot: 0.95, key: 0.45, rim: 1.1, vignette: 0.61, scrimEdge: 0.3, warm: -0.4 }),
      lk(4.6, STAGE_LOOK, { fov: 35, cone: 1.05, spot: 0.98, key: 0.45, rim: 1.1, vignette: 0.6, scrimEdge: 0.5, warm: -0.35 }),
      lk(5.0, STAGE_LOOK, { fov: 35, cone: 1.05, spot: 1.0, key: 0.5, rim: 1.15, vignette: 0.6, scrimEdge: 0.6, warm: -0.3 }),
      lk(5.35, STAGE_LOOK, { fov: 35, cone: 0.85, spot: 1.02, key: 0.5, rim: 1.25, vignette: 0.6, scrimEdge: 0.7, warm: -0.22 }),
      lk(5.65, SPEAKER_LOOK),
      lk(5.9, SPEAKER_LOOK, { exposure: 0.96, cone: 0.38, spot: 0.78, rim: 1.3 }),
      lk(6.0, SPEAKER_LOOK, DARK, { scrimEdge: 0.7, warm: -0.15 }),
    ],
  },
};

/**
 * The anchor's x from Speakers to the end, for the subject's place right of
 * the Speakers panel (`sx`) and over Venue (`vx`), measured from the
 * layout, and over Tickets (`tx`) in the gap between the heading and the
 * ticket details, to J 5.3; from there the keys place the grille (endKeys).
 */
function stageAx(sx: number, vx: number, tx: number): [number, number][] {
  // The drift from Speakers to Venue at an even rate, eased in and out over a step or so.
  const a = sx - 0.008;
  const b = vx;
  return [
    [2.9, sx + 0.004],
    [3.0, sx],
    [3.15, a],
    [3.3, a + (b - a) * 0.12],
    [3.7, a + (b - a) * 0.88],
    [3.85, b],
    [4.1, vx + 0.001],
    [4.7, vx],
    // As the crane comes down at the end of Venue the tail leans left, towards the facts' columns,
    // while the plate has scrolled up out of the way: a little further from the text.
    [4.9, vx + 0.012],
    [4.98, vx + 0.012 + (tx - vx - 0.012) * 0.1],
    [5.12, vx + 0.012 + (tx - vx - 0.012) * 0.9],
    [5.2, tx],
    [5.3, tx],
  ];
}

/** On phones the copy sits over the beam: a thinner shaft, darker at the top edge. */
const STAGE_PORTRAIT = { ...STAGE_LOOK, fov: 36, exposure: 1.0, parallax: 0, cone: 0.4, spot: 1.1, scrimEdge: 0.55 };
/** Phone macro: the engraving sits behind the theme's body copy, so the veil over it is heavier. */
const MACRO_PORTRAIT = { ...MACRO, fov: 34, exposure: 1.05, dof: 0.6, key: 0.8, motes: 0.6, scrim: 0.75, scrimEdge: 0.95, bloom: 0.8, fdx: -0.08 };
const HERO_PORTRAIT_LOOK = { fov: 34, exposure: 1.15, drift: 0.008, parallax: 0, cone: 0.02, spot: 0.15, key: 0.75, rim: 3.4, rimAng: 0.75, haze: 0.2, vignette: 0.72 };
// The barrel slides up behind the hero title: keep it dim there.
const PUSH_PORTRAIT_LOOK = { fov: 32, exposure: 0.78, dof: 0.3, drift: 0.004, cone: 0.015, spot: 0.1, key: 0.7, keyCam: 0.7, kx: 1.1, ky: 1.8, kz: 0.4, rim: 1.2, rimAng: 0.9, haze: 0.2, vignette: 0.75, env: 0.5, scrim: 0.6, scrimEdge: 0.9, shade: 1 };
const P0 = { parallax: 0 };

/** Phones: the low pass from further off and less low (the subject stays small and high while copy passes). */
const LOW_PORTRAIT = { ...STAGE_PORTRAIT, fov: 40, dof: 0.2, cone: 0.32, spot: 0.85, key: 0.62, rim: 1.15, rimAng: -0.4, warm: 0.15 };
/** Phones: the speaker's view, a little wider (the narrow frame takes the middle of the house). */
const SPEAKER_PORTRAIT = { ...SPEAKER_LOOK, fov: 44, parallax: 0, cone: 0.35, scrimEdge: 0.55 };

/**
 * Phones: the seat counter (numerals, ruler, caption) runs the full width and scrolls up through
 * the whole frame, so the grille and the stand have to cross it once on the way down to their place
 * under the caption. While they do, the microphone's own light (key, rim, the studio reflections)
 * is taken down: it passes behind the ruler's numbers and the caption as a dark shape, and the
 * house behind it stays lit.
 */
const CROSSING_DIM = { key: 0, rim: 0.05, env: 0.08 };

/** The phone frame the portrait move is written for (width / height). */
const PORTRAIT_ASPECT = 0.46;

/*
 * Portrait: the same story with smaller angles where the narrow frame needs them: the same orbit
 * round to behind the microphone (the house is where it is), but the low pass from further off and
 * less low, the crane further back, and the subject kept small and high in the upper middle of the
 * frame while the copy (full width, scrolling through the whole height) passes; the band veil takes
 * it down under each section's opening lines. Over Tickets the camera comes down to the speaker's
 * view like the landscape move.
 */
const PORTRAIT_MOVE: Move = {
  push: { from: 0.4, d0: 0.6, d1: 0.1 },
  pull: { from: 1.6, d0: 0.101, d1: 4.2, profile: PULL_PROFILE_PORTRAIT },
  dist: [
    [3.25, 5.0],
    [3.5, 6.0],
    [4.0, 7.0],
    [4.45, 6.6],
    [4.7, 6.05],
    [4.9, 5.55],
    [5.0, 5.25],
    [5.125, 4.6],
    [5.25, 3.85],
    [5.375, 3.0],
    [5.5, 2.1],
    [5.625, 1.45],
    [5.75, 1.1],
    [5.875, 0.95],
    [6.0, 0.88],
  ],
  micUntil: 2.4,
  mic: DESCENT_PORTRAIT,
  barrelY: [[2.4, 0.4]],
  stand: [
    [2.6, 1.49],
    [2.85, 1.36],
    [3.0, 1.25],
    [3.25, 1.1],
    [3.5, 0.95],
    [4.0, 0.8],
    [4.5, 0.6],
    [4.9, 0.5],
    [5.1, 0.75],
    [5.3, 1.2],
    [5.45, 1.42],
    [5.75, 1.45],
    [6.0, 1.45],
  ],
  out: [
    [4.3, 0],
    [4.9, 0.2],
    [5.1, 0.28],
    [5.4, 0.55],
    [5.58, 0.655],
    [5.72, 0.885],
    [5.85, 0.96],
    [6.0, 1],
  ],
  hold: [
    [4.3, 1],
    [6.0, 1],
  ],
  holdHead: [
    [5.3, 0],
    [5.5, 1],
  ],
  aspect: PORTRAIT_ASPECT,
  react: SPEAKER_REACT,
  orbit: [
    [1.6, 0],
    [2.0, -0.45],
    [2.3, -1.9],
    [2.6, -8],
    [2.975, -24],
    [3.5, -55],
    [4.0, -92],
    [4.5, -128],
    [4.9, -150],
    [5.25, -166],
    [5.5, -174],
    [5.6, -175],
    [5.7, -175.3],
    [5.8, -177.3],
    [5.9, -179.7],
    [6.0, -181.7],
  ],
  elev: [
    [1.6, TRACK_ELEV / DEG],
    [2.0, 2.5],
    [2.4, -2],
    [2.975, -14],
    [3.25, -11],
    [3.5, -5],
    [4.0, 13],
    [4.5, 28],
    [4.7, 28.4],
    [4.9, 28],
    [5.0, 27.5],
    [5.125, 26.5],
    [5.25, 24.5],
    [5.375, 22],
    [5.5, 17],
  ],
  rise: {
    from: 5.5,
    keys: [
      [5.6, 0.384],
      [5.7, 0.371],
      [5.8, 0.352],
      [5.85, 0.302],
      [5.9, 0.232],
      [5.95, 0.163],
      [6.0, 0.104],
    ],
  },
  // The macro pushes the barrel right, part of it off the frame, away from the theme's body copy;
  // over the end of Tickets the keys place the grille (endKeys).
  ax: [
    [0.4, 0.5],
    [0.5, 0.505],
    [1.4, 0.665],
    [1.5, 0.67],
    [1.8, 0.665],
    [2.8, 0.505],
    [2.9, 0.5],
    [5.3, 0.5],
    ...endKeys(END_PORTRAIT, ROOM_PORTRAIT, PORTRAIT_ASPECT).ax,
  ],
  // One even rise of the anchor from the hero's lower middle, through the macro, to the upper middle
  // where the stage lands; over the end of Tickets the grille comes down through the seat counter and
  // rides up under its caption, above the page below Tickets as it comes up (endKeys).
  ay: [
    [0.4, 0.66],
    [0.5, 0.655],
    [1.45, 0.528],
    [2.4, 0.4],
    [2.7, 0.385],
    [3.0, 0.335],
    [3.5, 0.33],
    [4.5, 0.34],
    [5.2, 0.37],
    [5.3, 0.415],
    [5.4, 0.43],
    ...endKeys(END_PORTRAIT, ROOM_PORTRAIT, PORTRAIT_ASPECT).ay,
  ],
  roll: [
    [0.45, 0],
    [0.85, 0.7],
    [1.2, 0.94],
    [1.55, 0.82],
    [2.1, 0.4],
    [2.75, 0],
  ],
  // Where a section's heading scrolls up through the subject's place (the opening lines of Schedule,
  // Venue and Tickets), the band veil over the upper middle takes the subject down under it.
  band: [
    [2.85, 0],
    [3.0, 0.55],
    [3.5, 0.55],
    [3.65, 0],
    [3.95, 0],
    [4.1, 0.55],
    [4.8, 0.55],
    [4.95, 0],
    [5.2, 0],
    [5.33, 0.55],
    [5.45, 0.55],
    [5.6, 0],
  ],
  looks: {
    open: [
      lk(0.45, HERO_PORTRAIT_LOOK),
      lk(0.8, PUSH_PORTRAIT_LOOK),
      lk(1.2, MACRO_PORTRAIT, { kx: 0.6, ky: 2.3, kz: 0.3 }),
      lk(1.4, MACRO_PORTRAIT, { kx: 1.0, ky: 2.2, kz: 0.3 }),
      lk(1.6, MACRO_PORTRAIT, { kx: 1.3, ky: 2.0, kz: 0.3, dof: 0.5, motes: 0.8 }),
    ],
    pull: [
      lk(Math.log(0.101), MACRO_PORTRAIT, { kx: 1.3, ky: 2.0, kz: 0.3, dof: 0.5, motes: 0.8 }),
      lk(Math.log(0.18), PULL_BARREL, { fov: 33, exposure: 1.0, scrim: 0.6, scrimEdge: 0.85 }, P0),
      lk(Math.log(0.45), PULL_MIC, { fov: 34.5, scrim: 0.5 }, P0),
      lk(Math.log(1.0), PULL_WHOLE, { fov: 36, scrim: 0.4 }, P0),
      lk(Math.log(2.2), PULL_STAND, { fov: 38, cone: 0.2, spot: 0.62 }, P0),
      lk(Math.log(4.2), LOW_PORTRAIT),
    ],
    stage: [
      lk(2.975, LOW_PORTRAIT),
      lk(3.3, STAGE_PORTRAIT, { spot: 0.9, cone: 0.34, key: 0.55, warm: 0.3 }),
      lk(3.6, STAGE_PORTRAIT, { warm: 0.4 }),
      lk(4.0, STAGE_PORTRAIT, { cone: 0.7, spot: 1.05, exposure: 0.97, warm: -0.45 }),
      lk(4.6, STAGE_PORTRAIT, { cone: 1.2, key: 0.4, rim: 1.1, scrimEdge: 0.6, warm: -0.35 }),
      lk(5.0, STAGE_PORTRAIT, { cone: 1.1, key: 0.45, rim: 1.15, scrimEdge: 0.6, warm: -0.3 }),
      lk(5.35, STAGE_PORTRAIT, { fov: 40, cone: 0.7, key: 0.45, rim: 1.25, vignette: 0.62, warm: -0.22 }),
      // The microphone's own light goes down while the grille and the stand cross the seat counter's
      // ruler and caption (CROSSING_DIM), and comes back as the grille settles under the caption.
      lk(5.65, SPEAKER_PORTRAIT, CROSSING_DIM),
      lk(5.8, SPEAKER_PORTRAIT, CROSSING_DIM),
      lk(5.85, SPEAKER_PORTRAIT),
      lk(5.9, SPEAKER_PORTRAIT, { exposure: 0.96, cone: 0.33, spot: 0.78, rim: 1.3 }),
      lk(6.0, SPEAKER_PORTRAIT, DARK, { warm: -0.15 }),
    ],
  },
};

/** Step of the sampled shots of the move (J). */
const MOVE_STEP = 0.0625;
/** From here to the end of Tickets the shots are sampled at half that step (moveShots). */
const END_SAMPLE_FROM = 5.4;

/**
 * The shot list of one move: a shot at J 0 (the hero at rest), then shots
 * sampled from the keys at an even spacing from the start of the push in to the
 * end of Tickets, a shot exactly at the end of Tickets (DARK_FROM: lights out)
 * and its copy held to the foot of the page. `variant` overrides the anchor height and barrel glide keys
 * (a content variant).
 */
function moveShots(move: Move, variant: Partial<Pick<Move, 'ay' | 'barrelY' | 'ax' | 'aspect' | 'looks'>> = {}): Shot[] {
  const mv = { ...move, ...variant };
  const { ay, looks } = mv;
  const pullKeys = zoomKeys(mv.pull.from, mv.pull.d0, mv.pull.d1, mv.pull.profile);
  const pullTo = pullKeys[pullKeys.length - 1][0];
  const logDist: Keys = [
    [0, Math.log(mv.push.d0 * 1.04)],
    ...zoomKeys(mv.push.from, mv.push.d0, mv.push.d1, PUSH_PROFILE),
    ...pullKeys,
    ...mv.dist.filter(([j]) => j > pullTo).map(([j, d]) => [j, Math.log(d)] as const),
  ];
  const look = (J: number) => {
    if (J < mv.pull.from) return lightAt(looks.open, J);
    if (J < pullTo) return lightAt(looks.pull, track(logDist, J));
    return lightAt(looks.stage, J);
  };
  // While the barrel glides to its stage place, the aim height follows from where the barrel should
  // be on screen: it sits (anchor - barrelY) of the frame height above the aim.
  const glideTo = mv.barrelY[mv.barrelY.length - 1][0];
  const glideAim = (J: number) => {
    const half = Math.tan((look(J).fov * DEG) / 2);
    return SPINE.y - (track(ay, J) - track(mv.barrelY, J)) * 2 * Math.exp(track(logDist, J)) * half;
  };
  const stand: Keys = [[glideTo, glideAim(glideTo)], ...mv.stand.filter(([j]) => j > glideTo)];
  // The elevation, or from Move.rise the elevation that puts the camera at the keyed height.
  const riseFrom = mv.rise ? mv.rise.from : Infinity;
  const rise: Keys = mv.rise ? [[riseFrom, Math.exp(track(logDist, riseFrom)) * Math.sin(track(mv.elev, riseFrom) * DEG)], ...mv.rise.keys] : [];
  const elevAt = (J: number) =>
    J > riseFrom ? Math.asin(Math.min(1, Math.max(-1, track(rise, J) / Math.exp(track(logDist, J))))) / DEG : track(mv.elev, J);
  const shotAt = (J: number): Shot => {
    const { kx, ky, kz, fdx, fdy, ...rest } = look(J);
    const anchor = [track(mv.ax, J), track(ay, J)] as const;
    return {
      ...rest,
      at: J,
      aim: J < mv.micUntil ? { mic: track(mv.mic, J) } : { stand: J < glideTo ? glideAim(J) : track(stand, J), out: mv.out ? track(mv.out, J) : 0, outX: mv.outX },
      dist: Math.exp(track(logDist, J)),
      orbit: track(mv.orbit, J),
      elev: elevAt(J),

      anchor,
      roll: track(mv.roll, J),
      turn: track(TURN, J),
      keyDir: [kx, ky, kz],
      focus: [anchor[0] + fdx, 1 - anchor[1] + fdy],
      band: mv.band ? track(mv.band, J) : rest.band,
      react: mv.react ? track(mv.react, J) : 1,
    };
  };
  // Hold the point on the stand at the anchor keys while the aim swings out (Move.hold).
  const held = (J: number): Shot => {
    const shot = shotAt(J);
    const w = mv.hold ? track(mv.hold, J) : 0;
    if (w <= 0 || !('stand' in shot.aim) || !shot.aim.out) return shot;
    const pos = SPINE.clone().addScaledVector(trackDir((shot.orbit ?? 0) * DEG, (shot.elev ?? 0) * DEG), shot.dist);
    const stand = aimPoint({ stand: shot.aim.stand });
    const fwd = aimOut(pos, stand.clone(), shot.aim.out, shot.aim.outX ?? 0).sub(pos).normalize();
    const hw = mv.holdHead ? track(mv.holdHead, J) : 0;
    const P = (hw > 0 ? stand.lerp(GRILLE, hw) : stand).sub(pos);
    const right = new Vector3().crossVectors(fwd, new Vector3(0, 1, 0)).normalize();
    const up = new Vector3().crossVectors(right, fwd);
    const z = P.dot(fwd);
    const ty = Math.tan((shot.fov * DEG) / 2);
    const sx = P.dot(right) / (z * ty * (mv.aspect ?? 1.6)) / 2;
    const sy = -P.dot(up) / (z * ty) / 2;
    const anchor = [shot.anchor[0] - w * sx, shot.anchor[1] - w * sy] as const;
    const f = shot.focus ?? [0, 0];
    return { ...shot, anchor, focus: [f[0] - w * sx, f[1] + w * sy] };
  };
  const out: Shot[] = [held(0)];
  for (let k = 0; ; k++) {
    const J = +(mv.push.from + k * MOVE_STEP).toFixed(4);
    if (J > DARK_FROM + 1e-9) break;
    out.push(held(J));
    // Over the end of Tickets the grille is led by the page (endKeys) while the camera comes down
    // close behind it: a shot at every half step there, so the lens shift that holds the grille
    // stays true between the shots.
    const half = +(J + MOVE_STEP / 2).toFixed(5);
    if (J >= END_SAMPLE_FROM && half < DARK_FROM) out.push(held(half));
  }
  // The sampling grid starts at the push in, so it need not land on the end of Tickets: the dark
  // shot is always added exactly there. Without it the last sampled shot (half way through the
  // fade) would be held for the rest of the page.
  if (out[out.length - 1].at < DARK_FROM - 1e-9) out.push(held(DARK_FROM));
  // After Tickets (Team, FAQ, Newsletter: J 6 to 9) the lights stay down and the move has come to rest.
  out.push({ ...out[out.length - 1], at: 9.5 });
  return out;
}

/**
 * Speakers announced (landscape): the strip of speaker cards comes up along the lower edge early
 * in the pin, so the low pass holds the microphone a little higher on screen (the anchor about 7%
 * higher) and it settles back down through Schedule.
 */
const DESKTOP_ANNOUNCED: Partial<Pick<Move, 'ay' | 'barrelY' | 'ax'>> = {
  ay: DESKTOP_MOVE.ay.map(([j, v]) => [j, j >= 2.7 && j <= 3.25 ? v - 0.07 : v] as const),
};

export const DESKTOP_SHOTS: Shot[] = moveShots(DESKTOP_MOVE);
export const PORTRAIT_SHOTS: Shot[] = moveShots(PORTRAIT_MOVE);

/** Calm, dim hero-like framing for routes without the home sections. */
export const AWAY_SHOT: Shot = {
  at: 0,
  aim: { mic: 0.095 },
  dist: 0.7,
  anchor: [0.7, 0.42],
  fov: 30,
  exposure: 0.5,
  drift: 0.02,
  parallax: 0.025,
  cone: 0.04,
  spot: 0.4,
  key: 0.8,
  rim: 1.2,
  haze: 0.6,
  vignette: 0.7,
};
export const AWAY_SHOT_PORTRAIT: Shot = {
  ...AWAY_SHOT,
  aim: { mic: 0.08 },
  dist: 1.2,
  anchor: [0.5, 0.62],
  fov: 36,
  exposure: 0.4,
};

/* ------------------------------------------------------------------------- */
/* Content-dependent variants                                                */
/* ------------------------------------------------------------------------- */

export type ShotOptions = {
  /** No speaker announced yet: no card strip, one panel low-left; the stage frame holds through the whole pin. */
  speakersTba: boolean;
  /**
   * Schedule height / a full schedule's height (0.4..1). The move is written in
   * journey units, so a short schedule passes the same stretch of the orbit in
   * less scroll; the shots do not change.
   */
  scheduleScale: number;
  /** Landscape: the subject's x right of the Speakers panel, over Venue and over Tickets (fractions of the width), measured from the layout. */
  speakersX?: number;
  venueX?: number;
  ticketsX?: number;
  /** The hero's anchor x, measured: the grille clear of the headline (landscape), or of the headline and the facts row (the portrait move in a wide-copy window). */
  heroX?: number;
  /**
   * The portrait move in a window that is not taller than wide (wideCopyFraming): whether the
   * microphone fits at the right, beside the hero's copy (the measured layout: contentLayout.ts,
   * measureHero). Without it the move opens on the phone's hero.
   */
  wideCopy?: boolean;
  /**
   * There, under 640 px wide, in a window where the headline runs most of the width: the hero's
   * anchor height, measured, so the grille stands under the headline and beside the copy below it.
   * Not set where the grille stands beside the headline, as from 640 px (a window clearly wider than tall).
   */
  heroY?: number;
  /**
   * The landscape move on a phone on its side (sidewaysPhone): the seat counter is laid out as on a
   * phone held upright there, and the grille crosses it on the way down.
   */
  sideways?: boolean;
  /** The Tickets room figure (the seat counter), measured: where the grille goes over the end of Tickets. */
  ticketsRoom?: TicketsRoom;
  /**
   * Width / height of the frame (rounded). Landscape: the stand is held in a gap a few dozen pixels
   * wide over Tickets (Move.hold), and the lens shift that holds it there depends on the frame's
   * shape; it is part of the content key, so a change of height alone rebuilds the shots.
   */
  aspect?: number;
};

/**
 * Which move a frame gets: the portrait move for a frame taller than wide (9:10 or narrower: the
 * boundary itself counts as tall, as it does for `max-aspect-ratio: 9/10` in the page's CSS, which
 * stacks the hero's facts there, and for the still frames), and also for
 * a window narrower than the page's desktop layout (under 1024 px wide: a half-screen browser
 * window, a small tablet on its side) unless it is short and wide like a phone on its side (1.7
 * and over). Below 1024 px the copy runs the full width, as on a tablet held upright, and the
 * landscape move's subject, at the right of the frame, would stand in the text; the portrait move
 * keeps it small in the upper middle and takes it down under each heading. Where such a window is
 * not taller than wide (wideCopyFraming), the hero's copy leaves the right of the frame open, so the
 * move opens with the microphone there, beside it (wideOpening), not under it as on a phone. A phone
 * on its side keeps the landscape move: its frame is too short for the portrait move's stage.
 * The static tier chooses its still frames by the same rule (SceneStills.tsx, globals.css).
 */
export const portraitFraming = (width: number, height: number): boolean => {
  const aspect = width / Math.max(1, height);
  return aspect <= 0.9 || (width < 1024 && aspect < 1.7);
};

/**
 * A phone on its side: the landscape move (short and wide) in a window under 768 px wide, where the
 * page is laid out as on a phone (from 768 px the seat counter has the desktop's layout, and the
 * grille keeps clear of it as on a desktop).
 */
export const sidewaysPhone = (width: number, height: number): boolean => width < 768 && !portraitFraming(width, height);

/**
 * The portrait move in a window that is not taller than wide (over 0.9; see portraitFraming).
 * From 640 px wide the hero's copy is laid out as on a desktop there (the headline across the left
 * half or more of the frame, then the three facts side by side), so the phone's hero, with the
 * microphone in the lower middle under the headline, would stand on the facts row: the microphone
 * stands at the right, beside the headline and the facts. Under 640 px (a small near-square
 * window) the headline is set at the phone's size and runs most of the width, with the rest of the
 * copy stacked in a narrow column under it: the microphone stands at the right too, but lower,
 * under the end of the headline and beside that column (`heroY`); where such a window is clearly
 * wider than tall the headline stops short of the right edge and the microphone stands beside it,
 * as from 640 px (contentLayout.ts, measureHero). The static tier follows the same aspect
 * (SceneStills.tsx, globals.css).
 */
export const WIDE_COPY_ASPECT = 0.9;
export const WIDE_COPY_MIN_WIDTH = 640;
export const wideCopyFraming = (width: number, height: number): boolean => width / Math.max(1, height) > WIDE_COPY_ASPECT && portraitFraming(width, height);
/** The hero's anchor x in such a window when the layout is not measured, its limits, and the macro's. */
const WIDE_HERO_X = 0.74;
export const WIDE_HERO_X_RANGE = [0.66, 0.84] as const;
const WIDE_MACRO_X = 0.78;
/**
 * As the hero scrolls out, the anchor goes this far right of the macro's place for a moment: the
 * grille, growing as the camera pushes in, keeps its air from the end of the facts row.
 */
const WIDE_PUSH_AIR = 0.03;
/**
 * The hero's anchor height there: the microphone beside the copy, level with the headline and the
 * facts; the lowest it goes to stand under the headline instead (the phone's hero height); and the
 * lowest it is held at where the copy fits neither place (contentLayout.ts, measureHero).
 */
export const WIDE_HERO_Y = 0.53;
export const WIDE_HERO_Y_MAX = 0.66;
export const WIDE_HERO_Y_LOWEST = 0.72;
/**
 * The opening of the portrait move for a wide-copy window: the hero's microphone at the right of
 * the frame, clear of the headline and the facts row (`heroX`, measured from the layout:
 * contentLayout.ts, measureHero); it slides right early in the push in, so the growing grille keeps
 * clear of the facts row while that scrolls out, into a macro that sits further right than on a
 * phone (the Theme headline runs wider), and the pull out brings it to the middle of the width for
 * the stage, as on a phone. The height holds through the hero and the push
 * in (the phone's hero starts lower and rises).
 *
 * The light: at the right of the frame the barrel comes up behind the hero's scroll hint and the
 * Theme stage's clause counter as the hero scrolls out (on a phone it comes up in the middle,
 * between them), so the engraving stays as dim as it is during the push in until those small
 * labels have passed (about J 1.1), and only then takes the macro's light.
 */
function wideOpening(heroX: number | undefined, heroY: number | undefined): Pick<Move, 'ax' | 'ay' | 'looks'> {
  const hx = Math.min(WIDE_HERO_X_RANGE[1], Math.max(WIDE_HERO_X_RANGE[0], heroX ?? WIDE_HERO_X));
  const hy = Math.min(WIDE_HERO_Y_LOWEST, Math.max(WIDE_HERO_Y, heroY ?? WIDE_HERO_Y));
  const out = Math.max(hx + 0.003, WIDE_MACRO_X + WIDE_PUSH_AIR);
  const open = PORTRAIT_MOVE.looks.open;
  return {
    ax: [[0.4, hx], [0.5, hx + 0.003], [0.95, out], [1.05, out], [1.4, WIDE_MACRO_X], [1.5, WIDE_MACRO_X + 0.005], [1.8, WIDE_MACRO_X], ...PORTRAIT_MOVE.ax.filter(([j]) => j >= 2.8)],
    ay: [[0.4, hy], [0.5, hy], ...PORTRAIT_MOVE.ay.filter(([j]) => j > 0.5)],
    looks: {
      ...PORTRAIT_MOVE.looks,
      open: [
        ...open.filter((k) => k.at < 1),
        lk(1.1, lightAt(open, 1.1), { exposure: PUSH_PORTRAIT_LOOK.exposure, key: 0.55, env: PUSH_PORTRAIT_LOOK.env }),
        lk(1.28, lightAt(open, 1.28)),
        ...open.filter((k) => k.at > 1.3),
      ],
    },
  };
}

/**
 * A phone on its side (the landscape move, sidewaysPhone): the seat counter is laid out as on a
 * phone held upright, and in the short frame the grille crosses its numerals, ruler and caption on
 * the way down (about J 5.55 to 5.85). The same treatment as the portrait move: the microphone's
 * own light is down while it crosses (CROSSING_DIM) and back once it stands under the caption.
 */
const SIDEWAYS_LOOKS: Move['looks'] = {
  ...DESKTOP_MOVE.looks,
  stage: [
    ...DESKTOP_MOVE.looks.stage.filter((k) => k.at < 5.5),
    lk(5.5, lightAt(DESKTOP_MOVE.looks.stage, 5.5), CROSSING_DIM),
    lk(5.65, SPEAKER_LOOK, CROSSING_DIM),
    lk(5.85, SPEAKER_LOOK, CROSSING_DIM),
    lk(5.9, SPEAKER_LOOK, { exposure: 0.96, cone: 0.38, spot: 0.78, rim: 1.3 }),
    ...DESKTOP_MOVE.looks.stage.filter((k) => k.at > 5.95),
  ],
};

/** The shot list for the current page content (defaults reproduce DESKTOP_SHOTS / PORTRAIT_SHOTS). */
export function shotsFor(portrait: boolean, opts: ShotOptions): Shot[] {
  if (portrait) {
    // The grille follows the seat counter as this frame lays it out (a tablet's is wider and shorter).
    if (!opts.ticketsRoom && (!opts.aspect || Math.abs(opts.aspect - PORTRAIT_ASPECT) < 0.03)) return PORTRAIT_SHOTS;
    const end = endKeys(END_PORTRAIT, opts.ticketsRoom ?? ROOM_PORTRAIT, opts.aspect ?? PORTRAIT_ASPECT);
    // A window with the wide copy layout opens on its own hero and macro (wideOpening).
    const open = opts.wideCopy ? wideOpening(opts.heroX, opts.heroY) : PORTRAIT_MOVE;
    return moveShots(PORTRAIT_MOVE, {
      ax: [...open.ax.filter(([j]) => j < END_PORTRAIT.from), ...end.ax],
      ay: [...open.ay.filter(([j]) => j < END_PORTRAIT.from), ...end.ay],
      aspect: opts.aspect ?? PORTRAIT_ASPECT,
      looks: open.looks,
    });
  }
  const vx = opts.venueX === undefined ? VENUE_X : Math.min(0.68, Math.max(0.5, opts.venueX));
  // Without a speakers panel (speakers announced: the card strip along the lower edge) the default holds.
  // Over Speakers the subject sits right of the panel, and well right of its Venue place (on wide
  // screens the content column, and with it everything, sits nearer the middle).
  const sx = Math.min(0.82, Math.max(vx + 0.085, opts.speakersTba ? (opts.speakersX ?? SPEAKERS_X) : 0));
  const tx = opts.ticketsX === undefined ? TICKETS_X : Math.min(0.62, Math.max(0.5, opts.ticketsX));
  const hx = opts.heroX === undefined ? HERO_X : Math.min(0.74, Math.max(HERO_X, opts.heroX));
  const measured = vx !== VENUE_X || sx !== SPEAKERS_X || tx !== TICKETS_X || hx !== HERO_X || !!opts.aspect || !!opts.ticketsRoom;
  if (opts.speakersTba && !measured) return DESKTOP_SHOTS;
  // The grille's place over the end of Tickets, for the seat counter as this frame lays it out.
  const end = endKeys(END_DESKTOP, opts.ticketsRoom ?? ROOM_DESKTOP, opts.aspect ?? 1.7);
  const ay0 = opts.speakersTba ? DESKTOP_MOVE.ay : (DESKTOP_ANNOUNCED.ay ?? DESKTOP_MOVE.ay);
  const keys = measured
    ? {
        ax: [...heroAx(hx), ...DESKTOP_MOVE.ax.filter(([j]) => j > 0.6 && j < 2.9), ...stageAx(sx, vx, tx), ...end.ax],
        ay: [...ay0.filter(([j]) => j < END_DESKTOP.from), ...end.ay],
      }
    : {};
  // The stand is held in a gap a few dozen pixels wide over Tickets (Move.hold): use the real frame.
  const aspect = opts.aspect ? { aspect: opts.aspect } : {};
  const looks = opts.sideways ? { looks: SIDEWAYS_LOOKS } : {};
  return moveShots(DESKTOP_MOVE, opts.speakersTba ? { ...keys, ...aspect, ...looks } : { ...DESKTOP_ANNOUNCED, ...keys, ...aspect, ...looks });
}

/* ------------------------------------------------------------------------- */
/* Resolution and sampling                                                   */
/* ------------------------------------------------------------------------- */

const WORLD_UP = new Vector3(0, 1, 0);
const rs = { f: new Vector3(), u0: new Vector3(), m: new Vector3(), c: new Vector3(), d: new Vector3() };

/** Camera up for a view direction `fwd` rolled by `roll` radians (0: horizon level). */
function upFor(fwd: Vector3, roll: number, out: Vector3): Vector3 {
  const u0 = rs.u0.copy(WORLD_UP).addScaledVector(fwd, -WORLD_UP.dot(fwd)).normalize();
  if (roll === 0) return out.copy(u0);
  const r = rs.c.crossVectors(fwd, u0); // screen left
  return out.copy(u0).multiplyScalar(Math.cos(roll)).addScaledVector(r, Math.sin(roll)).normalize();
}

/** Roll (radians) that turns the mic barrel upright on screen for a view direction. */
function barrelRoll(fwd: Vector3): number {
  const u0 = rs.u0.copy(WORLD_UP).addScaledVector(fwd, -WORLD_UP.dot(fwd)).normalize();
  const m = rs.m.copy(MIC_AXIS).addScaledVector(fwd, -MIC_AXIS.dot(fwd)).normalize();
  const left = rs.c.crossVectors(fwd, u0);
  return Math.atan2(m.dot(left), m.dot(u0));
}

export function resolveShot(s: Shot): ResolvedShot {
  const target = aimPoint(s.aim);
  const origin = trackOrigin(s.aim);
  const lift = s.lift ?? 0;
  const orbit = (s.orbit ?? 0) * DEG;
  const elev = s.elev === undefined ? TRACK_ELEV : s.elev * DEG;
  const pos = origin.clone().addScaledVector(trackDir(orbit, elev), s.dist);
  pos.y += lift;
  if ('stand' in s.aim && s.aim.out) aimOut(pos, target, s.aim.out, s.aim.outX ?? 0);
  const off = pos.clone().sub(target);
  const dir = off.clone().normalize();
  const fwd = dir.clone().negate();
  const roll = (s.roll ?? 0) * barrelRoll(fwd);
  return {
    at: s.at,
    pos,
    target,
    dir,
    logDist: Math.log(Math.max(1e-4, off.length())),
    up: upFor(fwd, roll, new Vector3()),
    origin,
    logU: Math.log(Math.max(1e-4, s.dist)),
    orbit,
    elev,
    lift,
    roll,
    shiftX: s.anchor[0],
    shiftY: s.anchor[1],
    fov: s.fov,
    exposure: s.exposure,
    dof: s.dof ?? 0,
    drift: s.drift ?? 0,
    parallax: s.parallax ?? 0,
    cone: s.cone ?? 1,
    spot: s.spot ?? 1,
    envRot: s.envRot ?? 0,
    shade: s.shade ?? 0,
    key: s.key ?? 1,
    keyCam: s.keyCam ?? ('mic' in s.aim && s.dist < 0.2 ? 1 : 0),
    vignette: s.vignette ?? 0.6,
    rim: s.rim ?? 1,
    rimAng: s.rimAng ?? 0.5,
    haze: s.haze ?? 0,
    motes: s.motes ?? 0,
    keyDir: new Vector3(...(s.keyDir ?? [-0.18, 0.9, 0])),
    focusX: s.focus?.[0] ?? s.anchor[0],
    focusY: s.focus?.[1] ?? 1 - s.anchor[1],
    scrim: s.scrim ?? 0,
    scrimEdge: s.scrimEdge ?? 0,
    band: s.band ?? 0,
    bloom: s.bloom ?? 1,
    env: s.env ?? 1,
    warm: s.warm ?? 0,
    turn: s.turn ?? 0,
    react: s.react ?? 1,
  };
}

export const resolveShots = (shots: Shot[]) => shots.map(resolveShot);

const scalarKeys = [
  'logU',
  'orbit',
  'elev',
  'lift',
  'roll',
  'shiftX',
  'shiftY',
  'fov',
  'exposure',
  'dof',
  'drift',
  'parallax',
  'cone',
  'spot',
  'envRot',
  'shade',
  'key',
  'keyCam',
  'vignette',
  'rim',
  'rimAng',
  'haze',
  'motes',
  'focusX',
  'focusY',
  'scrim',
  'scrimEdge',
  'band',
  'bloom',
  'env',
  'warm',
  'turn',
  'react',
] as const;
const vectorKeys = ['target', 'origin', 'keyDir'] as const;

/**
 * Fritsch-Carlson monotone cubic slopes for samples ys at xs: never
 * overshoots, zero slope at local extrema and at holds, C1 everywhere.
 */
export function pchipSlopes(xs: readonly number[], ys: readonly number[]): number[] {
  const n = xs.length;
  const m = new Array<number>(n).fill(0);
  if (n < 3) return m;
  const d: number[] = [];
  for (let k = 0; k < n - 1; k++) d.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) continue;
    const h0 = xs[k] - xs[k - 1];
    const h1 = xs[k + 1] - xs[k];
    const w1 = 2 * h1 + h0;
    const w2 = h1 + 2 * h0;
    m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
  }
  return m;
}

function hermite(y0: number, y1: number, m0: number, m1: number, h: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * y0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * y1 + (t3 - t2) * h * m1;
}

type Spline = { xs: number[]; ys: Record<string, number[]>; ms: Record<string, number[]> };
const splines = new WeakMap<ResolvedShot[], Spline>();

function splineFor(shots: ResolvedShot[]): Spline {
  let sp = splines.get(shots);
  if (sp) return sp;
  const xs = shots.map((s) => s.at);
  const ys: Record<string, number[]> = {};
  for (const k of scalarKeys) ys[k] = shots.map((s) => s[k]);
  for (const k of vectorKeys) for (const c of ['x', 'y', 'z'] as const) ys[`${k}.${c}`] = shots.map((s) => s[k][c]);
  const ms: Record<string, number[]> = {};
  for (const k of Object.keys(ys)) ms[k] = pchipSlopes(xs, ys[k]);
  sp = { xs, ys, ms };
  splines.set(shots, sp);
  return sp;
}

/** Fill the derived pose (camera, direction, distance, up) from the track channels. */
function derivePose(out: ResolvedShot) {
  out.pos.copy(out.origin).addScaledVector(trackDir(out.orbit, out.elev, rs.d), Math.exp(out.logU));
  out.pos.y += out.lift;
  out.dir.subVectors(out.pos, out.target);
  out.logDist = Math.log(Math.max(1e-4, out.dir.length()));
  out.dir.normalize();
  upFor(rs.f.copy(out.dir).negate(), out.roll, out.up);
}

/** Sample the path at journey position J into `out` (mutated). */
export function sampleShots(shots: ResolvedShot[], J: number, out: ResolvedShot): ResolvedShot {
  const n = shots.length;
  if (n === 1 || J <= shots[0].at) return copyShot(shots[0], out);
  if (J >= shots[n - 1].at) return copyShot(shots[n - 1], out);
  const sp = splineFor(shots);
  let i = 0;
  while (i < n - 2 && J >= shots[i + 1].at) i++;
  const h = sp.xs[i + 1] - sp.xs[i];
  const t = (J - sp.xs[i]) / h;
  const ev = (k: string) => hermite(sp.ys[k][i], sp.ys[k][i + 1], sp.ms[k][i], sp.ms[k][i + 1], h, t);
  for (const k of scalarKeys) out[k] = ev(k);
  for (const k of vectorKeys) out[k].set(ev(`${k}.x`), ev(`${k}.y`), ev(`${k}.z`));
  derivePose(out);
  out.at = J;
  return out;
}

function copyShot(s: ResolvedShot, out: ResolvedShot) {
  out.pos.copy(s.pos);
  out.target.copy(s.target);
  out.dir.copy(s.dir);
  out.logDist = s.logDist;
  out.up.copy(s.up);
  out.origin.copy(s.origin);
  out.keyDir.copy(s.keyDir);
  for (const k of scalarKeys) out[k] = s[k];
  out.at = s.at;
  return out;
}

export function emptyShot(): ResolvedShot {
  return resolveShot({ at: 0, aim: { mic: 0.095 }, dist: 1, anchor: [0.5, 0.5], fov: 30, exposure: 1 });
}

/* ------------------------------------------------------------------------- */
/* Journey coordinate                                                        */
/* ------------------------------------------------------------------------- */

/**
 * J from per-section progress (scrollState.sections) plus the measured
 * section heights (px) and viewport height. Returns -1 when no home
 * sections are present.
 */
export function journey(
  sections: Record<SectionId, number>,
  heights: Partial<Record<SectionId, number>>,
  vh: number,
): number {
  let any = false;
  let last = -1;
  for (let k = 0; k < SECTION_IDS.length; k++) {
    const id = SECTION_IDS[k];
    const h = heights[id];
    if (!h) continue;
    any = true;
    const p = sections[id];
    const c = (p * (h + vh) - vh / 2) / h;
    if (c >= 0 && c < 1) return k + c;
    if (c >= 1) last = k + 1;
    else return last >= 0 ? last : Math.max(0, k + c);
  }
  return any ? Math.max(0, last) : -1;
}
