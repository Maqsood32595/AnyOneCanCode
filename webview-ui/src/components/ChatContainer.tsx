import { forwardRef } from 'react';
import { Message } from '../types';
import MessageBubble from './MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';

interface ChatContainerProps {
  messages: Message[];
  isThinking: boolean;
  onCommandAction: (action: 'approve' | 'edit' | 'deny', command: string) => void;
}

const ChatContainer = forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ messages, isThinking, onCommandAction }, ref) => {
    return (
      <div ref={ref} className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <MessageBubble
              key={index}
              message={message}
              onCommandAction={onCommandAction}
            />
          ))}
          {isThinking && <ThinkingIndicator />}
        </div>
      </div>
    );
  }
);

export default ChatContainer;
