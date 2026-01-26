import { useState } from 'react'
import '../styles/PlaceCard.css'

export default function PlaceCard({ place, onClose, onRoute, onNavigate }) {
  const [isLoading, setIsLoading] = useState(false)

  const handleRoute = async () => {
    setIsLoading(true)
    try {
      await onRoute(place)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNavigate = () => {
    onNavigate(place)
  }

  return (
    <div className="place-card">
      <div className="place-header">
        <h3>{place.title || place.name}</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      {place.photos && place.photos.length > 0 && (
        <div className="place-photos">
          <img src={place.photos[0]} alt={place.title} />
        </div>
      )}

      <div className="place-content">
        <p className="address">{place.address || place.vicinity}</p>

        {place.rating && (
          <div className="rating">
            <span className="stars">{'⭐'.repeat(Math.floor(place.rating))}</span>
            <span className="value">{place.rating.toFixed(1)}</span>
            {place.userRatingsTotal && (
              <span className="count">({place.userRatingsTotal})</span>
            )}
          </div>
        )}

        {place.amenities && Object.keys(place.amenities).length > 0 && (
          <div className="amenities">
            {place.amenities.parking && <span>🅿️</span>}
            {place.amenities.evCharger && <span>⚡</span>}
            {place.amenities.toilets && <span>🚻</span>}
            {place.amenities.petFriendly && <span>🐾</span>}
            {place.amenities.disabledAccess && <span>♿</span>}
            {place.amenities.outdoorSeating && <span>🪑</span>}
          </div>
        )}

        <div className="place-actions">
          <button onClick={handleRoute} disabled={isLoading} className="btn btn-primary">
            {isLoading ? 'Loading...' : 'Route'}
          </button>
          <button onClick={handleNavigate} className="btn btn-secondary">
            Navigate
          </button>
        </div>
      </div>
    </div>
  )
}
