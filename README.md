# CompareIronSpecs

A simple, golf-themed website for comparing two iron sets head-to-head on loft, lie, offset, and length per club number.

Pick two irons via cascading **Maker -> Year -> Model** dropdowns and see their specs side by side, club by club, with the difference between them called out.

## Stack

- **Framework:** Next.js 16 (App Router) + TypeScript
- **Database:** Postgres (hosted on [Neon](https://neon.tech))
- **ORM:** [Prisma](https://www.prisma.io)
- **Styling:** Tailwind CSS v4
- **Hosting (planned):** Vercel + Neon, free tiers

## Getting started locally

### 1. Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically (via `postinstall`) to build the typed client.

### 2. Create a Neon Postgres database

1. Sign up at [console.neon.tech](https://console.neon.tech)
2. Create a project (any name; default region; default Postgres version)
3. Copy the **pooled** connection string from the connection panel (the hostname will contain `-pooler`)

### 3. Configure environment

```bash
cp .env.example .env
```

Then edit `.env` and paste in your Neon connection string:

```
DATABASE_URL="postgresql://neondb_owner:<password>@ep-<host>-pooler.<region>.aws.neon.tech/neondb?sslmode=require"
ADMIN_PASSWORD=
```

`.env` is gitignored.

### 4. Push the schema

```bash
npm run db:push
```

Creates the `manufacturers`, `iron_sets`, and `iron_set_specs` tables in your Neon database.

### 5. Add some iron data

See **Adding iron data** below. The DB starts empty; you populate it from local CSVs.

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding iron data

The catalog lives in three local CSVs in `data/` (gitignored — your local working copy is the input, the live Neon DB is the source of truth). To add or edit irons:

1. **Edit the CSVs** under `data/`:
   - `data/manufacturers.csv` — one row per maker
   - `data/iron-sets.csv` — one row per (maker, model, year)
   - `data/iron-set-specs.csv` — one row per (maker, model, year, club)
2. **Run the importer:** `npm run db:import`

The importer is idempotent: re-running with no CSV changes is a true no-op. Editing a value in a CSV updates the existing row. **Removing a row from a CSV does NOT delete the DB row** (additive only); use Drizzle Studio or a SQL one-off if you ever need to delete.

### CSV format

#### `data/manufacturers.csv`

```csv
name,slug
Titleist,titleist
Ping,ping
```

- `slug` is unique, lowercase letters / digits / hyphens. Other CSVs reference makers by `slug`.

#### `data/iron-sets.csv`

```csv
manufacturer_slug,model_name,release_year,source_url,notes
titleist,T100,2025,https://fairwayjockey.com/products/titleist-2025-t100-custom-irons,
```

- Natural unique key: `(manufacturer_slug, model_name, release_year)`.
- `manufacturer_slug` must exist in `manufacturers.csv`.
- `source_url` is required and must be `http(s)://...`.
- `notes` may be empty.

#### `data/iron-set-specs.csv`

```csv
manufacturer_slug,model_name,release_year,club,loft_deg,lie_deg,offset_mm,length_in
titleist,T100,2025,GW,49.0,64.0,,35.5
titleist,T100,2025,PW,45.0,64.0,,35.75
```

- Natural unique key: `(manufacturer_slug, model_name, release_year, club)`.
- `(manufacturer_slug, model_name, release_year)` must reference an iron set in `iron-sets.csv`.
- `club` must be one of: `1i, 2i, 3i, 4i, 5i, 6i, 7i, 8i, 9i, PW, GW, AW, SW, LW`.
- Any of `loft_deg`, `lie_deg`, `offset_mm`, `length_in` may be empty (manufacturers commonly omit offset).
- Sanity ranges enforced: loft 15-65, lie 55-70, offset -2..10, length 33..42.

## Available scripts

| Command              | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `npm run dev`        | Start the Next.js dev server                                          |
| `npm run build`      | Production build                                                      |
| `npm run start`      | Run the production build                                              |
| `npm run lint`       | Run ESLint                                                            |
| `npm run db:push`    | Sync the Prisma schema to your Neon database                          |
| `npm run db:generate`| Regenerate the Prisma client (also runs automatically on `npm install`) |
| `npm run db:import`  | Import `data/*.csv` into the database (additive, idempotent)          |

## Project layout

```
.
├── app/                      Next.js App Router routes (pages + API)
├── lib/
│   ├── db/
│   │   └── index.ts          Prisma client singleton
│   ├── iron-sets.ts          Server-only data helpers
│   └── format.ts             Spec formatting + delta calculation
├── prisma/
│   └── schema.prisma         Database schema
├── scripts/
│   └── import.ts             CSV importer (run via npm run db:import)
├── data/                     Local CSV input (gitignored)
├── .env.example              Template for required env vars
└── .env                      Local secrets (gitignored)
```

## Data model

Three tables:

- **`manufacturers`** — `(id, name, slug, created_at)`. Unique on name and slug.
- **`iron_sets`** — `(id, manufacturer_id, model_name, release_year, source_url, notes, created_at, updated_at)`. Unique on `(manufacturer_id, model_name, release_year)`.
- **`iron_set_specs`** — `(id, iron_set_id, club, loft_deg, lie_deg, offset_mm, length_in)`. Unique on `(iron_set_id, club)`. All four spec fields are nullable so missing data stores cleanly.

`club` is a `VARCHAR(4)` with allowed values `1i, 2i, 3i, 4i, 5i, 6i, 7i, 8i, 9i, PW, GW, AW, SW, LW` enforced by the importer.

## Roadmap

- [x] **Phase 1** — Schema + one seeded iron
- [x] **Phase 2** — Compare page UI (cascading dropdowns + per-club spec blocks)
- [x] **Phase 3** — CSV import pipeline (this PR)
- [ ] **Phase 4** — Populate the catalog across brands and years
- [ ] **Phase 5** — Deploy to Vercel + custom domain
