import React from 'react';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
  onCommandAction: (action: 'approve' | 'edit' | 'deny', command: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onCommandAction }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  // Check if message contains command proposals
  const hasCommandProposal = message.content.includes('💻 Proposed command:');

  const renderContent = () => {
    if (hasCommandProposal) {
      return renderCommandProposal();
    }

    return (
      <div className="message-content">
        {message.content}
      </div>
    );
  };

  const renderCommandProposal = () => {
    const lines = message.content.split('\n');
    const description = lines[0].replace('💻 Proposed command:', '').trim();
    const commandMatch = message.content.match(/```bash\n([\s\S]*?)\n```/);
    const command = commandMatch ? commandMatch[1].trim() : '';

    return (
      <div className="command-proposal">
        <div className="command-description">{description}</div>
        {command && (
          <>
            <pre className="command-code">{command}</pre>
            <div className="command-actions">
              <button
                className="approve-btn"
                onClick={() => onCommandAction('approve', command)}
              >
                ✅ Approve
              </button>
              <button
                className="edit-btn"
                onClick={() => onCommandAction('edit', command)}
              >
                ✏️ Edit
              </button>
              <button
                className="deny-btn"
                onClick={() => onCommandAction('deny', command)}
              >
                ❌ Deny
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'} ${isSystem ? 'system' : ''}`}>
      <div className="message-header">
        <span className="message-role">{isUser ? 'You' : 'AI Assistant'}</span>
        <span className="message-time">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {renderContent()}
    </div>
  );
};

export default MessageBubble;
