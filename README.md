# Anyone Can Code - VS Code Extension

A VS Code extension that helps beginners learn to code with interactive features and helpful tips.

## Features

- **Hello World** - Displays welcome message
- **Coding Tips** - Random programming tips (10 helpful tips)
- **Test Structure Creation** - Generates organized test folders
- **Project Review Prompts** - Preloaded prompts for project-level code review
- **Test Review Prompts** - Preloaded prompts for test-level code review
- **Project Protected Patterns** - Mark project-level code as protected
- **Test Protected Patterns** - Mark test-level code as protected
- **Code Protection Check** - Scan files for protected patterns
- **Pattern Management** - View all protected patterns
- **Git Checkpoint System** - Single-slot local-only checkpoint using Git tags
- Multi-level support for both project and test code

## Getting Started

1. Install the dependencies:
```bash
npm install
```

2. Compile the TypeScript code:
```bash
npm run compile
```

3. Open the project in VS Code and press F5 to run the extension in a new Extension Development Host window

4. In the new window, open the Command Palette (Ctrl+Shift+P) and run:
   - **Basic Commands:**
     - "Anyone Can Code: Hello World" - Welcome message
     - "Anyone Can Code: Get Coding Tip" - Random programming tips
   
   - **Test Management:**
     - "Anyone Can Code: Create Tests Structure" - Generate organized test folders
   
   - **Code Review Prompts:**
     - "Anyone Can Code: Show Project Review Prompt" - Project-level code review questions
     - "Anyone Can Code: Show Test Review Prompt" - Test-level code review questions
   
   - **Code Protection:**
     - "Anyone Can Code: Add Project Protected Pattern" - Protect project-level code
     - "Anyone Can Code: Add Test Protected Pattern" - Protect test-level code
     - "Anyone Can Code: Check Protected Code" - Scan for protected patterns
     - "Anyone Can Code: View Protected Patterns" - View all protected patterns
   
   - **Checkpoint System:**
     - "Anyone Can Code: Show Checkpoint Panel" - Open checkpoint management panel
     - "Anyone Can Code: Create Checkpoint" - Create Git checkpoint (Ctrl+Alt+R / Cmd+Option+R)
     - "Anyone Can Code: Reset to Checkpoint" - Reset to last checkpoint with confirmation

## Project Structure

- `src/extension.ts` - Main extension code
- `package.json` - Extension manifest and dependencies
- `tsconfig.json` - TypeScript configuration
- `out/` - Compiled JavaScript files

## Development

To watch for changes and automatically recompile:
```bash
npm run watch
```

## License

MIT
