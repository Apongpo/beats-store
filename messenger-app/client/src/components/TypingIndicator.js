import React from 'react';

const TypingIndicator = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  const renderTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].username} is typing...`;
    } else if (typingUsers.length === 2) {
      return `${typingUsers[0].username} and ${typingUsers[1].username} are typing...`;
    } else if (typingUsers.length === 3) {
      return `${typingUsers[0].username}, ${typingUsers[1].username}, and ${typingUsers[2].username} are typing...`;
    } else {
      return `${typingUsers.length} people are typing...`;
    }
  };

  return (
    <div className="typing-indicator">
      <div className="typing-content">
        <div className="typing-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        <span className="typing-text">
          {renderTypingText()}
        </span>
      </div>
    </div>
  );
};

export default TypingIndicator;
