// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";

// Load .env file
dotenv.config({ path: path.join(__dirname, "..", ".env") });

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "aria11y" is now active!');

  // Register the command to open the Webview
  const disposable = vscode.commands.registerCommand("ai-chat.openChat", () => {
    // Call the function to create the Webview
    createChatWebview(context);
  });

  context.subscriptions.push(disposable);
}

function createChatWebview(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "aiChat", // Identifies the type of the Webview
    "AI Chat", // Title displayed on the tab
    vscode.ViewColumn.One, // Editor column to show the new Webview
    {
      enableScripts: true, // Enable JavaScript in the Webview
    }
  );

  // Set the Webview's HTML content
  panel.webview.html = getWebviewContent();

  panel.webview.onDidReceiveMessage(
    async (message) => {
      console.log("Message received from Webview:", message);
      try {
        switch (message.type) {
          case "message":
            const aiResponse = await getAIResponse(message.text);
            console.log("Sending message to Webview:", {
              text: `AI: ${aiResponse}`,
            });
            panel.webview.postMessage({ text: `AI: ${aiResponse}` });
            break;
        }
      } catch (error) {
        const errorMessage =
          "An error occurred while fetching the AI response.";
        console.error(errorMessage, error);
        panel.webview.postMessage({ text: errorMessage });
      }
    },
    undefined,
    context.subscriptions
  );
}

async function getAIResponse(userInput: string): Promise<string> {
  const endpoint = process.env.AZURE_ENDPOINT;
  const apiKey = process.env.AZURE_API_KEY;
  const deploymentName = "chat-deployment"; // Replace with your deployment name
  const apiVersion = "2023-05-15"; // Use the version you set up

  const url = `${endpoint}/openai/deployments/${deploymentName}/completions?api-version=${apiVersion}`;

  try {
    const response = await axios.post(
      url,
      {
        prompt: `You are a helpful assistant. Respond in clear and concise natural language. Question: "${userInput}"`,

        max_tokens: 10, // Increased for better responses
        temperature: 0.7,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
      }
    );

    console.log("Raw Azure OpenAI Response:", response.data);
    return response.data.choices[0].text.trim();
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        "Azure OpenAI API Error:",
        error.response?.data || error.message
      );
    } else {
      console.error("Unexpected Error:", error);
    }
    throw new Error("Failed to fetch response from Azure OpenAI.");
  }
}

function getWebviewContent(): string {
  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>AI Chat</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  padding: 10px;
              }
              .chat-container {
                  display: flex;
                  flex-direction: column;
                  height: 90vh;
              }
              .chat-messages {
                  flex: 1;
                  overflow-y: auto;
                  border: 1px solid #ccc;
                  padding: 10px;
                  margin-bottom: 10px;
              }
              .chat-input {
                  display: flex;
              }
              .chat-input textarea {
                  flex: 1;
                  height: 50px;
                  padding: 5px;
              }
              .chat-input button {
                  padding: 5px 10px;
                  margin-left: 5px;
              }
          </style>
      </head>
      <body>
          <div class="chat-container">
              <div class="chat-messages" id="chatMessages"></div>
              <div class="chat-input">
                  <textarea id="chatInput" placeholder="Type your message..."></textarea>
                  <button id="sendButton">Send</button>
              </div>
          </div>
          <script>
              const vscode = acquireVsCodeApi();

              // Handle the send button click
              document.getElementById("sendButton").addEventListener("click", () => {
    const input = document.getElementById("chatInput");
    const message = input.value.trim();
    if (message) {
        console.log("Sending message:", message); // Debug log
        vscode.postMessage({ type: "message", text: message });
        input.value = ""; // Clear the input
    }
});

              // Listen for messages from the extension
             window.addEventListener("message", (event) => {
    const message = event.data;
    console.log("Received message:", message); // Debug log
    if (message.text) {
        const chatMessages = document.getElementById("chatMessages");
        const newMessage = document.createElement("div");
        newMessage.textContent = message.text;
        newMessage.style.marginBottom = "5px";
        chatMessages.appendChild(newMessage);

        // Auto-scroll to the bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});




          </script>
      </body>
      </html>
  `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
