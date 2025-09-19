import { exec } from 'child_process';
import * as fs from 'fs';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';

export class AIPanel {
	public static currentPanel: AIPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private _disposables: vscode.Disposable[] = [];
	private _chatHistory: Array<{ role: string; content: string; timestamp: Date }> = [];
	private _sessionCache: Map<string, any> = new Map();

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._extensionUri = extensionUri;
		this._update();
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from webview
		this._panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case 'sendMessage':
						await this._handleUserMessage(message.content);
						break;
					case 'copyCode':
						await vscode.env.clipboard.writeText(message.code);
						vscode.window.showInformationMessage('Code copied to clipboard!');
						break;
					case 'insertCode':
						await this._insertCodeIntoActiveFile(message.code);
						break;
					case 'approveCommand':
						await this._executeTerminalCommand(message.command, false);
						break;
					case 'editCommand':
						const editedCommand = await vscode.window.showInputBox({
							value: message.command,
							prompt: 'Edit the command:',
							placeHolder: 'Enter terminal command'
						});
						if (editedCommand) {
							await this._executeTerminalCommand(editedCommand, false);
						}
						break;
					case 'denyCommand':
						this._addToChatHistory('assistant', 'Command execution cancelled by user.', true);
						break;
				}
			},
			null,
			this._disposables
		);
	}

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (AIPanel.currentPanel) {
			AIPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'aiChat',
			'AnyoneCanCode AI',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: [extensionUri],
				retainContextWhenHidden: true
			}
		);

		AIPanel.currentPanel = new AIPanel(panel, extensionUri);
	}

	public dispose() {
		AIPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	private async _handleUserMessage(content: string) {
		this._addToChatHistory('user', content, true);

		// Show thinking indicator
		this._panel.webview.postMessage({
			command: 'showThinking',
			thinking: true
		});

		try {
			const codebaseContext = await this._getCodebaseContext();
			const response = await this._callOpenRouterAPI(content, codebaseContext);
			this._addToChatHistory('assistant', response, true);

		} catch (error) {
			const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
			this._addToChatHistory('assistant', errorMessage, true);
		} finally {
			this._panel.webview.postMessage({
				command: 'showThinking',
				thinking: false
			});
		}
	}

	private async _getCodebaseContext(): Promise<string> {
		let context = '';

		// Get active file context
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			context += `Current file context:\n\`\`\`${activeEditor.document.languageId}\n${activeEditor.document.getText()}\n\`\`\`\n\n`;
		}

		// Get workspace structure
		if (vscode.workspace.workspaceFolders) {
			const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
			context += await this._getWorkspaceStructure(workspacePath);
			context += await this._getGitContext(workspacePath);
		}

		return context;
	}

	private async _getWorkspaceStructure(workspacePath: string): Promise<string> {
		try {
			const structure = await this._scanDirectory(workspacePath, 2); // 2 levels deep
			return `Workspace structure:\n\`\`\`\n${structure}\n\`\`\`\n\n`;
		} catch (error) {
			return 'Workspace structure: Unable to scan directory\n\n';
		}
	}

	private async _scanDirectory(dirPath: string, maxDepth: number, currentDepth: number = 0): Promise<string> {
		if (currentDepth > maxDepth) {
			return '';
		}

		try {
			const items = fs.readdirSync(dirPath, { withFileTypes: true });
			let structure = '';

			for (const item of items) {
				const fullPath = path.join(dirPath, item.name);

				// Skip node_modules, .git, and other common directories
				if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'out') {
					continue;
				}

				const indent = '  '.repeat(currentDepth);

				if (item.isDirectory()) {
					structure += `${indent}📁 ${item.name}/\n`;
					if (currentDepth < maxDepth) {
						const subStructure = await this._scanDirectory(fullPath, maxDepth, currentDepth + 1);
						structure += subStructure;
					}
				} else {
					const ext = path.extname(item.name);
					if (['.ts', '.js', '.py', '.java', '.c', '.cpp', '.html', '.css', '.json', '.xml'].includes(ext)) {
						structure += `${indent}📄 ${item.name}\n`;
					}
				}
			}

			return structure;
		} catch (error) {
			return '';
		}
	}

	private async _getGitContext(workspacePath: string): Promise<string> {
		try {
			const gitStatus = await this._executeGitCommand('git status --short', workspacePath);
			const gitBranch = await this._executeGitCommand('git branch --show-current', workspacePath);
			const gitRemote = await this._executeGitCommand('git remote -v', workspacePath);

			let gitContext = 'Git repository status:\n';

			if (gitBranch) {
				gitContext += `Current branch: ${gitBranch}\n`;
			}

			if (gitStatus) {
				gitContext += `Changes:\n\`\`\`\n${gitStatus}\n\`\`\`\n`;
			}

			if (gitRemote) {
				gitContext += `Remotes:\n\`\`\`\n${gitRemote}\n\`\`\`\n`;
			}

			return gitContext + '\n';
		} catch (error) {
			return 'Git repository: Not a git repository or git not available\n\n';
		}
	}

	private _executeGitCommand(command: string, cwd: string): Promise<string> {
		return new Promise((resolve, reject) => {
			exec(command, { cwd }, (error, stdout, stderr) => {
				if (error) {
					reject(error);
				} else {
					resolve(stdout.trim());
				}
			});
		});
	}

	private async _executeTerminalCommand(command: string, autoApproved: boolean = false) {
		if (!vscode.workspace.workspaceFolders) {
			vscode.window.showErrorMessage('Please open a workspace first!');
			return;
		}

		const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

		try {
			// Create a terminal specifically for AI commands
			const terminal = vscode.window.createTerminal('AnyoneCanCode Terminal');
			terminal.show();

			// Change to workspace directory and execute command
			terminal.sendText(`cd "${workspacePath.replace(/"/g, '\\"')}"`);

			if (!autoApproved) {
				this._addToChatHistory('system', `✅ Executing command: \`${command}\``, true);
				vscode.window.showInformationMessage(`Executing command: ${command}`);
			}

			// Store command in session for potential auto-approval of repeated commands
			this._sessionCache.set(command, { executed: true, success: null });

			// For simple commands, we can capture output using exec
			if (this._isSimpleCommand(command)) {
				this._executeAndCaptureOutput(command, workspacePath);
			} else {
				// For complex commands, just execute in terminal
				terminal.sendText(command);
			}

		} catch (error) {
			const errorMessage = `❌ Command execution failed: ${error instanceof Error ? error.message : String(error)}`;
			this._addToChatHistory('system', errorMessage, true);
			vscode.window.showErrorMessage(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private _isSimpleCommand(command: string): boolean {
		// Commands that can be safely executed with exec and capture output
		const simpleCommands = [
			'git status', 'git branch', 'git remote', 'git log',
			'npm install', 'npm test', 'npm run', 'yarn install',
			'ls', 'dir', 'pwd', 'echo', 'cat', 'head', 'tail'
		];

		return simpleCommands.some(cmd => command.trim().startsWith(cmd));
	}

	private async _executeAndCaptureOutput(command: string, cwd: string) {
		try {
			const output = await new Promise<string>((resolve, reject) => {
				exec(command, { cwd }, (error, stdout, stderr) => {
					if (error) {
						reject(error);
					} else {
						resolve(stdout || stderr);
					}
				});
			});

			// Send output back to AI for analysis
			this._addToChatHistory('system', `📋 Command output:\n\`\`\`\n${output}\n\`\`\``, true);

			// Automatically feed output to AI for next steps
			setTimeout(() => {
				this._panel.webview.postMessage({
					command: 'autoContinue',
					output: output
				});
			}, 1000);

		} catch (error) {
			const errorOutput = `❌ Command failed: ${error instanceof Error ? error.message : String(error)}`;
			this._addToChatHistory('system', errorOutput, true);
		}
	}

	private async _callOpenRouterAPI(userMessage: string, fileContext: string): Promise<string> {
		const config = vscode.workspace.getConfiguration('anyoneCanCode');
		const apiKey = config.get<string>('openRouterApiKey');
		const model = config.get<string>('preferredModel') || 'openai/gpt-3.5-turbo';

		if (!apiKey) {
			throw new Error('OpenRouter API key not configured. Please set it in extension settings.');
		}

		const messages = [
			{
				role: 'system',
				content: `You are a helpful AI coding assistant integrated with VS Code. You have access to the user's complete codebase context including:

1. Current file being edited
2. Workspace structure and file hierarchy
3. Git repository status (branch, changes, remotes)

IMPORTANT: You can propose terminal commands to help the user. When suggesting terminal commands:

1. ALWAYS format commands in \`\`\`bash code blocks
2. Start with "💻 Proposed command:" 
3. Explain what the command will do
4. Only suggest safe, non-destructive commands
5. Wait for user approval before execution

Example format:
💻 Proposed command: This will install dependencies
\`\`\`bash
npm install
\`\`\`

DANGEROUS COMMANDS TO AVOID:
- rm -rf / or rm -rf ~/ or any recursive delete
- Any command with > /dev/null or similar redirection that hides output
- Commands that modify system files outside the project
- Commands that could cause data loss

Safe commands include:
- npm install, yarn install, pip install
- git commands (status, add, commit, push, pull)
- build commands (npm run build, make)
- test commands (npm test, pytest)
- file operations within project directory

Codebase Context:
${fileContext}`
			},
			...this._chatHistory.slice(-10).map(msg => ({
				role: msg.role,
				content: msg.content
			})),
			{
				role: 'user',
				content: userMessage
			}
		];

		const requestData = JSON.stringify({
			model,
			messages,
			max_tokens: 2000
		});

		return new Promise((resolve, reject) => {
			const req = https.request({
				hostname: 'openrouter.ai',
				path: '/api/v1/chat/completions',
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`,
					'HTTP-Referer': 'https://github.com/Maqsood32595/AnyOneCanCode',
					'X-Title': 'AnyoneCanCode VS Code Extension'
				}
			}, (res) => {
				let data = '';

				res.on('data', (chunk) => {
					data += chunk;
				});

				res.on('end', () => {
					try {
						const response = JSON.parse(data);
						if (response.choices && response.choices[0] && response.choices[0].message) {
							resolve(response.choices[0].message.content);
						} else if (response.error) {
							reject(new Error(response.error.message));
						} else {
							reject(new Error('Invalid response from OpenRouter API'));
						}
					} catch (error) {
						reject(error);
					}
				});
			});

			req.on('error', (error) => {
				reject(error);
			});

			req.write(requestData);
			req.end();
		});
	}

	private async _insertCodeIntoActiveFile(code: string) {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage('No active editor found!');
			return;
		}

		await editor.edit(editBuilder => {
			if (editor.selection.isEmpty) {
				// Insert at cursor position
				editBuilder.insert(editor.selection.active, code);
			} else {
				// Replace selection
				editBuilder.replace(editor.selection, code);
			}
		});

		vscode.window.showInformationMessage('Code inserted successfully!');
	}

	private _addToChatHistory(role: string, content: string, updateWebview: boolean = false) {
		const message = { role, content, timestamp: new Date() };
		this._chatHistory.push(message);

		if (updateWebview) {
			this._panel.webview.postMessage({
				command: 'addMessage',
				message: message
			});
		}
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		// Get the path to the built React files
		const scriptPath = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'build', 'assets', 'index.js');
		const scriptUri = webview.asWebviewUri(scriptPath);

		const cssPath = vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'build', 'assets', 'index.css');
		const cssUri = webview.asWebviewUri(cssPath);

		// Get nonce for CSP
		const nonce = getNonce();

		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} ${cssUri}; script-src 'nonce-${nonce}' ${scriptUri};">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AnyoneCanCode AI</title>
    <link href="${cssUri}" rel="stylesheet">
</head>
<body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
