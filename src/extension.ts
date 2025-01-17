import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";
import * as fs from "fs";

dotenv.config({ path: path.join(__dirname, "..", ".env") }); // Load .env file

// ---------- Decoration type for underlining issues
const decorationType = vscode.window.createTextEditorDecorationType({
  textDecoration: "underline red wavy",
});

// ========================================================
// Activate Function
// ========================================================

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "aria11y" is now active!');

  // Automatically analyze files for accessibility issues
  vscode.workspace.onDidOpenTextDocument(async (document) => {
    const editor = vscode.window.activeTextEditor;
    if (
      !editor ||
      (document.languageId !== "html" && document.languageId !== "javascript")
    ) {
      return; // Only analyze HTML and JavaScript files
    }
    const issues = await analyzeFileForIssues();
    underlineIssues(issues);
  });

  // ----------Command to manually analyze and underline issues----------
  const underlineCommand = vscode.commands.registerCommand(
    "aria11y.underlineIssues",
    async () => {
      const issues = await analyzeFileForIssues();
      underlineIssues(issues);
    }
  );

  context.subscriptions.push(underlineCommand);

  // ---------Function to underline issues in the editor----------
  function underlineIssues(issues: { range: vscode.Range; message: string }[]) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found!");
      return;
    }

    const decorations = issues.map((issue) => ({
      range: issue.range,
      hoverMessage: issue.message, // Tooltip on hover
    }));

    editor.setDecorations(decorationType, decorations);
  }

  const disposable = vscode.commands.registerCommand(
    "ai-chat.openChat",
    (selection?: string) => {
      createChatWebview(context, selection);
    }
  );

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

// ========================================================
// createChatWebview Function
// ========================================================

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

  // Send the selection to the Webview, and only send this if actually got a selection

  if (selection && selection.trim() !== "") {
    panel.webview.postMessage({ type: "selection", text: selection });
  }

  //check msg is being sent
  console.log("Sending selection to Webview:", selection);

  panel.webview.onDidReceiveMessage(
    async (message) => {
      console.log("Message received from Webview:", message); // Debugging log
      try {
        if (message.type === "message") {
          const response = await getAIResponse(message.text); // Send to AI
          console.log("AI Response:", response); // Debugging log

          // Use only the ai_response for the chat
          const aiChatResponse = response.ai_response;

          panel.webview.postMessage({ text: aiChatResponse }); // Send back to Webview
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          panel.webview.postMessage({
            text: `Error: ${error.response?.data || error.message}`,
          });
        } else if (error instanceof Error) {
          panel.webview.postMessage({ text: `Error: ${error.message}` });
        } else {
          panel.webview.postMessage({ text: "An unknown error occurred." });
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

// ========================================================
// getAIResponse Function
// ========================================================

async function getAIResponse(userInput: string): Promise<any> {
  console.log("Sending query to AI backend:", userInput); // Debugging log
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
    console.log("AI Backend Response:", response.data); // Debugging log
    return response.data; // Return full response (ai_response and issues)
  } catch (error: unknown) {
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

// ========================================================
// analyzeFileForIssues Function
// ========================================================

async function analyzeFileForIssues(): Promise<
  { range: vscode.Range; message: string }[]
> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return [];

  const document = editor.document;
  const fileContent = document.getText(); // Get the entire file content

  try {
    const response = await axios.post("http://localhost:5000/search", {
      message: fileContent,
    });

    return response.data.issues.map((issue: any) => {
      // Because the AI returns line/column as 1-based
      const range = new vscode.Range(
        new vscode.Position(issue.start_line - 1, issue.start_column - 1),
        new vscode.Position(issue.end_line - 1, issue.end_column - 1)
      );
      return { range, message: issue.description };
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      vscode.window.showErrorMessage(
        `Failed to analyze file: ${error.response?.data || error.message}`
      );
    } else if (error instanceof Error) {
      vscode.window.showErrorMessage(
        `Unexpected error occurred: ${error.message}`
      );
    } else {
      vscode.window.showErrorMessage("An unknown error occurred.");
    }
    return [];
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
