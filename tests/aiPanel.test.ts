import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AIPanel } from '../src/aiPanel';

// Mock the vscode module
jest.mock('vscode');

describe('AIPanel', () => {
    let mockPanel: any;
    let mockExtensionUri: vscode.Uri;
    let aiPanel: AIPanel;

    beforeEach(() => {
        // Create mock objects
        mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: jest.fn(),
                postMessage: jest.fn()
            },
            onDidDispose: jest.fn(),
            dispose: jest.fn()
        };

        mockExtensionUri = vscode.Uri.parse('file:///test-extension');
        
        // Create AIPanel instance
        aiPanel = new (AIPanel as any)(mockPanel, mockExtensionUri);
    });

    describe('_getCodebaseContext', () => {
        it('should return active file context when editor is available', async () => {
            const mockEditor = {
                document: {
                    languageId: 'typescript',
                    getText: () => 'const test = "hello";'
                }
            };
            
            (vscode.window.activeTextEditor as any) = mockEditor;
            (vscode.workspace.workspaceFolders as any) = null;

            const context = await (aiPanel as any)._getCodebaseContext();
            
            expect(context).toContain('Current file context:');
            expect(context).toContain('typescript');
            expect(context).toContain('const test = "hello";');
        });

        it('should include workspace structure when workspace is available', async () => {
            (vscode.window.activeTextEditor as any) = null;
            (vscode.workspace.workspaceFolders as any) = [
                { uri: { fsPath: __dirname } }
            ];

            // Mock fs functions
            const originalReadDirSync = fs.readdirSync;
            fs.readdirSync = jest.fn(() => [
                { name: 'test-file.ts', isDirectory: () => false },
                { name: 'src', isDirectory: () => true }
            ] as any);

            const context = await (aiPanel as any)._getCodebaseContext();
            
            expect(context).toContain('Workspace structure:');
            
            // Restore original function
            fs.readdirSync = originalReadDirSync;
        });
    });

    describe('_scanDirectory', () => {
        it('should scan directory structure with limited depth', async () => {
            const testDir = __dirname;
            
            // Mock fs.readdirSync
            const originalReadDirSync = fs.readdirSync;
            fs.readdirSync = jest.fn((dirPath: string, options: any) => {
                if (dirPath === testDir) {
                    return [
                        { name: 'test-file.ts', isDirectory: () => false },
                        { name: 'src', isDirectory: () => true },
                        { name: 'node_modules', isDirectory: () => true },
                        { name: '.git', isDirectory: () => true }
                    ] as any;
                }
                return [] as any;
            });

            const structure = await (aiPanel as any)._scanDirectory(testDir, 2);
            
            expect(structure).toContain('test-file.ts');
            expect(structure).toContain('src/');
            expect(structure).not.toContain('node_modules');
            expect(structure).not.toContain('.git');
            
            // Restore original function
            fs.readdirSync = originalReadDirSync;
        });
    });

    describe('_getGitContext', () => {
        it('should handle git commands gracefully', async () => {
            const testPath = __dirname;
            
            // Mock exec to simulate git commands
            const originalExec = require('child_process').exec;
            require('child_process').exec = jest.fn((command: string, options: any, callback: any) => {
                if (command.includes('git branch')) {
                    callback(null, 'main\n', '');
                } else if (command.includes('git status')) {
                    callback(null, 'M modified-file.ts\n', '');
                } else if (command.includes('git remote')) {
                    callback(null, 'origin\thttps://github.com/test/repo.git (fetch)\n', '');
                } else {
                    callback(new Error('Command not found'), '', '');
                }
            });

            const gitContext = await (aiPanel as any)._getGitContext(testPath);
            
            expect(gitContext).toContain('Git repository status:');
            expect(gitContext).toContain('Current branch: main');
            expect(gitContext).toContain('modified-file.ts');
            expect(gitContext).toContain('origin');
            
            // Restore original function
            require('child_process').exec = originalExec;
        });

        it('should handle git errors gracefully', async () => {
            const testPath = __dirname;
            
            // Mock exec to simulate git not available
            const originalExec = require('child_process').exec;
            require('child_process').exec = jest.fn((command: string, options: any, callback: any) => {
                callback(new Error('git not found'), '', '');
            });

            const gitContext = await (aiPanel as any)._getGitContext(testPath);
            
            expect(gitContext).toContain('Not a git repository or git not available');
            
            // Restore original function
            require('child_process').exec = originalExec;
        });
    });

    describe('_executeGitCommand', () => {
        it('should resolve with stdout on success', async () => {
            const testCommand = 'git --version';
            const testCwd = __dirname;
            
            // Mock exec
            const originalExec = require('child_process').exec;
            require('child_process').exec = jest.fn((command: string, options: any, callback: any) => {
                callback(null, 'git version 2.30.0\n', '');
            });

            const result = await (aiPanel as any)._executeGitCommand(testCommand, testCwd);
            
            expect(result).toBe('git version 2.30.0');
            
            // Restore original function
            require('child_process').exec = originalExec;
        });

        it('should reject with error on failure', async () => {
            const testCommand = 'git invalid-command';
            const testCwd = __dirname;
            
            // Mock exec
            const originalExec = require('child_process').exec;
            require('child_process').exec = jest.fn((command: string, options: any, callback: any) => {
                callback(new Error('Command failed'), '', 'stderr output');
            });

            await expect((aiPanel as any)._executeGitCommand(testCommand, testCwd))
                .rejects
                .toThrow('Command failed');
            
            // Restore original function
            require('child_process').exec = originalExec;
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });
});

// Simple test runner
if (require.main === module) {
    console.log('Running AI Panel tests...');
    
    // This would normally be run with a test framework like Jest
    // For now, we'll just log that tests would run here
    console.log('Tests would execute with a proper test framework setup');
}
