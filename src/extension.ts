import * as vscode from "vscode";
import * as dotenv from "dotenv";
import * as path from "path";
import axios from "axios";
import * as fs from "fs";

dotenv.config({ path: path.join(__dirname, "..", ".env") }); // Load .env file

var errorCount: number = 0;

// ---------- Decoration type for underlining issues
const decorationType = vscode.window.createTextEditorDecorationType({
  textDecoration: "underline red wavy",
});

export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "aria11y" is now active!');

  // ----------Command to analyze and underline issues----------
  const underlineCommand = vscode.commands.registerCommand(
    "aria11y.underlineIssues",
    async () => {
      errorCount = 0;
      const issues = await analyzeFileForIssues();
      if (errorCount > 0) {
        underlineIssues(issues);
        vscode.window.showInformationMessage(errorCount + " issues found.");
      } else {
        vscode.window.showInformationMessage("No issues found.");
      }
    }
  );

  context.subscriptions.push(underlineCommand);

  // ----------Run underline on save----------
  vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage("No active editor found!");
      return;
    }
    editor.setDecorations(decorationType, []); // Clear existing decorations
    vscode.window.showInformationMessage(
      "Checking for accessibility issues..."
    );
    vscode.commands.executeCommand("aria11y.underlineIssues");
  });

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

  const chat = vscode.commands.registerCommand(
    "ai-chat.openChat",
    (selection?: string) => {
      createChatWebview(context, selection);
    }
  );

  context.subscriptions.push(chat);

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
}

// ========================================================
// createChatWebview Function
// ========================================================

let panel: vscode.WebviewPanel | undefined;

function createChatWebview(
  context: vscode.ExtensionContext,
  selection?: string
) {
  // Prevent opening multiple chat windows
  if (panel) {
    panel.reveal(vscode.ViewColumn.Two);
  } else {
    panel = vscode.window.createWebviewPanel(
      "aiChat",
      "AI Chat",
      vscode.ViewColumn.Two,
      {
        enableScripts: true, // Enable JavaScript in the Webview
      }
    );

    const filePath: vscode.Uri = vscode.Uri.file(
      path.join(context.extensionPath, "src", "chat.html")
    );

    panel.webview.html = fs.readFileSync(filePath.fsPath, "utf8");

    panel.onDidDispose(() => {
      panel = undefined;
    });

    panel?.webview.onDidReceiveMessage(
      async (message) => {
        console.log("Message received from Webview:", message); // Debugging log
        try {
          if (message) {
            const response = await getAIResponse(
              message.text,
              message.type,
              message.rag
            ); // Send to AI
            console.log("AI Response:", response); // Debugging log

            const aiChatResponse =
              message.type === "code" ? response.full_responses : response;

            panel?.webview.postMessage({
              type: message.type,
              text: aiChatResponse,
              rag: message.rag,
            }); // Send back to Webview
          }
        } catch (error: unknown) {
          if (axios.isAxiosError(error)) {
            panel?.webview.postMessage({
              type: "error",
              text: `Error: ${error.response?.data || error.message}`,
              rag: false,
            });
          } else if (error instanceof Error) {
            panel?.webview.postMessage({
              type: "error",
              text: `Error: ${error.message}`,
              rag: false,
            });
          } else {
            panel?.webview.postMessage({
              type: "error",
              text: "An unknown error occurred.",
              rag: false,
            });
          }
        }
      },
      undefined,
      context.subscriptions
    );
  }
  if (selection && selection.trim() !== "") {
    panel.webview.postMessage({
      type: "selection",
      text: selection,
    });
  }
}

// ========================================================
// getAIResponse Function
// ========================================================

async function getAIResponse(
  userInput: string,
  type: string,
  rag: boolean
): Promise<any> {
  console.log("Sending query to backend:", userInput); // Debugging log
  const url =
    type === "code"
      ? "http://localhost:5000/code"
      : "http://localhost:5000/chat";
  console.log("url:", url);
  try {
    const response = await axios.post(
      url,
      { message: userInput, rag: rag },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Response:", response.data); // Debugging log
    return response.data;
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
  {
    range: vscode.Range;
    message: string;
  }[]
> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return [];
  }

  const document = editor.document;
  const fileContent = document.getText(); // Get the entire file content

  try {
    const response = await axios.post("http://localhost:5000/code", {
      message: fileContent,
      rag: true,
    });
    console.log("fileContent", fileContent);
    const errorLines = response.data.error_snippets;
    const fileLines: string[] = fileContent.split(/\r?\n/);

    let final: any[] = [];

    console.log("errorLines", errorLines);
    console.log("fileLines", fileLines);

    // Find if the error line is present in the file content
    errorLines.forEach((errorLine: any, index: number) => {
      if (errorLine !== "") {
        errorCount++;
        const trimmedErrorLine = errorLine.trim();
        for (let i = 0; i < fileLines.length; i++) {
          const fileLine = fileLines[i];
          const trimmedLine = fileLine.trim();
          if (trimmedErrorLine.includes(trimmedLine)) {
            const errorRange = new vscode.Range(
              new vscode.Position(i, fileLine.length - trimmedLine.length), // Offset indentation
              new vscode.Position(i, fileLine.length)
            );
            const errorMessage = response.data.full_responses[index];
            final.push({ range: errorRange, message: errorMessage });
          }
        }
      }
      final.push({
        range: new vscode.Range(
          new vscode.Position(0, 0),
          new vscode.Position(0, 0)
        ),
        message: "",
      });
    });
    return final;
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
