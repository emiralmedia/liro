"use client";

import { useCallback, useEffect, useState } from "react";
import { IconArrowRight, IconSpeaker } from "@/components/icons";

/**
 * Un pas de predare. Conținutul e pregătit pe server; aici doar îl parcurgem.
 */
export type Slide =
  | { kind: "title"; titleRo: string; titleRu: string; objectives: string[] }
  | { kind: "theory"; heading: string; ro: string | null; ru: string | null }
  | { kind: "vocab"; heading: string; items: Array<{ ro: string; ru: string }> }
  | { kind: "examples"; heading: string; items: Array<{ ro: string; ru: string }> }
  | { kind: "audio"; heading: string; src: string; transcript: string | null }
  | {
      kind: "exercise";
      index: number;
      total: number;
      promptRu: string;
      options: string[];
      answer: string;
      explanationRu: string | null;
    };

/**
 * Prezentarea propriu-zisă.
 *
 * Navigarea din tastatură nu e un moft de accesibilitate: profesorul ține
 * mâinile pe tastatură și vorbește în același timp — să caute un buton cu
 * mouse-ul întrerupe lecția. Săgeți pentru pași, spațiu pentru răspuns, Esc
 * pentru ieșire.
 */
export function LivePresenter({
  slides,
  studentName,
  exitHref,
}: {
  slides: Slide[];
  studentName: string;
  exitHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const total = slides.length;
  const slide = slides[index];

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
      setRevealed(false);
    },
    [total],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === " ") {
        e.preventDefault();
        setRevealed((v) => !v);
      } else if (e.key === "Escape") {
        window.location.href = exitHref;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, exitHref]);

  if (!slide) return null;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Bara de sus rămâne discretă: spune unde ești, nu oferă unelte. */}
      <div className="flex items-center gap-4 px-6 py-3 text-sm text-ink-faint">
        <span>{studentName}</span>
        <span className="ml-auto tabular-nums">
          {index + 1} / {total}
        </span>
        <a href={exitHref} className="rounded-lg px-2 py-1 hover:bg-sunken hover:text-ink">
          Ieși (Esc)
        </a>
      </div>

      <div className="h-1 w-full bg-sunken">
        <div
          className="h-full bg-accent transition-[width] duration-300"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-8 py-10">
        {slide.kind === "title" ? (
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent">
              Lecție · A1
            </p>
            <h1 className="mt-3 text-5xl font-semibold leading-tight">{slide.titleRu}</h1>
            <p className="prose-lesson mt-3 text-2xl text-ink-soft">{slide.titleRo}</p>
            {slide.objectives.length > 0 ? (
              <ul className="mt-8 flex flex-col gap-2 text-xl">
                {slide.objectives.map((o) => (
                  <li key={o} className="flex gap-3">
                    <span aria-hidden className="mt-3 size-2 shrink-0 rounded-full bg-accent" />
                    {o}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {slide.kind === "theory" ? (
          <div>
            <h2 className="text-2xl font-semibold text-ink-soft">{slide.heading}</h2>
            {slide.ro ? (
              <p className="prose-lesson mt-6 whitespace-pre-line text-3xl leading-snug">
                {slide.ro}
              </p>
            ) : null}
            {slide.ru ? (
              <p className="mt-8 whitespace-pre-line border-l-4 border-accent pl-5 text-xl text-ink-soft">
                {slide.ru}
              </p>
            ) : null}
          </div>
        ) : null}

        {slide.kind === "vocab" || slide.kind === "examples" ? (
          <div>
            <h2 className="text-2xl font-semibold text-ink-soft">{slide.heading}</h2>
            <ul className="mt-8 flex flex-col gap-4">
              {slide.items.map((it) => (
                <li key={it.ro} className="flex flex-wrap items-baseline gap-6">
                  <span className="prose-lesson min-w-64 text-3xl font-medium">{it.ro}</span>
                  <span className="text-2xl text-ink-soft">{it.ru}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {slide.kind === "audio" ? (
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-semibold text-ink-soft">
              <IconSpeaker className="size-6" />
              {slide.heading}
            </h2>
            {/* Player nativ: în timpul lecției contează să pornească din prima,
                nu să arate ca restul aplicației. */}
            <audio src={slide.src} controls className="mt-8 w-full" />
            {slide.transcript ? (
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="min-h-11 rounded-lg border border-line-strong px-4 text-base hover:bg-sunken"
                >
                  {revealed ? "Ascunde textul" : "Arată textul (spațiu)"}
                </button>
                {revealed ? (
                  <p className="prose-lesson mt-5 whitespace-pre-line text-2xl">
                    {slide.transcript}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {slide.kind === "exercise" ? (
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Exercițiul {slide.index} din {slide.total}
            </p>
            <h2 className="mt-3 text-4xl font-semibold leading-snug">{slide.promptRu}</h2>

            {slide.options.length > 0 ? (
              <ul className="mt-8 flex flex-col gap-3 text-2xl">
                {slide.options.map((o) => (
                  <li key={o} className="rounded-lg border border-line bg-surface px-6 py-4">
                    {o}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-8">
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="min-h-11 rounded-lg border border-line-strong px-4 text-base hover:bg-sunken"
              >
                {revealed ? "Ascunde răspunsul" : "Arată răspunsul (spațiu)"}
              </button>
              {revealed ? (
                <div className="mt-5 rounded-lg border border-success bg-success-soft px-6 py-4">
                  <p className="prose-lesson text-2xl text-success">{slide.answer}</p>
                  {slide.explanationRu ? (
                    <p className="mt-2 text-lg text-ink-soft">{slide.explanationRu}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </main>

      <div className="flex items-center justify-between gap-4 px-6 py-4">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-line-strong px-5 text-base hover:bg-sunken disabled:opacity-30"
        >
          <IconArrowRight className="size-5 rotate-180" />
          Înapoi
        </button>
        <span className="text-sm text-ink-faint">← → pentru pași · spațiu pentru răspuns</span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === total - 1}
          className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-accent px-6 text-base font-medium text-white hover:bg-accent-hover disabled:opacity-30"
        >
          Înainte
          <IconArrowRight className="size-5" />
        </button>
      </div>
    </div>
  );
}
