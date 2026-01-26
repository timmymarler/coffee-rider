import '../styles/SavedRoutesList.css'

export default function SavedRoutesList({ routes, onSelectRoute, onDeleteRoute, isOpen, onClose }) {
  return (
    <div className={`saved-routes-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <h3>Saved Routes</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="routes-list">
        {routes.length === 0 ? (
          <p className="empty-message">No saved routes yet</p>
        ) : (
          routes.map(route => (
            <div key={route.id} className="route-item">
              <div className="route-info">
                <h4>{route.name || 'Untitled Route'}</h4>
                <p className="route-stops">
                  {route.waypoints?.length || 0} stops
                </p>
                {route.distance && (
                  <p className="route-distance">{(route.distance / 1000).toFixed(1)} km</p>
                )}
              </div>
              <div className="route-actions">
                <button
                  onClick={() => onSelectRoute(route)}
                  className="btn btn-small btn-primary"
                >
                  View
                </button>
                <button
                  onClick={() => onDeleteRoute(route.id)}
                  className="btn btn-small btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
