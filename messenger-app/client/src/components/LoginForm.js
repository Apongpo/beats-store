import React, { useState } from 'react';
import { MessageCircle, User } from 'lucide-react';

const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }

    if (username.trim().length < 2) {
      alert('Username must be at least 2 characters long');
      return;
    }

    setIsLoading(true);

    try {
      const userData = {
        username: username.trim(),
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(username.trim())}&background=random`
      };

      // Simulate a brief loading delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      onLogin(userData);
    } catch (error) {
      console.error('Login error:', error);
      alert('Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUsernameChange = (e) => {
    // Limit username length and prevent special characters that might cause issues
    const value = e.target.value.replace(/[<>]/g, '').slice(0, 30);
    setUsername(value);
  };

  return (
    <div className="login-form-container">
      <div className="login-form">
        <div className="login-header">
          <MessageCircle size={48} className="login-icon" />
          <h1>Welcome to Messenger</h1>
          <p>Enter your username to start chatting</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <div className="input-container">
              <User size={20} className="input-icon" />
              <input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={handleUsernameChange}
                disabled={isLoading}
                className="username-input"
                maxLength={30}
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading || !username.trim()}
            className="login-button"
          >
            {isLoading ? (
              <div className="loading-spinner">
                <div className="spinner"></div>
                Joining...
              </div>
            ) : (
              'Join Chat'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-info">
            💡 <strong>Tip:</strong> Your messages are temporary and will be lost when you leave
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
