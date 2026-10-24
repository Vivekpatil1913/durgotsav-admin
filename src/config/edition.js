// Festival edition — the ONLY value to change in the admin console for the next year's festival (2027, 2028 …).
// Keep it equal to EDITION_YEAR in backend/ and frontend/ src/config/edition.js: the console shows a warning
// when the API reports a different edition_year.
// Kept free of imports: vite.config.js reads this file too, to fill %EDITION_YEAR% in index.html.
export const EDITION_YEAR = 2026;

const DEVANAGARI = "०१२३४५६७८९";

// "२०२६" — the same year in Marathi digits
export const EDITION_YEAR_MR = String(EDITION_YEAR).replace(/\d/g, (d) => DEVANAGARI[d]);
