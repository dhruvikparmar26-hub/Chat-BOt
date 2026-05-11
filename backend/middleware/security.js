import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import xss from 'xss';

const isTest = process.env.NODE_ENV === 'test';

// Blocks 100+ req/15min per IP on all routes
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 100,
  message: { error: 'Too many requests. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter only for auth routes (login/register)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 20,
  message: { error: 'Too many auth attempts. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for socket/chat (per IP)
export const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isTest ? 1000 : 30,
  message: { error: 'Slow down! Too many messages.' },
});

// Strip keys containing $ or . from an object (NoSQL injection prevention)
// Works in-place to avoid reassigning read-only properties (Express 5 compat)
function stripDollarKeys(obj) {
  if (typeof obj !== 'object' || obj === null) return obj;
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
    } else if (typeof obj[key] === 'object') {
      stripDollarKeys(obj[key]);
    }
  }
  return obj;
}

// Custom mongo-sanitize middleware (Express 5 compatible — doesn't reassign req.query)
function mongoSanitize(req, res, next) {
  if (req.body)   stripDollarKeys(req.body);
  if (req.query)  stripDollarKeys(req.query);
  if (req.params) stripDollarKeys(req.params);
  next();
}

// Sanitize strings in an object recursively using xss
function sanitizeObject(obj) {
  if (typeof obj === 'string') return xss(obj);
  if (typeof obj === 'object' && obj !== null) {
    for (const key of Object.keys(obj)) {
      obj[key] = sanitizeObject(obj[key]);
    }
  }
  return obj;
}

// Custom XSS sanitizer middleware — sanitizes values in-place
function xssSanitize(req, res, next) {
  if (req.body)   sanitizeObject(req.body);
  if (req.query)  sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
}

export const securityMiddlewares = [
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
        styleSrc:   ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc:    ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "ws:", "wss:"],
        imgSrc:     ["'self'", "data:", "blob:"],
      },
    },
  }),
  mongoSanitize,         // Strips $ and . keys to prevent NoSQL injection (Express 5 safe)
  xssSanitize,           // Sanitizes req.body, req.query, req.params from XSS scripts
  hpp(),                 // Prevents HTTP parameter pollution attacks
];
