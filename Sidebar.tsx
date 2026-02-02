import React from 'react';

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="dropdown-section">
        <h2>Saved Routes</h2>
        <ul>
          <li>Route 1</li>
          <li>Route 2</li>
        </ul>
      </div>

      <div className="dropdown-section">
        <h2>Events</h2>
        <button className="dropdown-toggle">
          Events
        </button>
        <div className="dropdown-content">
          <span className="placeholder">No Events Planned</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;