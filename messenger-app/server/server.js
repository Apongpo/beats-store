const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// Configure CORS for Express
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true
}));

// Configure Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(express.json());

// In-memory storage for messages and users
let messages = [];
let users = new Map(); // socketId -> user info
let rooms = new Map(); // roomId -> room info

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('client/build'));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// API Routes
app.get('/api/messages', (req, res) => {
  res.json(messages.slice(-50)); // Return last 50 messages
});

app.get('/api/users', (req, res) => {
  const activeUsers = Array.from(users.values());
  res.json(activeUsers);
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user joining
  socket.on('join', (userData) => {
    const user = {
      id: socket.id,
      username: userData.username,
      avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username)}&background=random`,
      joinedAt: new Date(),
      isTyping: false
    };
    
    users.set(socket.id, user);
    
    // Notify all clients about the new user
    socket.broadcast.emit('user_joined', user);
    
    // Send current users list to the new user
    socket.emit('users_list', Array.from(users.values()));
    
    // Send recent messages to the new user
    socket.emit('message_history', messages.slice(-50));
    
    console.log(`${user.username} joined the chat`);
  });

  // Handle new messages
  socket.on('send_message', (messageData) => {
    const user = users.get(socket.id);
    if (!user) return;

    const message = {
      id: uuidv4(),
      text: messageData.text,
      user: {
        id: user.id,
        username: user.username,
        avatar: user.avatar
      },
      timestamp: new Date(),
      type: 'text'
    };

    messages.push(message);
    
    // Keep only last 1000 messages in memory
    if (messages.length > 1000) {
      messages = messages.slice(-1000);
    }

    // Broadcast message to all connected clients
    io.emit('new_message', message);
    
    console.log(`Message from ${user.username}: ${message.text}`);
  });

  // Handle typing indicators
  socket.on('typing_start', () => {
    const user = users.get(socket.id);
    if (!user) return;
    
    user.isTyping = true;
    socket.broadcast.emit('user_typing', { userId: socket.id, username: user.username, isTyping: true });
  });

  socket.on('typing_stop', () => {
    const user = users.get(socket.id);
    if (!user) return;
    
    user.isTyping = false;
    socket.broadcast.emit('user_typing', { userId: socket.id, username: user.username, isTyping: false });
  });

  // Handle private messages
  socket.on('private_message', (data) => {
    const sender = users.get(socket.id);
    if (!sender) return;

    const message = {
      id: uuidv4(),
      text: data.text,
      user: {
        id: sender.id,
        username: sender.username,
        avatar: sender.avatar
      },
      recipient: data.recipient,
      timestamp: new Date(),
      type: 'private'
    };

    // Send to recipient
    socket.to(data.recipient).emit('private_message', message);
    
    // Send back to sender for confirmation
    socket.emit('private_message', message);
    
    console.log(`Private message from ${sender.username} to ${data.recipient}`);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      
      // Notify all clients about user leaving
      socket.broadcast.emit('user_left', user);
      
      console.log(`${user.username} left the chat`);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WebSocket server ready for real-time messaging`);
});

module.exports = app;
