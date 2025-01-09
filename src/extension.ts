import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";
import * as fs from "fs";

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

  const filePath: vscode.Uri = vscode.Uri.file(
    path.join(context.extensionPath, "src", "chat.html")
  );

  panel.webview.html = fs.readFileSync(filePath.fsPath, "utf8");

  panel.webview.onDidReceiveMessage(
    async (message) => {
      console.log("Message received from Webview:", message);
      try {
        switch (message.type) {
          case "message":
            const aiResponse = await getAIResponse(message.text);
            console.log("Sending message to Webview:", {
              text: `${aiResponse}`,
            });
            panel.webview.postMessage({ text: `${aiResponse}` });
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
  const url = "http://localhost:5000/search";
  try {
    const response = await axios.post(
      url,
      { message: userInput },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Raw Azure OpenAI Response:", response.data);
    return response.data;
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

// This method is called when your extension is deactivated
export function deactivate() {}
