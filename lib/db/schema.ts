import {
  pgTable,
  serial,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Club number enum: covers 1-iron through every wedge any manufacturer publishes.
// Order in this list is meaningful for display (long iron -> wedge), but display
// order on the compare page is "short to long" (PW first, then 9i .. 3i, with
// wedges above PW). The UI handles ordering; the DB just stores the value.
export const clubNumberEnum = pgEnum("club_number", [
  "1i",
  "2i",
  "3i",
  "4i",
  "5i",
  "6i",
  "7i",
  "8i",
  "9i",
  "PW",
  "GW",
  "AW",
  "SW",
  "LW",
]);

export type ClubNumber = (typeof clubNumberEnum.enumValues)[number];

export const manufacturers = pgTable(
  "manufacturers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("manufacturers_name_unique").on(t.name),
    uniqueIndex("manufacturers_slug_unique").on(t.slug),
  ],
);

export const ironSets = pgTable(
  "iron_sets",
  {
    id: serial("id").primaryKey(),
    manufacturerId: integer("manufacturer_id")
      .notNull()
      .references(() => manufacturers.id, { onDelete: "restrict" }),
    modelName: varchar("model_name", { length: 128 }).notNull(),
    releaseYear: integer("release_year").notNull(),
    standardShaftLabel: varchar("standard_shaft_label", { length: 256 }),
    sourceUrl: text("source_url").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("iron_sets_mfr_model_year_unique").on(
      t.manufacturerId,
      t.modelName,
      t.releaseYear,
    ),
  ],
);

// All four spec fields are nullable: real-world spec sheets routinely omit
// one or more of loft / lie / offset / length. The compare page renders a
// dash for null values rather than failing.
//
// Numeric precisions chosen for the granularity manufacturers actually publish:
//   loft_deg:    NN.N  (e.g. 21.0, 21.5)
//   lie_deg:     NN.N  (e.g. 60.5)
//   offset_mm:   N.NN  (e.g. 3.50, 4.20)
//   length_in:   NN.NNN (e.g. 39.000, 38.875, 38.750 — 1/8" increments)
export const ironSetSpecs = pgTable(
  "iron_set_specs",
  {
    id: serial("id").primaryKey(),
    ironSetId: integer("iron_set_id")
      .notNull()
      .references(() => ironSets.id, { onDelete: "cascade" }),
    club: clubNumberEnum("club").notNull(),
    loftDeg: numeric("loft_deg", { precision: 4, scale: 1 }),
    lieDeg: numeric("lie_deg", { precision: 4, scale: 1 }),
    offsetMm: numeric("offset_mm", { precision: 4, scale: 2 }),
    lengthIn: numeric("length_in", { precision: 5, scale: 3 }),
  },
  (t) => [
    uniqueIndex("iron_set_specs_set_club_unique").on(t.ironSetId, t.club),
  ],
);

export const manufacturersRelations = relations(manufacturers, ({ many }) => ({
  ironSets: many(ironSets),
}));

export const ironSetsRelations = relations(ironSets, ({ one, many }) => ({
  manufacturer: one(manufacturers, {
    fields: [ironSets.manufacturerId],
    references: [manufacturers.id],
  }),
  specs: many(ironSetSpecs),
}));

export const ironSetSpecsRelations = relations(ironSetSpecs, ({ one }) => ({
  ironSet: one(ironSets, {
    fields: [ironSetSpecs.ironSetId],
    references: [ironSets.id],
  }),
}));

export type Manufacturer = typeof manufacturers.$inferSelect;
export type NewManufacturer = typeof manufacturers.$inferInsert;
export type IronSet = typeof ironSets.$inferSelect;
export type NewIronSet = typeof ironSets.$inferInsert;
export type IronSetSpec = typeof ironSetSpecs.$inferSelect;
export type NewIronSetSpec = typeof ironSetSpecs.$inferInsert;

// Useful for routes that need to keep updated_at fresh on iron_sets.
export const ironSetsTouchUpdatedAt = sql`now()`;
