# CompareIronSpecs

A simple, golf-themed website for comparing two iron sets head-to-head on loft, lie, offset, and length per club number.

Pick two irons via cascading **Maker -> Year -> Model** dropdowns and see their specs side by side, club by club, with the difference between them called out.

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** Postgres (hosted on [Neon](https://neon.tech))
- **ORM:** [Drizzle](https://orm.drizzle.team)
- **Styling:** Tailwind CSS v4
- **Hosting (planned):** Vercel + Neon, free tiers

## Getting started locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Neon Postgres database

1. Sign up at [console.neon.tech](https://console.neon.tech)
2. Create a project (any name; default region; default Postgres version)
3. Copy the **pooled** connection string from the connection panel (the hostname will contain `-pooler`)

### 3. Configure environment

Copy the example file and paste in your Neon connection string:

```bash
cp .env.example .env
```

Then edit `.env`:

```
DATABASE_URL="postgresql://neondb_owner:<password>@ep-<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require"
ADMIN_PASSWORD=
```

`.env` is gitignored. Leave `ADMIN_PASSWORD` blank until Phase 3 (admin UI).

### 4. Push the schema

```bash
npm run db:push
```

This creates the `manufacturers`, `iron_sets`, and `iron_set_specs` tables plus the `club_number` Postgres enum in your Neon database. Confirm with `y` when prompted.

### 5. Seed one iron

```bash
npm run db:seed
```

Inserts Titleist + the 2025 Titleist T100 (specs sourced from [Fairway Jockey](https://fairwayjockey.com/products/titleist-2025-t100-custom-irons)) and reads the data back to verify the database is wired correctly.

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available scripts

| Command              | What it does                                                      |
| -------------------- | ----------------------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                                      |
| `npm run build`      | Production build                                                  |
| `npm run start`      | Run the production build                                          |
| `npm run lint`       | Run ESLint                                                        |
| `npm run db:push`    | Sync the Drizzle schema to your Neon database                     |
| `npm run db:generate`| Generate SQL migration files (alternative to `db:push`)           |
| `npm run db:studio`  | Open Drizzle Studio (visual DB browser) on `localhost`            |
| `npm run db:seed`    | Run [scripts/seed.ts](scripts/seed.ts) to insert one iron set     |

## Project layout

```
.
├── app/                      Next.js App Router routes (pages + API)
├── lib/
│   └── db/
│       ├── index.ts          Drizzle client wired to Neon
│       └── schema.ts         Tables, enums, relations
├── scripts/
│   └── seed.ts               One-shot seed script (idempotent)
├── drizzle.config.ts         Drizzle Kit config
├── .env.example              Template for required env vars
└── .env                      Local secrets (gitignored)
```

## Data model

Three tables:

- **`manufacturers`** — `(id, name, slug, created_at)`. Unique on name and slug.
- **`iron_sets`** — `(id, manufacturer_id, model_name, release_year, source_url, notes, created_at, updated_at)`. Unique on `(manufacturer_id, model_name, release_year)`.
- **`iron_set_specs`** — `(id, iron_set_id, club, loft_deg, lie_deg, offset_mm, length_in)`. Unique on `(iron_set_id, club)`. All four spec fields are nullable so missing data stores cleanly.

The `club` column uses a Postgres enum: `1i, 2i, 3i, 4i, 5i, 6i, 7i, 8i, 9i, PW, GW, AW, SW, LW`.

## Roadmap

- [x] **Phase 1** — Schema + one seeded iron
- [ ] **Phase 2** — Compare page UI (cascading dropdowns + per-club spec blocks)
- [ ] **Phase 3** — Password-gated admin UI for data entry
- [ ] **Phase 4** — Bulk data entry across brands and years
- [ ] **Phase 5** — Deploy to Vercel + custom domain
