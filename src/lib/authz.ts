/**
 * Stratul de autorizare. Este singurul loc din aplicație unde se decide cine
 * vede ce. Regulile din brief §3:
 *
 *   - profesorul vede EXCLUSIV cursanții alocați lui;
 *   - cursantul vede EXCLUSIV propriul parcurs, și doar conținutul deblocat;
 *   - administratorul gestionează conturi și conținut global.
 *
 * Funcțiile `can*` sunt pure și se testează unitar. Funcțiile `assert*` se
 * folosesc în server actions și route handlers: aruncă `ForbiddenError`, care
 * este tradus în 403 la marginea aplicației.
 *
 * Regulă de aur: ascunderea unui buton în UI NU este autorizare. Fiecare query
 * care atinge date de cursant trece printr-un `assert*` de aici.
 */

export type Role = "teacher" | "student" | "admin";

export type Actor = {
  userId: string;
  role: Role;
  isActive: boolean;
};

/** Proiecția minimă a unui cursant necesară deciziilor de acces. */
export type StudentRef = {
  id: string;
  userId: string;
  teacherId: string;
};

/** Proiecția minimă a unei alocări. */
export type AssignmentRef = {
  id: string;
  studentId: string;
  state: "locked" | "unlocked" | "in_progress" | "completed";
};

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Acces interzis") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthenticatedError extends Error {
  readonly code = "UNAUTHENTICATED";
  constructor(message = "Autentificare necesară") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/* ------------------------------------------------------------------ *
 * Predicate pure
 * ------------------------------------------------------------------ */

/** Un cont dezactivat nu poate face nimic, indiferent de rol. */
export function isUsable(actor: Actor | null): actor is Actor {
  return actor !== null && actor.isActive;
}

/**
 * Sunt predicate de tip, nu simple `boolean`: după `if (!isStudent(actor)) return`,
 * compilatorul știe că `actor` nu mai poate fi `null`. Fără asta, fiecare apelant
 * ar trebui să repete verificarea de null — și, mai devreme sau mai târziu, ar uita.
 */
export function isAdmin(actor: Actor | null): actor is Actor {
  return isUsable(actor) && actor.role === "admin";
}

export function isTeacher(actor: Actor | null): actor is Actor {
  return isUsable(actor) && actor.role === "teacher";
}

export function isStudent(actor: Actor | null): actor is Actor {
  return isUsable(actor) && actor.role === "student";
}

/**
 * Cine poate citi datele unui cursant: cursantul însuși, profesorul alocat,
 * administratorul. Nimeni altcineva — inclusiv alți profesori.
 */
export function canAccessStudent(actor: Actor | null, student: StudentRef): boolean {
  if (!isUsable(actor)) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "teacher") return student.teacherId === actor.userId;
  return student.userId === actor.userId;
}

/** Doar profesorul alocat (sau adminul) modifică parcursul unui cursant. */
export function canManageStudent(actor: Actor | null, student: StudentRef): boolean {
  if (!isUsable(actor)) return false;
  if (actor.role === "admin") return true;
  return actor.role === "teacher" && student.teacherId === actor.userId;
}

/**
 * Conținutul e blocat implicit (brief §5). Cursantul îl poate deschide doar
 * dacă are o alocare activă; profesorul alocat îl vede oricând.
 */
export function canViewAssignment(
  actor: Actor | null,
  assignment: AssignmentRef,
  student: StudentRef,
): boolean {
  if (!canAccessStudent(actor, student)) return false;
  if (assignment.studentId !== student.id) return false;
  if (isStudent(actor)) return assignment.state !== "locked";
  return true;
}

/** Doar cursantul căruia îi aparține alocarea poate trimite răspunsuri. */
export function canSubmitAttempt(
  actor: Actor | null,
  assignment: AssignmentRef,
  student: StudentRef,
): boolean {
  if (!isStudent(actor)) return false;
  if (student.userId !== actor.userId) return false;
  if (assignment.studentId !== student.id) return false;
  return assignment.state === "unlocked" || assignment.state === "in_progress";
}

/** Suprascrierea corectării automate: doar profesorul alocat sau adminul. */
export function canOverrideGrade(actor: Actor | null, student: StudentRef): boolean {
  return canManageStudent(actor, student);
}

/** Editarea bibliotecii curriculare: profesor sau admin. */
export function canEditCurriculum(actor: Actor | null): boolean {
  return isTeacher(actor) || isAdmin(actor);
}

/**
 * Publicarea unei versiuni de lecție. Gate editorial din brief §9: conținutul
 * generat de AI nu devine disponibil cursanților fără validare umană.
 */
export function canPublishLessonVersion(
  actor: Actor | null,
  version: { approvedBy: string | null; origin: "human" | "ai_generated" | "ai_assisted" },
): boolean {
  if (!canEditCurriculum(actor)) return false;
  if (version.origin === "human") return true;
  return version.approvedBy !== null;
}

/* ------------------------------------------------------------------ *
 * Aserțiuni pentru server actions
 * ------------------------------------------------------------------ */

export function assertAuthenticated(actor: Actor | null): asserts actor is Actor {
  if (actor === null) throw new UnauthenticatedError();
  if (!actor.isActive) throw new ForbiddenError("Cont dezactivat");
}

export function assertRole(actor: Actor | null, ...roles: Role[]): asserts actor is Actor {
  assertAuthenticated(actor);
  if (!roles.includes(actor.role)) {
    throw new ForbiddenError(`Rol necesar: ${roles.join(" sau ")}`);
  }
}

export function assertCanAccessStudent(actor: Actor | null, student: StudentRef): void {
  if (!canAccessStudent(actor, student)) {
    throw new ForbiddenError("Nu ai acces la datele acestui cursant");
  }
}

export function assertCanManageStudent(actor: Actor | null, student: StudentRef): void {
  if (!canManageStudent(actor, student)) {
    throw new ForbiddenError("Nu poți modifica parcursul acestui cursant");
  }
}

export function assertCanViewAssignment(
  actor: Actor | null,
  assignment: AssignmentRef,
  student: StudentRef,
): void {
  if (!canViewAssignment(actor, assignment, student)) {
    throw new ForbiddenError("Lecția nu este deblocată pentru tine");
  }
}

export function assertCanSubmitAttempt(
  actor: Actor | null,
  assignment: AssignmentRef,
  student: StudentRef,
): void {
  if (!canSubmitAttempt(actor, assignment, student)) {
    throw new ForbiddenError("Nu poți trimite răspunsuri pentru această lecție");
  }
}
