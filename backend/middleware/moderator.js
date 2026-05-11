const blocklist = [
  'kill', 'murder', 'suicide', 'bomb', 'hack', 'exploit',
  'porn', 'nude', 'drugs', 'cocaine', 'rape',
  'fuck', 'shit', 'bitch', 'bastard', 'asshole'
];

const MAX_MESSAGE_LENGTH = 1000;

// Tracks how many blocked messages each socket has sent
const strikeMap = new Map();

export function moderateMessage(socket, message) {
  // Length guard
  if (!message || typeof message !== 'string') {
    socket.emit('chat:error', { message: 'Invalid message format.' });
    return false;
  }

  if (message.trim().length === 0) {
    socket.emit('chat:error', { message: 'Message cannot be empty.' });
    return false;
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    socket.emit('chat:error', { message: `Message too long. Max ${MAX_MESSAGE_LENGTH} characters.` });
    return false;
  }

  // Abusive content check
  const lower = message.toLowerCase();
  const isAbusive = blocklist.some((word) => lower.includes(word));

  if (isAbusive) {
    const strikes = (strikeMap.get(socket.id) || 0) + 1;
    strikeMap.set(socket.id, strikes);

    socket.emit('chat:blocked', {
      message: "Sorry, I can't help with that. Please keep the conversation respectful.",
      strikes,
    });

    // Disconnect repeat offenders after 3 strikes
    if (strikes >= 3) {
      socket.emit('chat:error', { message: 'You have been disconnected for repeated violations.' });
      socket.disconnect(true);
    }

    return false;
  }

  return true;
}

// Clean up strike map when socket disconnects
export function clearStrikes(socketId) {
  strikeMap.delete(socketId);
}
