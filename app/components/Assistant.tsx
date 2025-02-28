'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  documents?: DocumentInfo[];
  error?: boolean;
}

interface DocumentInfo {
  id: string;
  document_id: string;
  title: string;
  content: string;
  page_number?: number;
  source_type: string;
}

interface QueryResponse {
  answer: string;
  documents: DocumentInfo[];
}

export default function Assistant({ userId }: { userId: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your personal assistant. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [retryingMessage, setRetryingMessage] = useState<string | null>(null);

  // Load conversation history from localStorage when component mounts
  useEffect(() => {
    if (!userId) return;
    
    const savedMessages = localStorage.getItem(`chat_history_${userId}`);
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // Convert string timestamps back to Date objects
        const messagesWithDateObjects = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDateObjects);
      } catch (error) {
        console.error('Error parsing saved messages:', error);
      }
    }
  }, [userId]);

  // Save conversation history to localStorage when messages change
  useEffect(() => {
    if (!userId || messages.length <= 1) return;
    
    localStorage.setItem(`chat_history_${userId}`, JSON.stringify(messages));
  }, [messages, userId]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-focus input on component mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Clear conversation history
  const handleClearConversation = () => {
    if (window.confirm('Are you sure you want to clear this conversation?')) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hello! I\'m your personal assistant. How can I help you today?',
          timestamp: new Date()
        }
      ]);
      localStorage.removeItem(`chat_history_${userId}`);
    }
  };

  // Auto-resize textarea based on content
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Function to handle clicking on a suggested question
  const handleSuggestedQuestion = (question: string) => {
    // Instead of sending directly, populate the input field
    setInputValue(question);
    
    // Focus the input field
    inputRef.current?.focus();
    
    // Adjust the height of the textarea
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  };

  // Function to retry a failed message
  const retryMessage = async (messageContent: string) => {
    if (isLoading) return;
    
    setRetryingMessage(messageContent);
    setIsLoading(true);
    
    try {
      const response = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageContent,
          user_id: userId
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data: QueryResponse = await response.json();
      
      // Remove the error message and add the new response
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => 
          !(msg.role === 'assistant' && msg.content.includes('I encountered an error') && msg.content.includes(messageContent))
        );
        
        return [...filteredMessages, {
          role: 'assistant' as const,
          content: data.answer,
          timestamp: new Date(),
          documents: data.documents
        }];
      });
      
      toast.success('Successfully retrieved response');
    } catch (error) {
      console.error('Error retrying query:', error);
      toast.error('Failed to get a response again. Please try a different question.');
    } finally {
      setIsLoading(false);
      setRetryingMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;
    
    const userMessage = {
      role: 'user' as const,
      content: inputValue.trim(),
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    
    // Remove client-side greeting and thank you handling
    // All messages will be sent to the backend API
    
    try {
      const response = await fetch('http://localhost:8000/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          user_id: userId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to get response');
      }
      
      const data: QueryResponse = await response.json();
      
      const assistantMessage = {
        role: 'assistant' as const,
        content: data.answer,
        timestamp: new Date(),
        documents: data.documents
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error querying assistant:', error);
      toast.error('Failed to get a response. Please try again.');
      
      const errorMessage = {
        role: 'assistant' as const,
        content: `I'm sorry, I encountered an error while processing your request: "${userMessage.content}". You can try again or ask a different question.`,
        timestamp: new Date(),
        error: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
      <div className="p-6 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Assistant</h2>
          <p className="text-gray-600">Ask me anything about your emails, calendar, or documents</p>
        </div>
        <button
          onClick={handleClearConversation}
          className="text-gray-500 hover:text-gray-700 transition-colors p-2"
          title="Clear conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div 
            key={index} 
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-2xl p-4 ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white rounded-tr-none' 
                  : message.error 
                    ? 'bg-red-50 text-gray-800 rounded-tl-none border border-red-200' 
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
              }`}
            >
              {message.role === 'user' ? (
                <div className="whitespace-pre-wrap">{message.content}</div>
              ) : (
                <div className="markdown-content prose prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({node, ...props}) => <p className="mb-2 whitespace-pre-line" {...props} />,
                      h1: ({node, ...props}) => <h1 className="text-xl font-bold mb-2 mt-3" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-lg font-bold mb-2 mt-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-md font-bold mb-1 mt-2" {...props} />,
                      ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                      ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                      li: ({node, ...props}) => <li className="mb-1" {...props} />,
                      a: ({node, ...props}) => <a className="text-blue-600 hover:underline" {...props} />,
                      code: ({inline, className, children, ...props}: any) => 
                        inline 
                          ? <code className="bg-gray-200 px-1 py-0.5 rounded text-sm" {...props}>{children}</code>
                          : <code className="block bg-gray-200 p-2 rounded text-sm overflow-x-auto my-2 whitespace-pre" {...props}>{children}</code>,
                      pre: ({node, ...props}) => <pre className="bg-gray-200 p-2 rounded overflow-x-auto my-2 whitespace-pre" {...props} />,
                      blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-3 italic my-2" {...props} />,
                      table: ({node, ...props}) => <table className="border-collapse border border-gray-300 my-2 w-full" {...props} />,
                      th: ({node, ...props}) => <th className="border border-gray-300 p-2 bg-gray-200" {...props} />,
                      td: ({node, ...props}) => <td className="border border-gray-300 p-2" {...props} />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
              <div 
                className={`text-xs mt-1 ${
                  message.role === 'user' 
                    ? 'text-blue-100' 
                    : message.error 
                      ? 'text-red-400' 
                      : 'text-gray-500'
                }`}
              >
                {formatTime(message.timestamp)}
              </div>
              
              {message.role === 'assistant' && message.documents && message.documents.length > 0 && (
                <SourceDocuments documents={message.documents} />
              )}
              
              {message.role === 'assistant' && message.error && (
                <div className="mt-2">
                  <button
                    onClick={() => {
                      // Extract the query from the error message
                      const match = message.content.match(/"([^"]+)"/);
                      if (match && match[1]) {
                        retryMessage(match[1]);
                      }
                    }}
                    disabled={isLoading || retryingMessage !== null}
                    className="text-xs bg-white text-blue-600 border border-blue-200 rounded-full px-3 py-1.5 hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {retryingMessage ? 'Retrying...' : 'Retry'}
                  </button>
                </div>
              )}
              
              {/* Show suggested questions after the first assistant message if there are only 1-2 messages */}
              {message.role === 'assistant' && messages.length <= 2 && index === 0 && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-500 mb-2">Try asking:</div>
                  <div className="flex flex-wrap gap-2">
                    <SuggestedQuestion 
                      question="What emails did I receive from John last week?" 
                      onClick={handleSuggestedQuestion} 
                    />
                    <SuggestedQuestion 
                      question="Do I have any meetings scheduled for tomorrow?" 
                      onClick={handleSuggestedQuestion} 
                    />
                    <SuggestedQuestion 
                      question="What's in my knowledge base about project planning?" 
                      onClick={handleSuggestedQuestion} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl p-4 bg-gray-100 text-gray-800 rounded-tl-none">
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={handleTextareaChange}
            placeholder="Type your message..."
            className="w-full p-4 pr-16 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50 resize-none overflow-hidden"
            style={{ minHeight: '56px', maxHeight: '120px' }}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 rounded-lg bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function SourceDocuments({ documents }: { documents: DocumentInfo[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (documents.length === 0) return null;
  
  return (
    <div className="mt-3 pt-3 border-t border-gray-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs flex items-center text-gray-500 hover:text-gray-700 transition-colors"
      >
        <span>{isExpanded ? 'Hide' : 'Show'} {documents.length} source{documents.length !== 1 ? 's' : ''}</span>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className={`h-3 w-3 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="mt-2 space-y-2 text-xs">
          {documents.map((doc, index) => (
            <div key={index} className="p-2 bg-white rounded border border-gray-200">
              <div className="font-medium">{doc.title || 'Document'}</div>
              {doc.source_type && (
                <div className="text-gray-500 mb-1">
                  Source: {doc.source_type.charAt(0).toUpperCase() + doc.source_type.slice(1)}
                  {doc.page_number && ` (Page ${doc.page_number})`}
                </div>
              )}
              <div className="text-gray-700 line-clamp-3">{doc.content}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Component for suggested questions
function SuggestedQuestion({ question, onClick }: { question: string; onClick: (question: string) => void }) {
  return (
    <button
      onClick={() => onClick(question)}
      className="text-xs bg-white text-blue-600 border border-blue-200 rounded-full px-3 py-1.5 hover:bg-blue-50 transition-colors"
    >
      {question}
    </button>
  );
}

// Typing indicator component
function TypingIndicator() {
  return (
    <div className="flex items-center space-x-1">
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
      <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
    </div>
  );
} 