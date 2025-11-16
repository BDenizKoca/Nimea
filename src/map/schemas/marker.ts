import { z } from 'zod'

// Zod schema for marker validation
export const MarkerSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  x: z.number(),
  y: z.number(),
  type: z.enum([
    'city',
    'town',
    'village',
    'fortress',
    'ruin',
    'landmark',
    'dungeon',
    'character',
    'other'
  ]),
  faction: z.string().max(200).optional(),
  summary: z.string().max(500).optional(),
  customIcon: z.string().max(10).optional(),
  iconUrl: z.string().url().optional(),
  wikiSlug: z.string().max(200).optional(),
  images: z.array(z.string()).optional(),
  public: z.boolean(),
  isPort: z.boolean().optional(),
  banner: z.string().url().optional(),
  i18n: z.object({
    tr: z.object({
      name: z.string().min(1).max(100),
      summary: z.string().max(500),
      faction: z.string().max(200).optional()
    }),
    en: z.object({
      name: z.string().min(1).max(100),
      summary: z.string().max(500),
      faction: z.string().max(200).optional()
    })
  }).optional()
})

export const MarkerArraySchema = z.array(MarkerSchema)

// Validate marker data
export function validateMarker(data: unknown) {
  return MarkerSchema.safeParse(data)
}

export function validateMarkers(data: unknown) {
  return MarkerArraySchema.safeParse(data)
}
