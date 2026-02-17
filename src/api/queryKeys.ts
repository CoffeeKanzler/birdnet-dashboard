export const queryKeys = {
  summary: {
    thirtyDays: () => ['birdnet', 'summary', '30d'] as const,
  },
  detections: {
    today: (limit?: number) => ['birdnet', 'detections', 'today', limit] as const,
    recent: (limit?: number) => ['birdnet', 'detections', 'recent', limit] as const,
    page: (limit?: number) => ['birdnet', 'detections', 'page', limit] as const,
    range: (start: string, end: string, mode: string, maxDetections?: number) =>
      ['birdnet', 'detections', 'range', start, end, mode, maxDetections ?? 0] as const,
    species: (scientificName: string) =>
      ['birdnet', 'detections', 'species', scientificName] as const,
  },
  speciesInfo: (scientificName: string) =>
    ['birdnet', 'species-info', scientificName] as const,
  speciesPhoto: (common: string, scientific: string) =>
    ['birdnet', 'species-photo', common, scientific] as const,
  familyMatches: (familyKey: string) =>
    ['birdnet', 'family-matches', familyKey] as const,
}
