import { describe, expect, it } from "vitest";
import {
  NO_DIACRITICS_CREDIT,
  effectiveScore,
  gradeAttempt,
  type GradableExercise,
} from "@/lib/grading/grade";
import { compareAnswers, normalizeAnswer, stripDiacritics } from "@/lib/grading/normalize";

const base: Omit<GradableExercise, "type" | "canonicalAnswer"> = {
  acceptedVariants: [],
  points: 1,
};

describe("normalizare română", () => {
  it("tratează sedila și virgula dedesubt ca fiind identice", () => {
    // „şcoală" cu sedilă (U+015F) vs „școală" cu virgulă (U+0219)
    expect(normalizeAnswer("şcoală")).toBe(normalizeAnswer("școală"));
    expect(compareAnswers("ştiu", "știu").exact).toBe(true);
  });

  it("elimină diacriticele doar în forma relaxată", () => {
    expect(normalizeAnswer("casă")).toBe("casă");
    expect(stripDiacritics("casă")).toBe("casa");
    expect(stripDiacritics("înțeleg")).toBe("inteleg");
  });

  it("ignoră spațiile redundante, majusculele și punctuația finală", () => {
    expect(compareAnswers("  Bună   ziua!  ", "bună ziua").exact).toBe(true);
  });

  it("nu confundă forme diferite ale aceluiași cuvânt", () => {
    // Articolul hotărât e o dificultate tipică pentru rusofoni (brief §4):
    // „casa" și „casă" TREBUIE să rămână distincte la comparația strictă.
    const cmp = compareAnswers("casa", "casă");
    expect(cmp.exact).toBe(false);
    // ...dar se recunosc ca aceeași formă scrisă fără diacritice,
    // ceea ce mai jos produce punctaj parțial, nu zero.
    expect(cmp.withoutDiacritics).toBe(true);
  });
});

describe("completare (fill)", () => {
  const exercise: GradableExercise = { ...base, type: "fill", canonicalAnswer: "școală" };

  it("acordă punctaj întreg pentru răspuns exact", () => {
    const r = gradeAttempt(exercise, "școală");
    expect(r.score).toBe(1);
    expect(r.verdict).toBe("correct");
    expect(r.needsReview).toBe(false);
  });

  it("acordă punctaj parțial pentru răspuns fără diacritice", () => {
    const r = gradeAttempt(exercise, "scoala");
    expect(r.score).toBe(NO_DIACRITICS_CREDIT);
    expect(r.verdict).toBe("correct_no_diacritics");
    expect(r.needsReview).toBe(false);
  });

  it("acceptă variantele adăugate de profesor", () => {
    const withVariants: GradableExercise = {
      ...exercise,
      acceptedVariants: ["scoala primară", "școala primară"],
    };
    expect(gradeAttempt(withVariants, "școala primară").score).toBe(1);
  });

  it("marchează răspunsul gol ca incorect, fără revizuire", () => {
    const r = gradeAttempt(exercise, "   ");
    expect(r.score).toBe(0);
    expect(r.needsReview).toBe(false);
  });
});

describe("asociere (match)", () => {
  const exercise: GradableExercise = {
    ...base,
    type: "match",
    points: 4,
    canonicalAnswer: { дом: "casă", школа: "școală", книга: "carte", вода: "apă" },
  };

  it("acordă punctaj proporțional cu perechile corecte", () => {
    const r = gradeAttempt(exercise, {
      дом: "casă",
      школа: "școală",
      книга: "apă",
      вода: "carte",
    });
    expect(r.score).toBe(2);
    expect(r.verdict).toBe("partial");
  });

  it("acordă punctaj întreg când toate perechile sunt corecte", () => {
    const r = gradeAttempt(exercise, exercise.canonicalAnswer);
    expect(r.score).toBe(4);
    expect(r.verdict).toBe("correct");
  });
});

describe("ordonare (order)", () => {
  const exercise: GradableExercise = {
    ...base,
    type: "order",
    canonicalAnswer: ["Eu", "merg", "la", "școală"],
  };

  it("cere ordinea integral corectă", () => {
    expect(gradeAttempt(exercise, ["Eu", "merg", "la", "școală"]).verdict).toBe("correct");
    expect(gradeAttempt(exercise, ["Eu", "la", "merg", "școală"]).verdict).toBe("incorrect");
  });

  it("respinge răspunsurile de lungime greșită fără să arunce", () => {
    expect(gradeAttempt(exercise, ["Eu", "merg"]).score).toBe(0);
    expect(gradeAttempt(exercise, null).score).toBe(0);
  });
});

describe("răspuns scurt (short)", () => {
  const exercise: GradableExercise = {
    ...base,
    type: "short",
    canonicalAnswer: "Mă numesc Ana",
  };

  it("recunoaște potrivirea exactă fără să ceară revizuire", () => {
    const r = gradeAttempt(exercise, "mă numesc ana");
    expect(r.verdict).toBe("correct");
    expect(r.needsReview).toBe(false);
  });

  it("NU declară greșit un răspuns nepotrivit — îl trimite la profesor", () => {
    const r = gradeAttempt(exercise, "Numele meu este Ana");
    expect(r.verdict).toBe("undecided");
    expect(r.needsReview).toBe(true);
    expect(r.confidence).toBeLessThan(0.75);
  });
});

describe("invariantul 3 — profesorul are ultimul cuvânt", () => {
  it("scorul profesorului îl înlocuiește pe cel automat", () => {
    expect(effectiveScore({ autoScore: 0, teacherScore: 1 })).toBe(1);
  });

  it("scorul profesorului se aplică și când e zero", () => {
    expect(effectiveScore({ autoScore: 1, teacherScore: 0 })).toBe(0);
  });

  it("scorul automat rămâne când profesorul nu a intervenit", () => {
    expect(effectiveScore({ autoScore: 0.5, teacherScore: null })).toBe(0.5);
  });

  it("returnează null când nu există niciun scor", () => {
    expect(effectiveScore({ autoScore: null, teacherScore: null })).toBeNull();
  });
});
