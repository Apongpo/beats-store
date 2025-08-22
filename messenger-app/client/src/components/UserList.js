import React from 'react';
import { Users, Crown } from 'lucide-react';

const UserList = ({ users, currentUser }) => {
  const formatJoinTime = (joinedAt) => {
    const date = new Date(joinedAt);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just joined';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const sortedUsers = users.sort((a, b) => {
    // Current user first, then alphabetically
    if (a.id === currentUser?.id) return -1;
    if (b.id === currentUser?.id) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="user-list">
      <div className="user-list-header">
        <div className="user-list-title">
          <Users size={18} />
          <span>Online Users ({users.length})</span>
        </div>
      </div>
      
      <div className="user-list-content">
        {sortedUsers.length === 0 ? (
          <div className="empty-user-list">
            <div className="empty-user-icon">👥</div>
            <p>No users online</p>
          </div>
        ) : (
          <div className="users">
            {sortedUsers.map((user) => (
              <div 
                key={user.id} 
                className={`user-item ${user.id === currentUser?.id ? 'current-user' : ''}`}
              >
                <div className="user-info">
                  <div className="user-avatar-container">
                    <img 
                      src={user.avatar} 
                      alt={user.username}
                      className="user-avatar"
                    />
                    <div className="user-status online"></div>
                  </div>
                  
                  <div className="user-details">
                    <div className="user-name">
                      {user.username}
                      {user.id === currentUser?.id && (
                        <Crown size={14} className="current-user-icon" title="You" />
                      )}
                    </div>
                    <div className="user-joined">
                      {formatJoinTime(user.joinedAt)}
                    </div>
                  </div>
                </div>
                
                {user.isTyping && (
                  <div className="user-typing-indicator">
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="user-list-footer">
        <div className="user-list-stats">
          <div className="stat">
            <span className="stat-value">{users.length}</span>
            <span className="stat-label">online</span>
          </div>
          <div className="stat">
            <span className="stat-value">🟢</span>
            <span className="stat-label">connected</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserList;
