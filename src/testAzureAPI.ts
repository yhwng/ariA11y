import * as dotenv from "dotenv";
import axios from "axios";

// Load environment variables
dotenv.config();

// Retrieve credentials from .env
const apiKey = process.env.azure_api_key;
const endpoint = process.env.AZURE_ENDPOINT;
const deploymentName = "chat-ariA11y"; // Replace with your deployment name

// Function to test the Azure OpenAI API
async function testAzureOpenAI() {
  try {
    const response = await axios.post(
      `${endpoint}openai/deployments/${deploymentName}/completions?api-version=2023-06-01`,
      {
        prompt: "Hello, how are you?",
        max_tokens: 5,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );
    console.log("Response from Azure OpenAI API:", response.data);
  } catch (error) {
    console.error("Error connecting to Azure OpenAI API:", error);
  }
}

// Run the test function
testAzureOpenAI();
