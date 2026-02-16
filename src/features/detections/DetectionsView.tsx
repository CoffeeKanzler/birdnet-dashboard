import { useRef } from 'react'

import ArchiveView from './ArchiveView'
import TodayView from './TodayView'
import { useDetections } from './useDetections'

type DetectionsViewProps = {
  view: 'today' | 'archive'
  onSpeciesSelect?: (species: {
    commonName: string
    scientificName: string
  }) => void
  onAttributionOpen?: () => void
}

type TodayDetectionsProps = {
  onSpeciesSelect?: (species: {
    commonName: string
    scientificName: string
  }) => void
  onAttributionOpen?: () => void
}

const TodayDetections = ({ onSpeciesSelect, onAttributionOpen }: TodayDetectionsProps) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { detections, isLoading, error, lastUpdated, refresh } = useDetections()

  return (
    <TodayView
      detections={detections}
      error={error}
      isLoading={isLoading}
      lastUpdated={lastUpdated}
      onAttributionOpen={onAttributionOpen}
      onSpeciesSelect={onSpeciesSelect}
      refresh={refresh}
      scrollContainerRef={scrollContainerRef}
    />
  )
}

const DetectionsView = ({ view, onSpeciesSelect, onAttributionOpen }: DetectionsViewProps) => {
  if (view === 'archive') {
    return (
      <ArchiveView
        onAttributionOpen={onAttributionOpen}
        onSpeciesSelect={onSpeciesSelect}
      />
    )
  }

  return (
    <TodayDetections
      onAttributionOpen={onAttributionOpen}
      onSpeciesSelect={onSpeciesSelect}
    />
  )
}

export default DetectionsView
