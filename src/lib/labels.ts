/**
 * Etichete pentru valorile din baza de date.
 *
 * Enumerările sunt în engleză în schemă (convenție de cod), dar nu au ce căuta
 * așa în interfață: profesorul citește română, cursantul rusă.
 */

export const homeworkStateRo: Record<string, string> = {
  not_started: "neîncepută",
  in_progress: "în lucru",
  submitted: "trimisă",
  graded: "corectată",
  overdue: "restantă",
};

export const homeworkStateRu: Record<string, string> = {
  not_started: "не начато",
  in_progress: "в работе",
  submitted: "отправлено",
  graded: "проверено",
  overdue: "просрочено",
};

export const homeworkTone: Record<string, "neutral" | "accent" | "success" | "warning"> = {
  not_started: "neutral",
  in_progress: "accent",
  submitted: "accent",
  graded: "success",
  overdue: "warning",
};

export const exerciseTypeRo: Record<string, string> = {
  mcq: "alegere multiplă",
  fill: "completare",
  match: "asociere",
  order: "ordonare",
  short: "răspuns scurt",
  audio_q: "întrebare după audio",
};

/** Date relative, în română — „azi", „mâine", „acum 3 zile". */
export function relativeDayRo(date: Date, now = new Date()): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);

  if (days === 0) return "azi";
  if (days === 1) return "mâine";
  if (days === -1) return "ieri";
  if (days > 1) return `în ${days} zile`;
  return `acum ${Math.abs(days)} zile`;
}
