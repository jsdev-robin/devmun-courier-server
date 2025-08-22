import bodyParser from 'body-parser';
import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import useragent from 'express-useragent';
import helmet from 'helmet';
import ipinfo, { defaultIPSelector } from 'ipinfo-express';
import morgan from 'morgan';
import passport from 'passport';
import path from 'path';
import qs from 'qs';
import { config } from './configs/config';
import { nodeClient } from './configs/redis';
import { ApiError } from './middlewares/errors/ApiError';
import { globalErrorHandler } from './middlewares/errors/globalError';
import { initializePassport } from './middlewares/passport';
import { rateLimiter } from './middlewares/rateLimiter';
import authRouter from './routes/authRoute';
import parcelRouter from './routes/parcelRoute';
import HttpStatusCode from './utils/httpStatusCode';

const app = express();

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Set the view engine (e.g., EJS, Pug, Handlebars)

// Set the view engine to EJS
app.set('view engine', 'ejs');

// Set the views directory
app.set('views', path.join(__dirname, 'views'));

// Enable nested query parsing
app.set('query parser', (str: string) => qs.parse(str));
// app.set('query parser', 'extended');

// Proxy middleware
app.set('trust proxy', 1);

// Configure sessions for OAuth 2.0

app.use(
  session({
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 24 * 60 * 60 * 1000,
    },
    store: new RedisStore({
      client: nodeClient,
      prefix: 'myapp:',
    }),
    secret: 'dddd',
    resave: false,
    saveUninitialized: true,
  })
);
// Initialize Passport
initializePassport();
app.use(passport.initialize());
app.use(passport.session());

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from session
passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

// Set security-related HTTP headers
app.use(helmet());

// Apply the rate limiting middleware to all requests.
app.use(rateLimiter());

// Parse request bodies
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Get user device info
app.use(useragent.express());

// Parse cookies
app.use(cookieParser(config.COOKIE_SECRET));

// Get req  location
app.use(
  ipinfo({
    token: config.IPINFO_KEY,
    cache: null,
    timeout: 5000,
    ipSelector: defaultIPSelector,
  })
);

// Configure Cross-Origin Resource Sharing (CORS)
app.use(
  cors({
    origin: [
      'https://devmun.xyz',
      'https://www.devmun.xyz',
      'http://localhost:3000',
    ],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

app.get('/', (req, res) => {
  res.send({ message: 'Ping' });
});

// All route
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/customer', parcelRouter);

// Handle 404 errors
app.all(/(.*)/, (req: Request, res: Response, next: NextFunction) => {
  return next(
    new ApiError(
      `Can't find ${req.originalUrl} on this server!`,
      HttpStatusCode.NOT_FOUND
    )
  );
});

// Global error handling middleware
app.use(globalErrorHandler);

export default app;
