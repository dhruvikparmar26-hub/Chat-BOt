import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ChatSession from '../models/ChatSession.js';
import { protect, authorizeSession } from '../middleware/protect.js';
import { validateRegister, validateLogin } from '../middleware/inputValidator.js';
import { authLimiter } from '../middleware/security.js';

const router = express.Router();

router.post('/register', authLimiter, validateRegister, async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ error: 'Email or username already in use.' });

    const user = await User.create({ username, email, password });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, username: user.username });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed.' });
  }
});

router.post('/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid credentials.' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch {
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Get all sessions for sidebar (protected)
router.get('/history', protect, async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .select('date summary createdAt _id');
    res.json(sessions);
  } catch {
    res.status(500).json({ error: 'Failed to fetch history.' });
  }
});

// Get one full session (protected + ownership check)
router.get('/history/:sessionId', protect, authorizeSession, (req, res) => {
  res.json(req.chatSession);
});

// Delete a session (protected + ownership check)
router.delete('/history/:sessionId', protect, authorizeSession, async (req, res) => {
  try {
    await ChatSession.findByIdAndDelete(req.params.sessionId);
    res.json({ message: 'Session deleted.' });
  } catch {
    res.status(500).json({ error: 'Delete failed.' });
  }
});

export default router;
