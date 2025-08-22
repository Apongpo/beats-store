import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import './App.css';
import MessageList from './components/MessageList';
import MessageInput from './components/MessageInput';
import UserList from './components/UserList';
import LoginForm from './components/LoginForm';
import TypingIndicator from './components/TypingIndicator';
import { Send, Users, MessageCircle } from 'lucide-react';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (isLoggedIn && currentUser) {
      // Initialize socket connection
      const newSocket = io(SERVER_URL, {
        transports: ['websocket', 'polling']
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        setIsConnected(true);
        
        // Join the chat
        newSocket.emit('join', currentUser);
      });

      newSocket.on('disconnect', () => {
        console.log('Disconnected from server');
        setIsConnected(false);
      });

      // Listen for messages
      newSocket.on('new_message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('message_history', (history) => {
        setMessages(history);
      });

      // Listen for user events
      newSocket.on('users_list', (usersList) => {
        setUsers(usersList);
      });

      newSocket.on('user_joined', (user) => {
        setUsers(prev => [...prev, user]);
      });

      newSocket.on('user_left', (user) => {
        setUsers(prev => prev.filter(u => u.id !== user.id));
        setTypingUsers(prev => prev.filter(u => u.userId !== user.id));
      });

      // Listen for typing indicators
      newSocket.on('user_typing', (data) => {
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.userId !== data.userId);
          return data.isTyping ? [...filtered, data] : filtered;
        });
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    }
  }, [isLoggedIn, currentUser]);

  const handleLogin = (userData) => {
    setCurrentUser(userData);
    setIsLoggedIn(true);
  };

  const handleSendMessage = (text) => {
    if (socket && text.trim()) {
      socket.emit('send_message', { text: text.trim() });
    }
  };

  const handleTypingStart = () => {
    if (socket) {
      socket.emit('typing_start');
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop');
      }, 3000);
    }
  };

  const handleTypingStop = () => {
    if (socket) {
      socket.emit('typing_stop');
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    setSocket(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    setMessages([]);
    setUsers([]);
    setIsConnected(false);
    setTypingUsers([]);
  };

  if (!isLoggedIn) {
    return (
      <div className="app login-container">
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <MessageCircle size={24} />
            <h1>Messenger</h1>
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢' : '🔴'} {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
          <div className="header-right">
            <button 
              className="user-list-toggle"
              onClick={() => setShowUserList(!showUserList)}
              title="Toggle user list"
            >
              <Users size={20} />
              <span className="user-count">{users.length}</span>
            </button>
            <div className="current-user">
              <img src={currentUser.avatar} alt={currentUser.username} className="user-avatar" />
              <span>{currentUser.username}</span>
            </div>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="chat-container">
          <div className="chat-area">
            <MessageList 
              messages={messages} 
              currentUser={currentUser} 
            />
            <TypingIndicator typingUsers={typingUsers} />
            <MessageInput 
              onSendMessage={handleSendMessage}
              onTypingStart={handleTypingStart}
              onTypingStop={handleTypingStop}
              disabled={!isConnected}
            />
          </div>
          {showUserList && (
            <div className="sidebar">
              <UserList users={users} currentUser={currentUser} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
