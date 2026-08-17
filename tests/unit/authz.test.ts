import { describe, expect, it } from "vitest";
import {
  ForbiddenError,
  assertCanAccessStudent,
  canAccessStudent,
  canManageStudent,
  canPublishLessonVersion,
  canSubmitAttempt,
  canViewAssignment,
  type Actor,
  type AssignmentRef,
  type StudentRef,
} from "@/lib/authz";

const teacher: Actor = { userId: "t1", role: "teacher", isActive: true };
const otherTeacher: Actor = { userId: "t2", role: "teacher", isActive: true };
const studentActor: Actor = { userId: "u1", role: "student", isActive: true };
const otherStudentActor: Actor = { userId: "u2", role: "student", isActive: true };
const admin: Actor = { userId: "a1", role: "admin", isActive: true };

const student: StudentRef = { id: "s1", userId: "u1", teacherId: "t1" };

const unlocked: AssignmentRef = { id: "as1", studentId: "s1", state: "unlocked" };
const locked: AssignmentRef = { id: "as2", studentId: "s1", state: "locked" };

describe("izolarea datelor între cursanți", () => {
  it("cursantul își vede propriile date", () => {
    expect(canAccessStudent(studentActor, student)).toBe(true);
  });

  it("un cursant NU vede datele altui cursant", () => {
    expect(canAccessStudent(otherStudentActor, student)).toBe(false);
  });

  it("profesorul alocat vede cursantul", () => {
    expect(canAccessStudent(teacher, student)).toBe(true);
  });

  it("un profesor NEALOCAT nu vede cursantul", () => {
    expect(canAccessStudent(otherTeacher, student)).toBe(false);
    expect(canManageStudent(otherTeacher, student)).toBe(false);
  });

  it("adminul vede orice cursant", () => {
    expect(canAccessStudent(admin, student)).toBe(true);
  });

  it("un utilizator neautentificat nu vede nimic", () => {
    expect(canAccessStudent(null, student)).toBe(false);
  });

  it("un cont dezactivat nu vede nimic, indiferent de rol", () => {
    expect(canAccessStudent({ ...teacher, isActive: false }, student)).toBe(false);
    expect(canAccessStudent({ ...admin, isActive: false }, student)).toBe(false);
  });
});

describe("invariantul 2 — conținutul e blocat implicit", () => {
  it("cursantul nu poate deschide o lecție neblocată... adică blocată", () => {
    expect(canViewAssignment(studentActor, locked, student)).toBe(false);
  });

  it("cursantul deschide doar ce i s-a deblocat", () => {
    expect(canViewAssignment(studentActor, unlocked, student)).toBe(true);
  });

  it("profesorul vede și alocările blocate", () => {
    expect(canViewAssignment(teacher, locked, student)).toBe(true);
  });

  it("o alocare a altui cursant nu e vizibilă chiar dacă id-urile se amestecă", () => {
    const foreign: AssignmentRef = { id: "as9", studentId: "s9", state: "unlocked" };
    expect(canViewAssignment(studentActor, foreign, student)).toBe(false);
  });
});

describe("trimiterea răspunsurilor", () => {
  it("doar cursantul propriu poate trimite răspunsuri", () => {
    expect(canSubmitAttempt(studentActor, unlocked, student)).toBe(true);
    expect(canSubmitAttempt(otherStudentActor, unlocked, student)).toBe(false);
  });

  it("profesorul NU trimite răspunsuri în locul cursantului", () => {
    expect(canSubmitAttempt(teacher, unlocked, student)).toBe(false);
  });

  it("nu se poate răspunde la o lecție blocată sau finalizată", () => {
    expect(canSubmitAttempt(studentActor, locked, student)).toBe(false);
    expect(
      canSubmitAttempt(studentActor, { ...unlocked, state: "completed" }, student),
    ).toBe(false);
  });
});

describe("gate editorial pentru conținut AI", () => {
  it("conținutul uman se publică fără aprobare suplimentară", () => {
    expect(canPublishLessonVersion(teacher, { approvedBy: null, origin: "human" })).toBe(true);
  });

  it("conținutul generat de AI NU se publică fără validare umană", () => {
    expect(canPublishLessonVersion(teacher, { approvedBy: null, origin: "ai_generated" })).toBe(
      false,
    );
    expect(canPublishLessonVersion(teacher, { approvedBy: null, origin: "ai_assisted" })).toBe(
      false,
    );
  });

  it("conținutul AI aprobat de un om se poate publica", () => {
    expect(canPublishLessonVersion(teacher, { approvedBy: "t1", origin: "ai_generated" })).toBe(
      true,
    );
  });

  it("cursantul nu publică nimic, oricât de aprobat ar fi conținutul", () => {
    expect(
      canPublishLessonVersion(studentActor, { approvedBy: "t1", origin: "ai_generated" }),
    ).toBe(false);
  });
});

describe("aserțiuni", () => {
  it("aruncă ForbiddenError, nu returnează tăcut", () => {
    expect(() => assertCanAccessStudent(otherTeacher, student)).toThrow(ForbiddenError);
    expect(() => assertCanAccessStudent(teacher, student)).not.toThrow();
  });
});
