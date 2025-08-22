import React, { useState, useRef, useEffect } from 'react';
import { Send, Smile } from 'lucide-react';

const MessageInput = ({ onSendMessage, onTypingStart, onTypingStop, disabled }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [disabled]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Handle typing indicators
    if (value.trim() && !isTyping) {
      setIsTyping(true);
      onTypingStart();
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        onTypingStop();
      }
    }, 1000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim() || disabled) {
      return;
    }

    // Send the message
    onSendMessage(message);
    
    // Clear the input
    setMessage('');
    
    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      onTypingStop();
    }
    
    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Focus back to input
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFocus = () => {
    // Optional: Add focus styling or behavior
  };

  const handleBlur = () => {
    // Stop typing indicator when input loses focus
    if (isTyping) {
      setIsTyping(false);
      onTypingStop();
    }
  };

  const addEmoji = (emoji) => {
    const newMessage = message + emoji;
    setMessage(newMessage);
    
    // Focus back to input after adding emoji
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const popularEmojis = ['😀', '😂', '❤️', '👍', '👎', '🎉', '😢', '😊', '🤔', '👋'];

  return (
    <div className="message-input-container">
      <form onSubmit={handleSubmit} className="message-input-form">
        <div className="input-wrapper">
          <div className="emoji-picker">
            <button
              type="button"
              className="emoji-button"
              title="Add emoji"
              disabled={disabled}
            >
              <Smile size={20} />
            </button>
            <div className="emoji-dropdown">
              {popularEmojis.map((emoji, index) => (
                <button
                  key={index}
                  type="button"
                  className="emoji-option"
                  onClick={() => addEmoji(emoji)}
                  disabled={disabled}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder={disabled ? 'Connecting...' : 'Type a message...'}
            disabled={disabled}
            className="message-textarea"
            rows="1"
            maxLength={1000}
            autoComplete="off"
          />
          
          <button
            type="submit"
            disabled={!message.trim() || disabled}
            className="send-button"
            title="Send message (Enter)"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
      
      <div className="input-footer">
        <span className="character-count">
          {message.length}/1000
        </span>
        {disabled && (
          <span className="connection-warning">
            🔴 Disconnected - trying to reconnect...
          </span>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
