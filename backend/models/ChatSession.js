import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role:    { type: String, enum: ['user', 'model'], required: true },
  content: { type: String, required: true },
  time:    { type: Date, default: Date.now }
});

const chatSessionSchema = new mongoose.Schema({
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:     { type: String, required: true },   // stored as "YYYY-MM-DD" for easy grouping
  summary:  { type: String, default: '' },       // AI-generated topic summary
  messages: [messageSchema]
}, { timestamps: true });

// Index for fast user-specific queries sorted by newest first
chatSessionSchema.index({ userId: 1, createdAt: -1 });

export default mongoose.model('ChatSession', chatSessionSchema);
