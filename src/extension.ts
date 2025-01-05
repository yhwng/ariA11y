import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";

dotenv.config({ path: path.join(__dirname, "..", ".env") }); // Load .env file

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "aria11y" is now active!');

  const disposable = vscode.commands.registerCommand("ai-chat.openChat", () => {
    createChatWebview(context);
  });

  context.subscriptions.push(disposable);
}

function createChatWebview(context: vscode.ExtensionContext) {
  const panel = vscode.window.createWebviewPanel(
    "aiChat",
    "AI Chat",
    vscode.ViewColumn.One,
    {
      enableScripts: true, // Enable JavaScript in the Webview
    }
  );

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
  const deploymentName = "gpt-4o-mini";
  const apiVersion = "2024-08-01-preview";

  const url = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;

  try {
    const response = await axios.post(
      url,
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: userInput },
        ],
        max_tokens: 50,
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
    return response.data.choices[0].message.content.trim();
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

function getWebviewContent(cspSource?: string): string {
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
                background-color: #1f1f1f;
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
            .message {
                margin-bottom: 10px;
                padding: 5px;
                border-radius: 5px;
            }
            .user-message {
                
                align-self: flex-end;
                text-align: right;
            }
            .ai-message {
                
                align-self: flex-start;
                text-align: left;
            }
            .chat-input {
                display: flex;
            }
            .chat-input textarea {
                flex: 1;
                height: 50px;
                padding: 5px;
                background-color: #1f1f1f;
               color: rgb(244, 244, 244);
            }
            .chat-input button {
                padding: 5px 10px;
                margin-left: 5px;
                background-color: #1f1f1f;
                color: rgb(244, 244, 244);
            }
            .loading {
                font-size: 0.9em;
                color: gray;
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
            const chatMessages = document.getElementById("chatMessages");

            function addMessage(content, isUser = false, isLoading = false) {
                const messageDiv = document.createElement("div");
                messageDiv.className = isUser
                    ? "message user-message"
                    : "message ai-message";
                messageDiv.textContent = isLoading ? "..." : content;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight; // Auto-scroll
            }

            document.getElementById("sendButton").addEventListener("click", () => {
                const input = document.getElementById("chatInput");
                const message = input.value.trim();
                if (message) {
                    addMessage(message, true); // Add user message
                    addMessage("", false, true); // Add loading indicator
                    vscode.postMessage({ type: "message", text: message });
                    input.value = "";
                }
            });

            window.addEventListener("message", (event) => {
                const message = event.data;
                const loadingIndicator = chatMessages.querySelector(
                    ".ai-message:last-child"
                );
                if (loadingIndicator) loadingIndicator.remove(); // Remove loading

                if (message.text) {
                    addMessage(message.text, false); // Add AI message
                }
            });
        </script>
    </body>
    </html>
  `;
}

// This method is called when your extension is deactivated
export function deactivate() {}
