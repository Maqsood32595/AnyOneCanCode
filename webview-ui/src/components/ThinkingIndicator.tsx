import React from 'react';

const ThinkingIndicator: React.FC = () => {
  return (
    <div className="thinking-indicator">
      <div className="thinking-dots">
        <span className="dot"></span>
        <span className="dot"></span>
        <span className="dot"></span>
      </div>
      <span className="thinking-text">AI is thinking...</span>
    </div>
  );
};

export default ThinkingIndicator;
