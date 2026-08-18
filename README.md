# Liro

Platformă de învățare a limbii române pentru vorbitori de rusă, predare 1-la-1.
Specificația de produs: [brief-aplicatie-romana-pentru-rusofoni.md](./brief-aplicatie-romana-pentru-rusofoni.md).

Profesorul lucrează în română, cursantul în rusă. Conținutul este blocat implicit
și se deblochează individual, lecție cu lecție.

## Stack

Next.js 15 (App Router) · TypeScript strict · Postgres (Neon) + Drizzle ·
Auth.js v5 · Tailwind + shadcn/ui · next-intl · Vitest + Playwright · Claude API

## Cerințe

- **Node.js ≥ 20.11** și **pnpm 9** (`corepack enable pnpm`)
- Postgres — vezi mai jos; nu ai nevoie de Docker

## Pornire

```bash
pnpm install
cp .env.example .env.local        # completează AUTH_SECRET (openssl rand -base64 32)
pnpm db:local start               # Postgres local pe portul 5433
pnpm db:migrate
pnpm db:seed                      # 1 profesor, 3 cursanți, un modul A1 complet
pnpm dev
```

### Baza de date locală

`pnpm db:local` pornește un Postgres 18 din binarele arm64 aduse de pachetul
`embedded-postgres` — fără Docker, fără `sudo`, fără instalare în sistem. Datele
stau în `.tools/pgdata`, care e gitignorat.

| Comandă | Ce face |
|---|---|
| `pnpm db:local start` | Inițializează la prima rulare și pornește serverul |
| `pnpm db:local stop` | Oprește serverul |
| `pnpm db:local status` | Spune dacă rulează |
| `pnpm db:local reset` | Șterge datele și repornește de la zero |
| `pnpm db:local tables` | Listează tabelele |
| `pnpm db:local sql "<query>"` | Rulează o interogare |

Pentru producție, `DATABASE_URL` indică spre Neon; nimic din cod nu depinde de
baza locală.

## Comenzi

| Comandă | Ce face |
|---|---|
| `pnpm dev` | Server de dezvoltare |
| `pnpm typecheck` | TypeScript, fără emit |
| `pnpm test` | Toate testele Vitest |
| `pnpm test:unit` | Doar unitare (corectare, autorizare, progres) |
| `pnpm test:integration` | Autorizare la nivel de query, pe Postgres real |
| `pnpm test:e2e` | Playwright, desktop + mobil, inclusiv verificări axe |
| `pnpm eval` | Evaluează agenții de conținut pe setul din `evals/` |
| `pnpm db:generate` | Generează migrare din `src/db/schema.ts` |
| `pnpm db:studio` | Inspectează baza |

## Structură

```
src/db/schema.ts        modelul de date; sursa de adevăr, migrările se generează din el
src/lib/authz.ts        SINGURUL loc unde se decide accesul
src/lib/grading/        corectare automată deterministă (normalizare + punctaj)
src/lib/ai/agents/      cei 6 agenți AI din produs (etapa 4)
src/app/(teacher)/      interfața profesorului, în română
src/app/(student)/      interfața cursantului, în rusă
tests/unit              logică pură
tests/integration       autorizare pe bază de date reală, fără mock-uri
tests/e2e               fluxurile din brief §6, cap-coadă
evals/                  set fix de cazuri pentru agenții de conținut
.claude/agents/         subagenții care construiesc și verifică aplicația
```

## Trei invarianți

Sunt aplicați în schemă, în `authz.ts` și verificați de teste. Orice cod care îi
încalcă e defect, nu compromis:

1. **Versionare imuabilă** — rezultatele unui cursant se leagă de
   `lesson_version_id`. Republicarea unei lecții nu schimbă retroactiv ce a
   parcurs cineva.
2. **Blocat implicit** — cursantul ajunge la conținut exclusiv prin
   `assignments`. Nicio interogare din spațiul lui nu pornește din `lessons`.
3. **Profesorul are ultimul cuvânt** — `teacher_score` bate `auto_score` peste
   tot, inclusiv când profesorul pune zero. Corectarea automată produce
   recomandări, nu verdicte.

Un al patrulea, pe conținut: **nimic generat de AI nu ajunge la cursant fără
aprobare umană** (`lesson_versions.approvedBy`).

## Cum se lucrează

Fiecare feature trece prin lanțul `test-author` → `feature-dev` →
`security-reviewer`. Testele se scriu înaintea implementării și nu se modifică
pentru a face codul să treacă — dacă un test contrazice un invariant, se
corectează testul în amonte, explicit.

`ru-linguist` este gate obligatoriu pe orice modificare de text vizibil
cursantului. `a11y-reviewer` rulează pe orice modificare de UI.

Definițiile agenților sunt în [.claude/agents/](./.claude/agents/).
