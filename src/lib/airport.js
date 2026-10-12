// Home airport rule: exactly three letters A to Z, stored upper-case.
// A saved value that fails the rule is never changed or deleted here;
// it is only treated as not set.

export const SAVED_BAD_NOTE = "Flights won't use this until it's a three-letter code, like JFK.";
export const TYPED_BAD_NOTE = 'Not saved. Use a three-letter code, like JFK.';

export const isAirportCode = (v) => typeof v === 'string' && /^[A-Z]{3}$/.test(v);

// The code Flights and the top button use: the saved value if it passes, otherwise ''.
export const usableAirport = (v) => (isAirportCode(v) ? v : '');

// While typing: upper-case, drop spaces and anything that isn't a letter, keep 3.
export const cleanAirportInput = (v) =>
  (typeof v === 'string' ? v : '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);

// The note to show when Settings opens with this saved value.
export const openingNote = (saved) =>
  typeof saved === 'string' && saved !== '' && !isAirportCode(saved) ? 'saved' : null;

// Leaving the box (blur or Enter). `changed` is false when nothing was typed since
// Settings opened or since the last leave. Returns what to save (undefined = write
// nothing) and which note to show.
export function leaveAirportBox(box, changed, currentNote = null) {
  if (!changed) return { save: undefined, note: currentNote };
  if (box === '') return { save: '', note: null };
  if (isAirportCode(box)) return { save: box, note: null };
  return { save: undefined, note: 'typed' };
}
