# 💬 Messenger App

A modern, real-time messaging application built with React and Socket.io. Features include instant messaging, user presence indicators, typing notifications, and a responsive design that works on desktop and mobile devices.

![Messenger App Screenshot](https://via.placeholder.com/800x400/1877f2/ffffff?text=Messenger+App+Demo)

## ✨ Features

- **Real-time Messaging**: Instant message delivery using WebSocket technology
- **User Authentication**: Simple username-based login system
- **User Presence**: See who's online and when they joined
- **Typing Indicators**: Know when someone is typing a message
- **Emoji Support**: Quick emoji picker with popular emojis
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Modern UI**: Clean, Facebook Messenger-inspired interface
- **Message History**: Automatic message persistence during the session
- **Connection Status**: Visual indicators for connection status

## 🚀 Quick Start

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. **Clone or download the project**
   ```bash
   # If you have the project files, navigate to the directory
   cd messenger-app
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   npm install
   
   # Install client dependencies
   npm run install-client
   
   # Or install both at once
   npm run install-all
   ```

3. **Start the application**
   
   **Option 1: Development mode (recommended)**
   ```bash
   npm run dev
   ```
   This starts both the server and client in development mode with hot reloading.
   
   **Option 2: Start components separately**
   ```bash
   # Terminal 1: Start the server
   npm run server
   
   # Terminal 2: Start the client
   npm run client
   ```

4. **Open your browser**
   - Client: http://localhost:3000
   - Server: http://localhost:5000

## 🏗️ Project Structure

```
messenger-app/
├── server/
│   └── server.js           # Express + Socket.io server
├── client/
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── LoginForm.js
│   │   │   ├── MessageList.js
│   │   │   ├── MessageInput.js
│   │   │   ├── UserList.js
│   │   │   └── TypingIndicator.js
│   │   ├── App.js          # Main React component
│   │   ├── App.css         # Application styles
│   │   └── index.js        # React entry point
│   ├── public/             # Static files
│   └── package.json        # Client dependencies
├── package.json            # Server dependencies & scripts
└── README.md              # This file
```

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start server in production mode |
| `npm run dev` | Start both server and client in development mode |
| `npm run server` | Start only the server with nodemon |
| `npm run client` | Start only the client React app |
| `npm run build` | Build the client for production |
| `npm run install-client` | Install client dependencies |
| `npm run install-all` | Install both server and client dependencies |

## 🔧 Configuration

### Environment Variables

You can customize the server configuration by creating a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Client Configuration (in client/.env)
REACT_APP_SERVER_URL=http://localhost:5000
```

### Server Configuration

The server runs on port 5000 by default. You can change this by setting the `PORT` environment variable or modifying the server code.

### CORS Configuration

The server is configured to accept connections from `http://localhost:3000` by default. If you're running the client on a different port, update the CORS configuration in `server/server.js`.

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/messages` | GET | Get recent messages |
| `/api/users` | GET | Get active users |

## 📡 WebSocket Events

### Client to Server Events

- `join` - User joins the chat
- `send_message` - Send a new message
- `typing_start` - User starts typing
- `typing_stop` - User stops typing
- `private_message` - Send private message (feature ready)

### Server to Client Events

- `new_message` - New message broadcast
- `message_history` - Initial message history
- `users_list` - List of active users
- `user_joined` - User joined notification
- `user_left` - User left notification
- `user_typing` - Typing indicator update

## 🎨 Customization

### Changing Colors

The app uses CSS custom properties. You can easily change the color scheme by modifying the CSS variables in `client/src/App.css`:

```css
/* Main brand color */
#1877f2 -> your-primary-color

/* Background gradient */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

### Adding Features

The codebase is structured to make it easy to add new features:

1. **New Components**: Add to `client/src/components/`
2. **Server Logic**: Modify `server/server.js`
3. **Styling**: Update `client/src/App.css`

## 🔒 Security Notes

This is a development/demo application with basic security measures:

- No data persistence (messages are lost on server restart)
- Simple username authentication (no passwords)
- No rate limiting or spam protection
- No message encryption

For production use, consider implementing:
- Database storage (MongoDB, PostgreSQL, etc.)
- User authentication with JWT tokens
- Message encryption
- Rate limiting
- Input validation and sanitization

## 🐛 Troubleshooting

### Common Issues

**1. Port already in use**
```bash
Error: EADDRINUSE: address already in use :::5000
```
Kill the process using the port or change the port in the configuration.

**2. Connection refused**
- Make sure the server is running before starting the client
- Check if the server URL in the client matches the server configuration

**3. Socket.io connection issues**
- Verify CORS settings in `server/server.js`
- Check browser console for WebSocket errors
- Ensure no firewall is blocking the connection

### Development Tips

- Use browser developer tools to monitor WebSocket connections
- Check the server console for Socket.io connection logs
- The app automatically reconnects on connection loss

## 📱 Mobile Support

The app is fully responsive and optimized for mobile devices:

- Touch-friendly interface
- Responsive layout that adapts to screen size
- Mobile-optimized typing and emoji selection
- Swipe gestures (can be extended)

## 🚀 Deployment

### Production Build

1. Build the client:
   ```bash
   npm run build
   ```

2. Set production environment:
   ```bash
   export NODE_ENV=production
   ```

3. Start the server:
   ```bash
   npm start
   ```

### Deployment Platforms

The app can be deployed to:
- **Heroku**: Use the included Procfile
- **DigitalOcean**: Deploy as a Node.js application  
- **AWS**: Use Elastic Beanstalk or EC2
- **Railway**: Simple git-based deployment
- **Render**: Modern cloud platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Future Enhancements

Potential features to add:

- [ ] User profiles with avatars
- [ ] Private messaging
- [ ] Message reactions/emojis  
- [ ] File/image sharing
- [ ] Multiple chat rooms
- [ ] Message search
- [ ] Push notifications
- [ ] Dark mode
- [ ] Message encryption
- [ ] Voice messages
- [ ] Video chat integration

## 🔗 Tech Stack

- **Frontend**: React, Socket.io-client, Lucide React (icons)
- **Backend**: Node.js, Express, Socket.io
- **Styling**: CSS3 with modern features
- **Build Tools**: Create React App, npm
- **Real-time**: WebSocket/Socket.io

---

**Made with ❤️ using React and Socket.io**

For questions or support, please create an issue in the repository.
