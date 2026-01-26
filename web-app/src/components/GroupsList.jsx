import '../styles/GroupsList.css'

export default function GroupsList({ groups, isOpen, onClose, onSelectGroup }) {
  return (
    <div className={`groups-panel ${isOpen ? 'open' : ''}`}>
      <div className="panel-header">
        <h3>Groups</h3>
        <button onClick={onClose} className="close-btn">✕</button>
      </div>

      <div className="groups-list">
        {groups.length === 0 ? (
          <p className="empty-message">No groups yet</p>
        ) : (
          groups.map(group => (
            <div
              key={group.id}
              className="group-item"
              onClick={() => onSelectGroup(group)}
            >
              <div className="group-info">
                <h4>{group.name}</h4>
                <p className="group-members">
                  {group.members?.length || 0} members
                </p>
              </div>
              <div className="group-avatar">
                {group.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
