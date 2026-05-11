import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const socketAuth = async (socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    socket.userId = null;    // guest — allowed but restricted
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return next(new Error('AUTH_FAILED: User not found.'));
    }

    socket.userId   = user._id.toString();
    socket.username = user.username;
    next();
  } catch (err) {
    // Don't expose the exact JWT error to the client
    return next(new Error('AUTH_FAILED: Invalid or expired token.'));
  }
};

// Use this inside socket event handlers to block guests from protected actions
export const requireSocketAuth = (socket, callback) => {
  if (!socket.userId) {
    socket.emit('chat:error', { message: 'You must be logged in to do this.' });
    return false;
  }
  return true;
};
