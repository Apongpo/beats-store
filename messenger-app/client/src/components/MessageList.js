import React, { useEffect, useRef } from 'react';

const MessageList = ({ messages, currentUser }) => {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const isOwnMessage = (message) => {
    return message.user.id === currentUser?.id;
  };

  const shouldShowAvatar = (message, index) => {
    if (index === 0) return true;
    
    const prevMessage = messages[index - 1];
    return prevMessage.user.id !== message.user.id;
  };

  const shouldShowUsername = (message, index) => {
    if (isOwnMessage(message)) return false;
    if (index === 0) return true;
    
    const prevMessage = messages[index - 1];
    return prevMessage.user.id !== message.user.id;
  };

  if (messages.length === 0) {
    return (
      <div className="messages-container" ref={messagesContainerRef}>
        <div className="empty-messages">
          <div className="empty-messages-content">
            <div className="empty-icon">💬</div>
            <h3>No messages yet</h3>
            <p>Be the first to start the conversation!</p>
          </div>
        </div>
        <div ref={messagesEndRef} />
      </div>
    );
  }

  return (
    <div className="messages-container" ref={messagesContainerRef}>
      <div className="messages-list">
        {messages.map((message, index) => (
          <div 
            key={message.id} 
            className={`message ${isOwnMessage(message) ? 'own-message' : 'other-message'}`}
          >
            <div className="message-content">
              {!isOwnMessage(message) && shouldShowAvatar(message, index) && (
                <div className="message-avatar">
                  <img 
                    src={message.user.avatar} 
                    alt={message.user.username}
                    className="avatar"
                  />
                </div>
              )}
              
              <div className="message-body">
                {shouldShowUsername(message, index) && (
                  <div className="message-username">
                    {message.user.username}
                  </div>
                )}
                
                <div className="message-bubble">
                  <div className="message-text">
                    {message.text}
                  </div>
                  <div className="message-time">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
              
              {isOwnMessage(message) && shouldShowAvatar(message, index) && (
                <div className="message-avatar">
                  <img 
                    src={message.user.avatar} 
                    alt={message.user.username}
                    className="avatar"
                  />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
