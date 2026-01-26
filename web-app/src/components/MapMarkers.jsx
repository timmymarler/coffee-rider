import mapboxgl from 'mapbox-gl'
import { useEffect } from 'react'

export default function MapMarkers({ map, places, onMarkerClick }) {
  useEffect(() => {
    if (!map || !places) return

    // Remove existing markers
    const markers = document.querySelectorAll('.mapboxgl-marker')
    markers.forEach(marker => marker.remove())

    // Add new markers
    places.forEach(place => {
      if (!place.latitude || !place.longitude) return

      const el = document.createElement('div')
      el.className = 'marker'
      el.style.backgroundImage = 'url(/marker.png)'
      el.style.width = '32px'
      el.style.height = '32px'
      el.style.backgroundSize = 'contain'
      el.style.cursor = 'pointer'

      const marker = new mapboxgl.Marker(el)
        .setLngLat([place.longitude, place.latitude])
        .addTo(map)

      el.addEventListener('click', () => {
        if (onMarkerClick) onMarkerClick(place)
      })
    })
  }, [map, places])

  return null
}
