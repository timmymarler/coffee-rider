import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useGroups } from '../hooks/useGroups'
import { useMapData } from '../hooks/useMapData'
import { useSavedRoutes } from '../hooks/useSavedRoutes'

const CATEGORY_EMOJIS = {
  cafe: '☕',
  restaurant: '🍽️',
  pub: '🍺',
  bikes: '🚴',
  camping: '⛺',
  accommodation: '🏨',
  fuel: '⛽',
  parking: '🅿️',
  scenic: '🏞️',
}

const CATEGORY_ICONS = {
  cafe: 'coffee',
  restaurant: 'silverware-fork-knife',
  pub: 'beer',
  bikes: 'motorbike',
  camping: 'tent',
  accommodation: 'bed-outline',
  fuel: 'gas-station',
  parking: 'parking',
  scenic: 'forest',
}

// Create custom pin icon with category indicator
function createPinIcon(category = 'cafe', isSelected = false) {
  const pinColor = isSelected ? '#667eea' : '#8B6F47'
  const circleColor = '#ffffff'
  
  return L.divIcon({
    html: `
      <div style="position: relative; width: 36px; height: 36px;">
        <svg width="36" height="36" viewBox="0 0 24 24" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.2));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${pinColor}" stroke="${pinColor}" stroke-width="1.2"/>
          <circle cx="12" cy="9" r="6" fill="${circleColor}" opacity="0.9"/>
        </svg>
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-49%, -70%); font-size: 13px; line-height: 1; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
          ${CATEGORY_EMOJIS[category] || '📍'}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
    className: 'custom-pin'
  })
}

function decodePolyline(encoded) {
  const poly = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let result = 0, shift = 0, b
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1))
    lat += dlat
    result = 0
    shift = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1))
    lng += dlng
    poly.push([lat / 1e5, lng / 1e5])
  }
  return poly
}

// Fix Leaflet's default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

export default function Map() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [openPanel, setOpenPanel] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)
  const [selectedRoute, setSelectedRoute] = useState(null)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  const routeLinesRef = useRef([])

  const { places } = useMapData()
  const { routes } = useSavedRoutes()
  const { groups } = useGroups()

  useEffect(() => {
    if (!mapRef.current || mapInstance) return
    try {
      const map = L.map(mapRef.current).setView([52.1356, -0.4656], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19,
      }).addTo(map)
      setMapInstance(map)
      setTimeout(() => map.invalidateSize(), 200)
    } catch (err) {
      console.error(err)
    }
  }, [])

  useEffect(() => {
    if (mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(true), 200)
    }
  }, [openPanel, mapInstance])

  useEffect(() => {
    if (!mapInstance || !places?.length || selectedRoute) return
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    places.forEach(place => {
      const lat = place.latitude || place.lat
      const lng = place.longitude || place.lng
      if (lat && lng) {
        const isSelected = selectedPlace?.id === place.id
        const marker = L.marker([lat, lng], { 
          icon: createPinIcon(place.category, isSelected)
        }).addTo(mapInstance)
        
        // Click to select place
        marker.on('click', () => {
          setSelectedPlace(place)
        })
        
        markersRef.current.push({ marker, place })
      }
    })
  }, [mapInstance, places, selectedRoute, selectedPlace])

  useEffect(() => {
    if (!mapInstance || !routes?.length) return
    routeLinesRef.current.forEach(l => l.remove())
    routeLinesRef.current = []
    const colors = ['#FF1744', '#00BCD4', '#2196F3', '#FF6F00', '#00C853']
    
    // Only render selected route or none if nothing selected
    if (!selectedRoute) return
    
    const routeIdx = routes.findIndex(r => r.id === selectedRoute)
    if (routeIdx === -1) return
    
    const route = routes[routeIdx]
    const color = colors[routeIdx % colors.length]
    
    let coords = []
    if (route.routePolyline) coords = decodePolyline(route.routePolyline)
    if (!coords.length && route.waypoints?.length) {
      coords = route.waypoints.map(w => [w.latitude || w.lat, w.longitude || w.lng])
    }
    
    if (coords.length > 1) {
      const line = L.polyline(coords, { 
        color, 
        weight: 5, 
        opacity: 0.9
      }).addTo(mapInstance)
      line.bindPopup(`<strong>${route.name || 'Route'}</strong><br/>${route.waypoints?.length || 0} stops`)
      routeLinesRef.current.push(line)
      
      // Zoom to this route
      const bounds = L.latLngBounds()
      coords.forEach(c => bounds.extend(c))
      if (bounds.isValid()) {
        mapInstance.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
      }
    }
  }, [mapInstance, routes, selectedRoute])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {openPanel === 'routes' && (
        <div style={{ width: '300px', background: '#fff', borderRight: '1px solid #ddd', padding: '16px', overflowY: 'auto' }}>
          <h3>Routes ({routes.length})</h3>
          {routes.map((r, idx) => {
            const colors = ['#FF1744', '#00BCD4', '#2196F3', '#FF6F00', '#00C853']
            const color = colors[idx % colors.length]
            const isSelected = selectedRoute === r.id
            return (
              <div key={r.id} 
                onClick={() => setSelectedRoute(isSelected ? null : r.id)}
                style={{ 
                  padding: '8px', 
                  margin: '4px 0', 
                  border: isSelected ? `2px solid ${color}` : '1px solid #ddd', 
                  borderRadius: '4px', 
                  fontSize: '12px',
                  background: isSelected ? `${color}20` : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                <div style={{ width: '10px', height: '10px', background: color, borderRadius: '2px' }} />
                <div>
                  <strong>{r.name || 'Route'}</strong>
                  <div style={{ color: '#666' }}>{r.waypoints?.length || 0} stops</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {openPanel === 'groups' && (
        <div style={{ width: '300px', background: '#fff', borderRight: '1px solid #ddd', padding: '16px', overflowY: 'auto' }}>
          <h3>Groups ({groups.length})</h3>
          {groups.map(g => (
            <div key={g.id} style={{ padding: '8px', margin: '4px 0', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }}>
              <strong>{g.name}</strong>
              <div>{g.memberCount || 0} members</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px', background: '#fff', borderBottom: '1px solid #ddd', display: 'flex', gap: '8px', alignItems: 'center', zIndex: 100 }}>
          <button onClick={() => setOpenPanel(openPanel === 'filters' ? null : 'filters')} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>⚙️ Filters</button>
          <h1 style={{ flex: 1, textAlign: 'center', margin: 0 }}>Coffee Rider</h1>
          <button onClick={() => setOpenPanel(openPanel === 'routes' ? null : 'routes')} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>🛣️ Routes ({routes.length})</button>
          <button onClick={() => setOpenPanel(openPanel === 'groups' ? null : 'groups')} style={{ padding: '8px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>👥 Groups ({groups.length})</button>
          <button onClick={handleLogout} style={{ padding: '8px 12px', background: '#667eea', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
        </div>
        <div ref={mapRef} style={{ flex: 1, background: '#e8e8e8', position: 'relative' }} />

        {/* Place Card */}
        {selectedPlace && (
          <div style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            background: '#fff',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            width: '280px',
            maxHeight: '320px',
            zIndex: 20,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px' }}>
                {CATEGORY_EMOJIS[selectedPlace.category] || '📍'}
              </h3>
              <button onClick={() => setSelectedPlace(null)} style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '0'
              }}>✕</button>
            </div>
            
            <div style={{ padding: '10px', overflowY: 'auto', flex: 1, fontSize: '11px' }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 'bold' }}>
                {selectedPlace.title || selectedPlace.name}
              </p>
              
              {selectedPlace.address && (
                <p style={{ margin: '0 0 4px 0', color: '#666' }}>
                  {selectedPlace.address}
                </p>
              )}
              
              {selectedPlace.amenities && selectedPlace.amenities.length > 0 && (
                <p style={{ margin: '0 0 4px 0' }}>
                  <strong>Amenities:</strong> {selectedPlace.amenities.slice(0, 2).join(', ')}
                </p>
              )}
              
              {selectedPlace.rating && (
                <p style={{ margin: '0 0 4px 0' }}>
                  ⭐ {selectedPlace.rating}/5
                </p>
              )}
              
              {selectedPlace.type && (
                <p style={{ margin: '0 0 6px 0' }}>
                  <strong>Type:</strong> {selectedPlace.type}
                </p>
              )}
              
              <button style={{
                width: '100%',
                padding: '6px',
                background: '#667eea',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold'
              }}>Start Route</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
