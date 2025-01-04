require("dotenv").config(); // Load environment variables from .env
console.log("API Key:", process.env.AZURE_API_KEY);
console.log("Endpoint:", process.env.AZURE_ENDPOINT);

const axios = require("axios");

// Build the endpoint using environment variables
const apiKey = process.env.AZURE_API_KEY;
const endpoint = `${process.env.AZURE_ENDPOINT}/openai/deployments/chat-deployment/chat/completions?api-version=2024-08-01-preview`;

// Log the endpoint to debug
console.log("Resolved endpoint:", endpoint);

async function testAzureOpenAI() {
  try {
    const response = await axios.post(
      endpoint,
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello, how can I assist you?" },
        ],
        max_tokens: 7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

    // Log the AI's response content
    const aiMessage = response.data.choices[0].message.content;
    console.log("AI Response:", aiMessage);
  } catch (error) {
    console.error(
      "Error:",
      error.response ? error.response.data : error.message
    );
  }
}

testAzureOpenAI();
