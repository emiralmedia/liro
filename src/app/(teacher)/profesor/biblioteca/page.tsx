import { asc, eq } from "drizzle-orm";
import { Badge, Card, EmptyState, PageHeading } from "@/components/ui";
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

                <Card className="mt-3 overflow-hidden">
                  <ul className="divide-y divide-line">
                    {group.map((l) => (
                      <li key={l.versionId} className="flex flex-wrap items-center gap-3 px-5 py-4">
                        <span className="font-medium">{l.titleRo}</span>
                        <span className="text-sm text-ink-soft">{l.titleRu}</span>
                        <span className="text-sm text-ink-faint">
                          v{l.versionNumber} · {exercisesPerVersion.get(l.versionId) ?? 0} exerciții
                          · {l.minutes} min
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          {l.origin !== "human" ? (
                            <Badge tone={l.approvedBy ? "success" : "warning"}>
                              {l.approvedBy ? "AI, validat" : "AI, nevalidat"}
                            </Badge>
                          ) : null}
                          <Badge tone={l.status === "published" ? "success" : "neutral"}>
                            {l.status === "published" ? "publicată" : l.status}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
