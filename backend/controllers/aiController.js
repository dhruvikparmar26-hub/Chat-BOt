import { GoogleGenerativeAI } from '@google/generative-ai';
import ChatSession from '../models/ChatSession.js';

// Lazy init — env vars may not be loaded when this module is first imported
let _genAI = null;
function getGenAI() {
  if (!_genAI) _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return _genAI;
}

// ── Guest message limit ────────────────────────────────────────────────────
const GUEST_MESSAGE_LIMIT = 2;
const guestMessageCount = new Map();

export function getGuestCount(socketId) {
  return guestMessageCount.get(socketId) || 0;
}

export function clearGuestCount(socketId) {
  guestMessageCount.delete(socketId);
}

// ── Model fallback chain ───────────────────────────────────────────────────
const MODEL_PRIORITY = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemma-3-27b-it',
  'gemma-3-12b-it',
  'gemma-3-4b-it',
  'gemma-3-1b-it'
];

// ── Detect if message needs real-time/current info ─────────────────────────
function needsLiveData(message) {
  const triggers = [
    'current affairs', 'latest news', 'today', 'right now',
    'recent', 'breaking', 'live', 'currently', 'what happened',
    'news', 'update', 'this week', 'this month', 'stock price',
    'weather', 'score', 'trending', 'just announced'
  ];
  const lower = message.toLowerCase();
  return triggers.some((t) => lower.includes(t));
}

// ── Generate short topic summary ───────────────────────────────────────────
async function generateSummary(messages) {
  try {
    // Using gemma-3-1b-it for summaries to save gemini quota limits
    const model = getGenAI().getGenerativeModel({ model: 'gemma-3-1b-it' });
    const transcript = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    const result = await model.generateContent(
      `Summarize this chat in one short sentence (max 10 words):\n${transcript}`
    );
    return result.response.text().trim();
  } catch (err) {
    console.warn('Summary generation failed, hiding error:', err.message);
    return 'New Chat';
  }
}

// ── Main chat handler ──────────────────────────────────────────────────────
export async function handleChatMessage(socket, data, modelIndex = 0) {
  const { message, history = [], sessionId = null } = data;

  // --- Guest message limit (check only, don't increment yet) ---
  if (!socket.userId) {
    const count = guestMessageCount.get(socket.id) || 0;
    if (count >= GUEST_MESSAGE_LIMIT) {
      socket.emit('chat:limit', {
        type: 'guest_limit',
        message: 'You have reached the free message limit. Please sign up or log in to continue chatting.'
      });
      return;
    }
  }

  // If all models exhausted
  if (modelIndex >= MODEL_PRIORITY.length) {
    socket.emit('chat:limit', {
      type: 'all_exhausted',
      message: 'All AI models are currently at capacity. Please try again later.'
    });
    return;
  }

  const currentModel = MODEL_PRIORITY[modelIndex];
  const isLiveQuery = needsLiveData(message);

  const isGemma = currentModel.startsWith('gemma');
  const modelParams = { model: currentModel };
  
  if (!isGemma) {
    modelParams.systemInstruction = `You are a helpful, friendly assistant. 
      Be concise and clear. Never produce harmful, abusive, or explicit content.
      When providing current affairs or news, always mention the source if available.`;
    if (isLiveQuery) {
      modelParams.tools = [{ googleSearch: {} }];
    }
  }

  const model = getGenAI().getGenerativeModel(modelParams);

  // Notify user which model is being used (on fallback)
  if (modelIndex > 0) {
    socket.emit('chat:status', {
      message: 'Thinking...'
    });
  }

  // Notify frontend that live search is being used
  if (isLiveQuery) {
    socket.emit('chat:status', { message: 'Searching the web for latest info...' });
  }

  const formattedHistory = history.map((t) => ({
    role: t.role === 'assistant' ? 'model' : t.role,
    parts: [{ text: t.content }],
  }));

  try {
    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessageStream(message);

    let fullResponse = '';

    for await (const chunk of result.stream) {
      const token = chunk.text();
      if (token) {
        fullResponse += token;
        socket.emit('chat:chunk', { token });
      }
    }

    // Extract grounding sources if Google Search was used
    const response = await result.response;
    const groundingChunks = response.candidates?.[0]
      ?.groundingMetadata?.groundingChunks;

    if (groundingChunks?.length > 0) {
      const sources = groundingChunks
        .filter(c => c.web?.uri)
        .map(c => ({ title: c.web.title || 'Source', url: c.web.uri }));

      if (sources.length > 0) socket.emit('chat:sources', { sources });
    }

    socket.emit('chat:done');

    // Increment guest count only after successful response
    if (!socket.userId) {
      const count = guestMessageCount.get(socket.id) || 0;
      guestMessageCount.set(socket.id, count + 1);
    }

    // Save to MongoDB for logged-in users
    if (socket.userId) {
      const today = new Date().toISOString().split('T')[0];

      let session = sessionId
        ? await ChatSession.findOne({ _id: sessionId, userId: socket.userId })
        : null;

      if (!session) {
        session = new ChatSession({ userId: socket.userId, date: today, messages: [] });
      }

      session.messages.push({ role: 'user',  content: message });
      session.messages.push({ role: 'model', content: fullResponse });

      if (session.messages.length % 4 === 0 || session.messages.length <= 2) {
        session.summary = await generateSummary(session.messages);
      }

      await session.save();
      socket.emit('chat:session', { sessionId: session._id, summary: session.summary });
    }

  } catch (err) {
    const errorMsg = err.message ? err.message.toLowerCase() : '';
    const isQuotaError = errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('exhausted');

    if (isQuotaError) {
      // Try next model in the priority list
      console.warn(`[${currentModel}] quota hit — trying next model`);
      return handleChatMessage(socket, data, modelIndex + 1);
    }
    
    console.error('Chat error:', err);
    throw err;
  }
}