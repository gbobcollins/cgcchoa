// server.js - Express server for Champions Gate HOA Assistant with file search tools
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

// Store thread IDs for conversations (in a real app, use a database)
const userThreads = {};

// Assistant ID - Create this once in the OpenAI dashboard and store the ID
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID;

// Handle chat requests
app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.headers['x-user-id'] || 'default-user'; // In a real app, get from authentication
    
    // Get or create thread ID for this user
    let threadId = userThreads[userId];
    if (!threadId) {
      // Create a new thread for this user
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
      userThreads[userId] = threadId;
      console.log(`Created new thread ${threadId} for user ${userId}`);
    }

    // Add the user message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message
    });

    // Run the assistant on the thread
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
      instructions: `You are the AI assistant for Champions Gate Country Club HOA. 
                     Your purpose is to help residents understand HOA documents and Florida Statute 720.
                     Use the vector store to search for relevant information in the HOA documents.
                     Be concise, helpful, and specific. When answering questions, cite specific sections 
                     from the HOA documents or Florida Statute 720 when applicable.`
    });

    // Poll for the run completion
    let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    
    // Wait until the run is completed
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && runStatus.status !== 'cancelled') {
      // Wait for a second before polling again
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
      
      if (runStatus.status === 'requires_action') {
        // Handle tool calls if needed (for future extensions)
        const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
        const toolOutputs = [];
        
        for (const toolCall of toolCalls) {
          if (toolCall.function.name === 'search_documents') {
            const args = JSON.parse(toolCall.function.arguments);
            // In a real implementation, you might have a custom search function here
            // For now, we'll just return a placeholder
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify({ results: [`Found in section ${args.query.substring(0, 5)}: Example result`] })
            });
          }
        }
        
        if (toolOutputs.length > 0) {
          await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, { tool_outputs: toolOutputs });
        }
      }
    }

    // If the run completed successfully, get the latest message from the assistant
    if (runStatus.status === 'completed') {
      const messages = await openai.beta.threads.messages.list(threadId);
      
      // Find the most recent assistant message
      const assistantMessages = messages.data.filter(msg => msg.role === 'assistant');
      const latestMessage = assistantMessages[0]; // The first item is the most recent due to sorting
      
      // Extract the text content
      let aiResponse = '';
      if (latestMessage && latestMessage.content && latestMessage.content.length > 0) {
        aiResponse = latestMessage.content[0].text.value;
      } else {
        aiResponse = "I couldn't find a response to your question.";
      }
      
      res.json({ response: aiResponse });
    } else {
      // Handle run failure
      console.error('Run failed with status:', runStatus.status);
      res.status(500).json({ error: `Assistant run failed with status: ${runStatus.status}` });
    }
  } catch (error) {
    console.error('Error with OpenAI API:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// Setup route: One-time assistant creation (if needed)
app.post('/api/setup', async (req, res) => {
  try {
    // Only allow this route with admin authentication in production
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Create an assistant with document retrieval capabilities
    const assistant = await openai.beta.assistants.create({
      name: "Champions Gate HOA Assistant",
      description: "Assistant for Champions Gate Country Club HOA documents and Florida Statute 720",
      model: "gpt-4-turbo",
      tools: [
        { type: "retrieval" }, // Enables document search
        { 
          type: "function",
          function: {
            name: "search_documents",
            description: "Search for specific information in HOA documents",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query to find information in HOA documents"
                }
              },
              required: ["query"]
            }
          }
        }
      ],
      instructions: `You are the AI assistant for Champions Gate Country Club HOA.
                    Your purpose is to help residents understand HOA documents and Florida Statute 720.
                    Use the retrieval tool to search for relevant information in the documents.
                    Be concise, helpful, and specific. When answering questions, cite specific sections
                    from the HOA documents or Florida Statute 720 when applicable.`
    });
    
    res.json({ 
      success: true, 
      assistant_id: assistant.id,
      message: "Assistant created successfully. Save this ID in your .env file as OPENAI_ASSISTANT_ID."
    });
  } catch (error) {
    console.error('Error creating assistant:', error);
    res.status(500).json({ error: 'Failed to create assistant' });
  }
});

// File upload endpoint for adding documents to the assistant
app.post('/api/upload', async (req, res) => {
  try {
    // Only allow this route with admin authentication in production
    const adminKey = req.headers['x-admin-key'];
    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // This would need a file upload middleware like multer in a real app
    // For this example, we'll assume files are already in a 'documents' folder
    
    // Example of uploading a file and attaching to the assistant:
    const filePath = path.join(__dirname, 'documents', 'sample_hoa_doc.pdf');
    
    if (fs.existsSync(filePath)) {
      // Upload the file to OpenAI
      const file = await openai.files.create({
        file: fs.createReadStream(filePath),
        purpose: "assistants"
      });
      
      // Attach the file to the assistant
      await openai.beta.assistants.files.create(
        ASSISTANT_ID,
        { file_id: file.id }
      );
      
      res.json({ 
        success: true, 
        file_id: file.id,
        message: "File uploaded and attached to assistant successfully."
      });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Serve the main HTML file for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, () => {
  console.log(`Champions Gate HOA Assistant server running on port ${port}`);
  console.log(`Assistant ID: ${ASSISTANT_ID || 'Not set - run /api/setup first'}`);
});