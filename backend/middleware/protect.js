import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';

// ── Authentication ─────────────────────────────────────────────────────────
// Verifies JWT, attaches req.user — blocks request with 401 if invalid/missing
export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch user and exclude password — confirms the user still exists in DB
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// ── Authorization ──────────────────────────────────────────────────────────
// Ensures the requesting user owns the session they're trying to access
export const authorizeSession = async (req, res, next) => {
  try {
    const session = await ChatSession.findById(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Strict ownership check — userId must match logged-in user
    if (session.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied. This is not your session.' });
    }

    req.chatSession = session;   // attach for downstream use (avoids Express req.session conflict)
    next();
  } catch {
    res.status(500).json({ error: 'Authorization check failed.' });
  }
};
