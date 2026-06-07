require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');
const petRouter = require('./Routes/PetRoute')
const AdoptFormRoute = require('./Routes/AdoptFormRoute')
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const userRouter = require('./Routes/UserRoute')
const OtpRouter = require('./Routes/OtpRoute')
const requireAuth = require('./Middleware/requireAuth')
const DashboardRouter = require('./Routes/DashboardRoute')
const ShelterRoute = require('./Routes/ShelterRoute');
const VolunteerRoutes = require('./Routes/VolunteerRoutes');
const UserPreferenceRoutes = require('./Routes/UserPreferenceRoutes');
const RecommendationRoutes = require('./Routes/RecommendationRoutes');
const AIChatRoutes = require('./Routes/AIChatRoutes');
const DonationRoutes = require('./Routes/DonationRoutes');
const StripeRoutes = require('./Routes/StripeRoutes');
const { clearCache: clearAIChatCache } = require('./services/aiChatService');
const { initializeDonationGoalScheduler } = require('./services/donationSchedulerService');


const app = express();
// За reverse-proxy (nginx) корректно выставляются req.secure и X-Forwarded-Proto для cookie Secure / логики
app.set('trust proxy', 1);
const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_URLS || process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // allow non-browser requests (no origin) and same-origin
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

const io = new Server(server, { cors: corsOptions });
app.use(cors(corsOptions));

// Use cookie parser
app.use(cookieParser());

// Add caching middleware for static files
const cacheControl = (req, res, next) => {
    // Set caching headers
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Expires', new Date(Date.now() + 86400000).toUTCString());
    next();
};

// Apply caching to static image files (fallthrough: false — не пропускать к requireAuth)
app.use('/images', cacheControl, express.static(path.join(__dirname, 'images'), { fallthrough: false }));

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Authentication middleware for Socket.IO
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    // Разрешаем подключение без токена, но с ограниченными правами
    // для публичных страниц (например, страница питомцев)
    socket.isAuthenticated = false;
    console.log('Socket connection without auth token (public access)');
    return next();
  }
  
  // Verify JWT token
  const jwt = require('jsonwebtoken');
  try {
    const decoded = jwt.verify(token, process.env.SECRET);
    socket.userId = decoded._id;
    socket.isAuthenticated = true;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // For expired tokens, we still connect but mark as unauthenticated
      // The client should handle refreshing the token
      try {
        const decodedExpired = jwt.decode(token);
        if (decodedExpired && decodedExpired._id) {
          socket.userId = decodedExpired._id;
          socket.isAuthenticated = false;
          socket.tokenExpired = true;
          console.log('Socket connected with expired token. Client should refresh.');
          
          // Emit a special event to tell the client to refresh the token
          socket.emit('tokenExpired', { message: 'Authentication token expired, please refresh' });
          
          return next();
        }
      } catch (decodeError) {
        return next(new Error('Invalid token format'));
      }
    }
    next(new Error('Authentication error'));
  }
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.userId);

  if (socket.userId && socket.isAuthenticated) {
    socket.join(`userId:${socket.userId}`);
  }
  
  // Обработчик для подключения к комнате пользователя
  socket.on('joinRoom', (room) => {
    console.log(`Пользователь ${socket.userId || 'гость'} присоединился к комнате: ${room}`);
    socket.join(room);
    
    // Убираем тестовое сообщение
    // if (room === 'shelters') {
    //   socket.emit('connectionTest', { 
    //     message: 'Подключение к комнате shelters успешно!',
    //     timestamp: new Date().toISOString()
    //   });
    // }
  });

  // Обработчик для отключения от комнаты пользователя
  socket.on('leaveRoom', (room) => {
    console.log(`Пользователь ${socket.userId || 'гость'} покинул комнату: ${room}`);
    socket.leave(room);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.userId);
  });
});

// Make io accessible to our routes
app.set('io', io);

// Настройка автоматической очистки кэша AI-чата при изменении данных
// Перехватываем emit для автоматической очистки кэша
(function setupAIChatCacheInvalidation() {
  const cacheInvalidationEvents = [
    'shelterUpdate',
    'shelterDeleted',
    'petRequestUpdate',
    'petDeleted',
    'speciesBreedUpdate',
    'temperamentUpdate',
    'newPet'
  ];
  
  // Сохраняем оригинальный emit
  const originalEmit = io.emit.bind(io);
  
  // Переопределяем io.emit
  io.emit = function(event, ...args) {
    originalEmit(event, ...args);
    
    if (cacheInvalidationEvents.includes(event)) {
      console.log(`🔄 Очистка кэша AI-чата из-за события: ${event}`);
      clearAIChatCache();
    }
  };
  
  // Перехватываем io.to().emit()
  const originalTo = io.to.bind(io);
  io.to = function(...rooms) {
    const roomEmitter = originalTo(...rooms);
    const originalRoomEmit = roomEmitter.emit.bind(roomEmitter);
    
    roomEmitter.emit = function(event, ...args) {
      originalRoomEmit(event, ...args);
      
      if (cacheInvalidationEvents.includes(event)) {
        console.log(`🔄 Очистка кэша AI-чата из-за события: ${event} (комнаты: ${rooms.join(', ')})`);
        clearAIChatCache();
      }
    };
    
    return roomEmitter;
  };
})();

// Публичные маршруты, доступные без аутентификации
app.use('/user', userRouter)
app.use('/api', OtpRouter)

// Публичные маршруты для просмотра питомцев и приютов
// Перенаправляем только GET-запросы для просмотра
app.use('/pets', require('./Routes/PublicPetRoutes'))
app.use('/shelters', require('./Routes/PublicShelterRoutes'))
// Stripe и donations - публичные (можно донатить без авторизации)
app.use('/stripe', StripeRoutes)
app.use('/donations', require('./Routes/DonationRoutes'))

// Применяем middleware аутентификации ко всем остальным маршрутам
app.use(requireAuth)
app.use('/dashboard', DashboardRouter)
app.use('/admin', require('./Routes/AdminUserRoutes'))
// Защищенные маршруты питомцев после публичных, с другим префиксом для избежания конфликтов
app.use('/admin-pets', petRouter)
app.use('/shelters', ShelterRoute)
app.use('/form', AdoptFormRoute)
// Перемещаем маршрут для волонтеров после middleware аутентификации
app.use('/volunteers', VolunteerRoutes)
app.use('/user/preferences', UserPreferenceRoutes)
app.use('/recommendations', RecommendationRoutes)
app.use('/ai-chat', AIChatRoutes)
app.use('/pet-care', require('./Routes/PetCareCalendarRoutes'))
app.use('/favorites', require('./Routes/FavoriteRoutes'))

mongoose.connect(process.env.mongooseURL)
    .then(() => {
        console.log('Connected to DB');
        const PORT = 4000;
        server.listen(PORT, () => {
            console.log(`Listening on port ${PORT}`);
            
            // Инициализируем планировщик автоматического сброса целей сбора средств
            initializeDonationGoalScheduler(io);
        })
    })
    .catch((err) => {
        console.error(err);
    })