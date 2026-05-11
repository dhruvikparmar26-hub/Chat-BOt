import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  console.log('Testing gemini-2.5-flash...');
  
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const chat = model.startChat({ history: [] });
    const result = await chat.sendMessageStream('Hello, 2+2?');
    for await (const chunk of result.stream) {
      console.log('Chunk:', chunk.text());
    }
    console.log('Success gemini-2.5-flash chat!');
    
    // Test summary feature (non-streamed)
    const result2 = await model.generateContent('Summarize: Hello, 2+2?');
    console.log('Summary:', result2.response.text());
  } catch (err) {
    console.error('Error gemini-2.5-flash:', err);
  }
}
run();
