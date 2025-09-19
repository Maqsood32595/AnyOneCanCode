import { useEffect, useRef, useState } from 'react';
import './App.css';
import ChatContainer from './components/ChatContainer';
import InputArea from './components/InputArea';
import { Message } from './types';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Handle messages from the extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case 'addMessage':
          setMessages(prev => [...prev, message.message]);
          break;
        case 'showThinking':
          setIsThinking(message.thinking);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (content: string) => {
    // Send message to extension
    window.vscode.postMessage({
      command: 'sendMessage',
      content
    });
  };

  const handleCommandAction = (action: 'approve' | 'edit' | 'deny', command: string) => {
    window.vscode.postMessage({
      command: `${action}Command`,
      commandText: command
    });
  };

  return (
    <div className="app">
      <ChatContainer
        messages={messages}
        isThinking={isThinking}
        onCommandAction={handleCommandAction}
        ref={chatContainerRef}
      />
      <InputArea onSendMessage={handleSendMessage} />
    </div>
  );
}

export default App;
