import { z } from 'zod'

// Zod schema for terrain validation
export const TerrainFeatureSchema = z.object({
  type: z.literal('Feature'),
  properties: z.object({
    kind: z.enum([
      'road',
      'normal',
      'forest',
      'medium',
      'difficult',
      'water',
      'sea',
      'unpassable',
      'blocked'
    ]),
    _internal_id: z.string()
  }),
  geometry: z.any() // GeoJSON geometry - too complex to validate deeply
})

export const TerrainCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(TerrainFeatureSchema)
})

// Validate terrain data
export function validateTerrainFeature(data: unknown) {
  return TerrainFeatureSchema.safeParse(data)
}

export function validateTerrainCollection(data: unknown) {
  return TerrainCollectionSchema.safeParse(data)
}
