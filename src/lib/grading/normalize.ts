/**
 * Normalizare de text pentru corectarea răspunsurilor în limba română.
 *
 * Două capcane reale, ambele frecvente la cursanții rusofoni care scriu de pe
 * tastaturi diferite:
 *
 *  1. Româna are DOUĂ codificări în circulație pentru ș/ț — varianta corectă cu
 *     virgulă dedesubt (U+0219 / U+021B) și varianta veche cu sedilă
 *     (U+015F / U+0163), care arată aproape identic. Le tratăm ca fiind egale.
 *  2. Mulți cursanți scriu fără diacritice deloc („casa" în loc de „casă").
 *     Asta nu e răspuns greșit, ci răspuns incomplet — de aceea `stripDiacritics`
 *     e separat, iar decizia de punctaj se ia în `grade.ts`, nu aici.
 */

/** Sedilă → virgulă dedesubt. Aplicat înaintea oricărei comparații. */
const CEDILLA_TO_COMMA: Record<string, string> = {
  "ş": "ș", // ş → ș
  "Ş": "Ș", // Ş → Ș
  "ţ": "ț", // ţ → ț
  "Ţ": "Ț", // Ţ → Ț
};

const DIACRITIC_TO_BASE: Record<string, string> = {
  ă: "a",
  â: "a",
  î: "i",
  ș: "s",
  ț: "t",
};

/** Ghilimele tipografice și apostrofuri → forme simple. */
const PUNCTUATION_MAP: Record<string, string> = {
  "“": '"',
  "”": '"',
  "„": '"',
  "’": "'",
  "‘": "'",
  "–": "-",
  "—": "-",
};

/** Unifică sedila cu virgula dedesubt. Nu schimbă nimic altceva. */
export function unifyRomanianCommaBelow(input: string): string {
  return input.replace(/[şŞţŢ]/g, (ch) => CEDILLA_TO_COMMA[ch] ?? ch);
}

/**
 * Forma canonică folosită la comparație: fără spații redundante, minuscule,
 * punctuație tipografică unificată, diacriticele PĂSTRATE.
 */
export function normalizeAnswer(input: string): string {
  return unifyRomanianCommaBelow(input)
    .normalize("NFC")
    .replace(/[“”„’‘–—]/g, (ch) => PUNCTUATION_MAP[ch] ?? ch)
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Forma fără diacritice, pentru a detecta răspunsurile corecte ca formă dar
 * scrise fără semne. Se aplică PESTE `normalizeAnswer`.
 */
export function stripDiacritics(input: string): string {
  return normalizeAnswer(input).replace(/[ăâîșț]/g, (ch) => DIACRITIC_TO_BASE[ch] ?? ch);
}

/** Elimină punctuația finală, care nu ar trebui să decidă corectitudinea. */
export function stripTrailingPunctuation(input: string): string {
  return input.replace(/[.!?,;:]+$/u, "").trim();
}

/**
 * Comparație folosită de motorul de corectare: strictă (cu diacritice) și
 * relaxată (fără), ca apelantul să poată acorda punctaj parțial.
 */
export function compareAnswers(
  given: string,
  expected: string,
): { exact: boolean; withoutDiacritics: boolean } {
  const g = stripTrailingPunctuation(normalizeAnswer(given));
  const e = stripTrailingPunctuation(normalizeAnswer(expected));
  if (g === e) return { exact: true, withoutDiacritics: true };

  const gPlain = stripTrailingPunctuation(stripDiacritics(given));
  const ePlain = stripTrailingPunctuation(stripDiacritics(expected));
  return { exact: false, withoutDiacritics: gPlain === ePlain };
}
