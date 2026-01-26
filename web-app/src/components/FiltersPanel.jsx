import { useState } from 'react'
import '../styles/FiltersPanel.css'

const AMENITIES = {
  parking: '🅿️ Parking',
  evCharger: '⚡ EV Charger',
  toilets: '🚻 Toilets',
  petFriendly: '🐾 Pet Friendly',
  disabledAccess: '♿ Disabled Access',
  outdoorSeating: '🪑 Outdoor Seating'
}

const CATEGORIES = {
  espresso: 'Espresso Bar',
  pourover: 'Pour Over',
  cold_brew: 'Cold Brew',
  latte: 'Latte',
  cappuccino: 'Cappuccino'
}

export default function FiltersPanel({ onFiltersChange, isOpen, onClose }) {
  const [selectedAmenities, setSelectedAmenities] = useState({})
  const [selectedCategories, setSelectedCategories] = useState({})
  const [minRating, setMinRating] = useState(0)

  const handleAmenityToggle = (key) => {
    const newAmenities = {
      ...selectedAmenities,
      [key]: !selectedAmenities[key]
    }
    setSelectedAmenities(newAmenities)
    onFiltersChange({ amenities: newAmenities, categories: selectedCategories, minRating })
  }

  const handleCategoryToggle = (key) => {
    const newCategories = {
      ...selectedCategories,
      [key]: !selectedCategories[key]
    }
    setSelectedCategories(newCategories)
    onFiltersChange({ amenities: selectedAmenities, categories: newCategories, minRating })
  }

  const handleRatingChange = (e) => {
    const rating = parseFloat(e.target.value)
    setMinRating(rating)
    onFiltersChange({ amenities: selectedAmenities, categories: selectedCategories, minRating: rating })
  }

  const handleReset = () => {
    setSelectedAmenities({})
    setSelectedCategories({})
    setMinRating(0)
    onFiltersChange({ amenities: {}, categories: {}, minRating: 0 })
  }

  return (
    <div className={`filters-panel ${isOpen ? 'open' : ''}`}>
      <div className="filters-header">
        <h3>Filters</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="filters-content">
        <div className="filter-section">
          <h4>Amenities</h4>
          <div className="filter-options">
            {Object.entries(AMENITIES).map(([key, label]) => (
              <label key={key} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedAmenities[key] || false}
                  onChange={() => handleAmenityToggle(key)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h4>Categories</h4>
          <div className="filter-options">
            {Object.entries(CATEGORIES).map(([key, label]) => (
              <label key={key} className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={selectedCategories[key] || false}
                  onChange={() => handleCategoryToggle(key)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <h4>Minimum Rating</h4>
          <div className="rating-slider">
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={minRating}
              onChange={handleRatingChange}
            />
            <span className="rating-value">{minRating.toFixed(1)} ⭐</span>
          </div>
        </div>

        <button onClick={handleReset} className="reset-btn">Reset Filters</button>
      </div>
    </div>
  )
}
