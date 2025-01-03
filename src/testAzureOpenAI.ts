import * as dotenv from "dotenv";
import axios from "axios";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const apiKey = process.env.AZURE_API_KEY_1;
const endpoint = process.env.AZURE_ENDPOINT;
const deploymentName = "chat-ariA11y"; // Updated with your deployment name

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
    console.log("Response:", response.data);
  } catch (error: any) {
    console.error(
      "Error testing Azure OpenAI API:",
      error.response?.data || error.message
    );
  }
}

testAzureOpenAI();
