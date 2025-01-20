import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";
import * as fs from "fs";

dotenv.config({ path: path.join(__dirname, "..", ".env") }); // Load .env file

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "aria11y" is now active!');

  const disposable = vscode.commands.registerCommand(
    "ai-chat.openChat",
    (selection?: string) => {
      createChatWebview(context, selection);
    }
  );

  //underline issues command
  const underlineCommand = vscode.commands.registerCommand(
    "aria11y.underlineIssues",
    () => {
      underlineIssues(mockIssues); // Use mock data
    }
  );

  context.subscriptions.push(underlineCommand);

  //right click open chat command
  vscode.commands.registerCommand("aria11y.chatWithSelection", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found!");
      return;
    }

    // Get selected text
    const selection = editor.document.getText(editor.selection);
    if (!selection) {
      vscode.window.showErrorMessage("No text selected!");
      return;
    }

    // Pass selection to AI Chat
    vscode.commands.executeCommand("ai-chat.openChat", selection);
  });

  context.subscriptions.push(disposable);
}

//const

const decorationType = vscode.window.createTextEditorDecorationType({
  textDecoration: "underline red wavy",
});

//mock issue

const mockIssues = [
  {
    range: new vscode.Range(
      new vscode.Position(2, 0),
      new vscode.Position(2, 20)
    ),
    message: "Accessibility issue: Missing alt attribute for an image.",
  },
  {
    range: new vscode.Range(
      new vscode.Position(5, 10),
      new vscode.Position(5, 30)
    ),
    message: "Accessibility issue: Improper heading level.",
  },
];

//underline issues function
function underlineIssues(issues: { range: vscode.Range; message: string }[]) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active editor found!");
    return;
  }

  // Apply decorations
  const decorations = issues.map((issue) => ({
    range: issue.range,
    hoverMessage: issue.message, // Message on hover
  }));

  editor.setDecorations(decorationType, decorations);
}

//create chat web view

function createChatWebview(
  context: vscode.ExtensionContext,
  selection?: string
) {
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

  // Send the selection to the Webview
  panel.webview.postMessage({ type: "selection", text: selection });

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
