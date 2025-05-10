// server.js - Express server for Champions Gate HOA Assistant
const express = require('express');
const path = require('path');
const cors = require('cors');
const OpenAI = require('openai');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history (in a real app, use a database)
const conversations = {};

// Utility to get conversation history for a user
function getConversationHistory(userId) {
  if (!conversations[userId]) {
    conversations[userId] = [];
  }
  return conversations[userId];
}

// Handle chat requests
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.headers['x-user-id'] || 'default-user'; // In a real app, get from authentication
    
    // Get conversation history
    const history = getConversationHistory(userId);
    
    // Prepare messages array for OpenAI
    const messages = [
      {
        role: 'system',
        content: `You are the AI assistant for Champions Gate Country Club HOA. Your purpose is to help residents understand HOA documents and Florida Statute 720. 
                  Be concise, helpful, and specific. When answering questions, cite specific sections from the HOA documents or Florida Statute 720 when applicable.
                  Your knowledge is limited to the documents that have been provided to you and general knowledge about HOAs and Florida law.`
      },
      ...history,
      { role: 'user', content: message }
    ];
    
    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',  // Replace with 'gpt-4-turbo' if needed
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const aiResponse = response.choices[0].message.content;
    
    // Update conversation history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: aiResponse });
    
    // Keep history at a reasonable size
    if (history.length > 20) {
      history.splice(0, 2); // Remove oldest message pair
    }
    
    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Champions Gate HOA Assistant server running on port ${port}`);
});