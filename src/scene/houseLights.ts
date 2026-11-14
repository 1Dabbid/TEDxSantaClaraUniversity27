/**
 * The house lights follow the Tickets seat counter.
 *
 * The big "001 - 100" counter in the Tickets section (TicketsMotion) is the
 * single source of truth: on every update it writes the number it shows here
 * (continuous, so a seat warms up while the units wheel turns over to it), and
 * the scene lights the house seat by seat from it (Seats, Venue: the seat tops
 * and a soft pool on the tread round each seat). Scrubbing the counter back
 * un-lights the seats.
 *
 * Plain mutable singleton, no three.js: the motion layer imports it without
 * pulling the scene in.
 */
export const houseLights = {
  /**
   * The counter's value: 0 before it starts, then 1 .. capacity (continuous).
   * null while no counter is running (the Tickets moment was skipped, or the
   * section is not mounted): the scene then fills the house on its own over
   * the end of Tickets.
   */
  count: null as number | null,
  /** The room's capacity as the content gives it (settings.capacity, the counter's last figure). */
  capacity: 100,
};

/**
 * Seats of the 3D house lit for a counter value: seat n of the house (in its
 * lighting order, layout.ts seatOrder) lights when the counter reaches n. The
 * house is always built with HOUSE_SEATS (100) seats and the content's
 * capacity is at most that (the admin caps it at 100), so a smaller room
 * lights only its first `capacity` seats, row by row from the front, and the
 * rest of the house stays dark. Should a capacity ever exceed the house, the
 * counter is mapped onto it in proportion (full when the count is).
 */
export function houseSeatsLit(count: number, capacity: number, houseSeats: number): number {
  if (!(capacity > 0) || !(count > 0)) return 0;
  const c = Math.min(count, capacity);
  return capacity <= houseSeats ? c : (c * houseSeats) / capacity;
}
