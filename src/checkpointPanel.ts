import * as vscode from 'vscode';
import { exec } from 'child_process';

export class CheckpointPanel {
	public static currentPanel: CheckpointPanel | undefined;
	private readonly _panel: vscode.WebviewPanel;
	private _disposables: vscode.Disposable[] = [];

	private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
		this._panel = panel;
		this._update();
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
	}

	public static createOrShow(extensionUri: vscode.Uri) {
		const column = vscode.window.activeTextEditor
			? vscode.window.activeTextEditor.viewColumn
			: undefined;

		if (CheckpointPanel.currentPanel) {
			CheckpointPanel.currentPanel._panel.reveal(column);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'checkpoint',
			'Checkpoint',
			column || vscode.ViewColumn.One,
			{
				enableScripts: true,
				localResourceRoots: []
			}
		);

		CheckpointPanel.currentPanel = new CheckpointPanel(panel, extensionUri);
	}

	public dispose() {
		CheckpointPanel.currentPanel = undefined;
		this._panel.dispose();
		while (this._disposables.length) {
			const x = this._disposables.pop();
			if (x) {
				x.dispose();
			}
		}
	}

	public updateStatus(status: string) {
		this._panel.webview.postMessage({
			command: 'updateStatus',
			status: status
		});
	}

	private _update() {
		const webview = this._panel.webview;
		this._panel.webview.html = this._getHtmlForWebview(webview);
	}

	private _getHtmlForWebview(webview: vscode.Webview) {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Checkpoint</title>
    <style>
        body { 
            padding: 10px; 
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
        }
        .checkpoint-section {
            margin-bottom: 15px;
        }
        .status {
            margin: 10px 0;
            padding: 8px;
            background-color: var(--vscode-input-background);
            border-radius: 3px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 2px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div class="checkpoint-section">
        <h3>Checkpoint</h3>
        <div class="status" id="checkpointStatus">No checkpoint saved.</div>
        <button id="checkpointBtn">Checkpoint</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Update status from stored state
        const savedStatus = document.getElementById('checkpointStatus').textContent;
        vscode.setState({ status: savedStatus });
        
        document.getElementById('checkpointBtn').addEventListener('click', () => {
            vscode.postMessage({
                command: 'createCheckpoint'
            });
        });
        
        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateStatus':
                    document.getElementById('checkpointStatus').textContent = message.status;
                    vscode.setState({ status: message.status });
                    break;
            }
        });
    </script>
</body>
</html>`;
	}
}

// Git command execution utility
export function executeGitCommand(command: string, cwd: string): Promise<string> {
	return new Promise((resolve, reject) => {
		exec(command, { cwd }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(stderr || error.message));
			} else {
				resolve(stdout.trim());
			}
		});
	});
}

// Checkpoint creation function
export async function handleCheckpoint(context: vscode.ExtensionContext): Promise<string> {
	if (!vscode.workspace.workspaceFolders) {
		throw new Error('Please open a workspace first!');
	}

	const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
	const timestamp = new Date().toLocaleString('en-US', {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: true
	});

	try {
		// Check if we're in a git repository
		await executeGitCommand('git status', workspacePath);
		
		// Create the floating head checkpoint
		await executeGitCommand('git add .', workspacePath);
		await executeGitCommand('git commit -m "anyonecancode-temp-checkpoint" --no-verify', workspacePath);
		await executeGitCommand('git tag -f anyonecancode-checkpoint', workspacePath);
		await executeGitCommand('git reset --hard HEAD~1', workspacePath);
		
		// Store timestamp in workspace state
		context.workspaceState.update('lastCheckpoint', timestamp);
		
		return timestamp;
	} catch (error) {
		throw new Error(`Checkpoint failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}

// Reset function
export async function handleReset(): Promise<void> {
	if (!vscode.workspace.workspaceFolders) {
		throw new Error('Please open a workspace first!');
	}

	const workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;

	try {
		// Check if checkpoint tag exists
		await executeGitCommand('git rev-parse anyonecancode-checkpoint', workspacePath);
		
		// Show confirmation dialog
		const confirmation = await vscode.window.showInputBox({
			prompt: 'This will revert all uncommitted work to the checkpoint. This cannot be undone. Type "YES" to confirm.',
			placeHolder: 'YES'
		});

		if (confirmation !== 'YES') {
			throw new Error('Reset cancelled by user');
		}

		// Perform the reset
		await executeGitCommand('git reset --hard anyonecancode-checkpoint', workspacePath);
		
	} catch (error) {
		if (error instanceof Error && error.message.includes('Reset cancelled by user')) {
			throw error;
		}
		throw new Error(`No checkpoint found to reset to or reset failed: ${error instanceof Error ? error.message : String(error)}`);
	}
}
