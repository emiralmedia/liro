import { asc, eq } from "drizzle-orm";
import { Badge, EmptyState, PageHeading } from "@/components/ui";
import { db } from "@/db";
import { exercises, lessonVersions, lessons, modules, sections } from "@/db/schema";
import { assertRole } from "@/lib/authz";
import { getActor } from "@/lib/session";

/**
 * Biblioteca curriculară (brief §5): profesorul găsește conținutul după nivel
 * și temă, și vede dintr-o privire ce e publicat și ce nu.
 */
export default async function Library() {
  const actor = await getActor();
  assertRole(actor, "teacher", "admin");

  const rows = await db
    .select({
      moduleId: modules.id,
      level: modules.level,
      moduleTitleRo: modules.titleRo,
      moduleTitleRu: modules.titleRu,
      moduleOrder: modules.orderIndex,
      lessonId: lessons.id,
      lessonOrder: lessons.orderIndex,
      versionId: lessonVersions.id,
      versionNumber: lessonVersions.version,
      titleRo: lessonVersions.titleRo,
      titleRu: lessonVersions.titleRu,
      status: lessonVersions.status,
      origin: lessonVersions.origin,
      approvedBy: lessonVersions.approvedBy,
      minutes: lessonVersions.estimatedMinutes,
    })
    .from(modules)
    .innerJoin(lessons, eq(lessons.moduleId, modules.id))
    .innerJoin(lessonVersions, eq(lessonVersions.lessonId, lessons.id))
    .orderBy(asc(modules.orderIndex), asc(lessons.orderIndex), asc(lessonVersions.version));

  const counts = await db
    .select({ versionId: sections.lessonVersionId, exerciseId: exercises.id })
    .from(sections)
    .leftJoin(exercises, eq(exercises.sectionId, sections.id));

  const exercisesPerVersion = new Map<string, number>();
  for (const c of counts) {
    if (!c.exerciseId) continue;
    exercisesPerVersion.set(c.versionId, (exercisesPerVersion.get(c.versionId) ?? 0) + 1);
  }

  const byModule = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byModule.get(r.moduleId) ?? [];
    list.push(r);
    byModule.set(r.moduleId, list);
  }

  return (
    <>
      <PageHeading
        title="Bibliotecă"
        subtitle={`${byModule.size} module · ${rows.length} versiuni de lecție`}
      />

      <div className="mt-7 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-2 shadow-card">
        {(["Toate", "A1", "A2", "B1"] as const).map((level, index) => (
          <span key={level} className={`inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-medium ${index === 0 ? "bg-accent text-white" : "text-ink-soft"}`}>{level}</span>
        ))}
        <span className="ml-auto hidden text-sm text-ink-faint sm:block">Curriculum română pentru rusofoni</span>
      </div>

      {rows.length === 0 ? (
        <div className="mt-8">
          <EmptyState>Biblioteca este goală.</EmptyState>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {[...byModule.values()].map((group) => {
            const head = group[0]!;
            return (
              <section key={head.moduleId} aria-labelledby={`m-${head.moduleId}`}>
                <div className="flex items-baseline gap-3">
                  <Badge tone="accent">{head.level}</Badge>
                  <h2 id={`m-${head.moduleId}`} className="text-lg font-semibold">
                    {head.moduleTitleRo}
                  </h2>
                  <span className="text-sm text-ink-faint">{head.moduleTitleRu}</span>
                </div>

                <div className="mt-4">
                  <ul className="grid gap-4 md:grid-cols-2">
                    {group.map((l) => (
                      <li key={l.versionId} className="group rounded-card border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-accent-soft font-reading text-lg font-semibold text-accent">{l.lessonOrder}</span>
                          <span className="flex items-center gap-2">
                          {l.origin !== "human" ? (
                            <Badge tone={l.approvedBy ? "success" : "warning"}>
                              {l.approvedBy ? "AI, validat" : "AI, nevalidat"}
                            </Badge>
                          ) : null}
                          <Badge tone={l.status === "published" ? "success" : "neutral"}>
                            {l.status === "published" ? "publicată" : l.status}
                          </Badge>
                          </span>
                        </div>
                        <h3 className="mt-5 text-lg font-semibold">{l.titleRo}</h3>
                        <p className="mt-1 text-sm text-ink-soft">{l.titleRu}</p>
                        <div className="mt-5 flex items-center gap-3 border-t border-line pt-4 text-xs text-ink-faint">
                          <span>{exercisesPerVersion.get(l.versionId) ?? 0} exerciții</span>
                          <span>·</span><span>{l.minutes} min</span><span>·</span><span>v{l.versionNumber}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
