'use client';

import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';

// Add styles for the typing indicator animation
const typingIndicatorStyles = `
  @keyframes wave {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-3px); }
  }
  
  .animate-wave-1 {
    animation: wave 1.3s infinite ease-in-out;
    animation-delay: 0s;
  }
  
  .animate-wave-2 {
    animation: wave 1.3s infinite ease-in-out;
    animation-delay: 0.2s;
  }
  
  .animate-wave-3 {
    animation: wave 1.3s infinite ease-in-out;
    animation-delay: 0.4s;
  }
`;

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
  const [isRagSynced, setIsRagSynced] = useState(false);
  const [isRagSyncing, setIsRagSyncing] = useState(false);
  const [hasConversationMemory, setHasConversationMemory] = useState(false);
  const [memoryDetails, setMemoryDetails] = useState<{ length: number, size: number } | null>(null);
  const [showMemoryDetails, setShowMemoryDetails] = useState(false);
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
    
    // Check if RAG data was previously synced for this user
    const ragSyncStatus = localStorage.getItem(`rag_sync_status_${userId}`);
    if (ragSyncStatus === 'synced') {
      setIsRagSynced(true);
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
    if (isRagSynced) {
      inputRef.current?.focus();
    }
  }, [isRagSynced]);

  // Update conversation memory indicator when messages change
  useEffect(() => {
    // Check if we have more than just the initial greeting message
    setHasConversationMemory(messages.length > 1);
    
    // Update memory details
    if (messages.length > 1) {
      // Estimate size in bytes (rough calculation)
      const messagesJson = JSON.stringify(messages);
      setMemoryDetails({
        length: messages.length,
        size: Math.round(messagesJson.length / 1024) // Size in KB
      });
    } else {
      setMemoryDetails(null);
    }
  }, [messages]);

  // Clear conversation history
  const handleClearConversation = () => {
    if (window.confirm('Are you sure you want to start a new conversation? This will clear your current chat history.')) {
      setMessages([
        {
          role: 'assistant',
          content: 'Hello! I\'m your personal assistant. How can I help you today?',
          timestamp: new Date()
        }
      ]);
      setHasConversationMemory(false);
      setMemoryDetails(null);
      setShowMemoryDetails(false);
      
      // Clear localStorage
      if (userId) {
        localStorage.removeItem(`chat_history_${userId}`);
      }
      
      // Also clear the conversation on the backend
      if (userId) {
        fetch('http://127.0.0.1:8000/conversation_history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: userId,
            clear: true
          }),
        }).catch(error => {
          console.error('Error clearing conversation history on backend:', error);
        });
      }
      
      toast.success('Started a new conversation');
    }
  };

  // Handle RAG Sync
  const handleRagSync = async () => {
    if (!userId || isRagSyncing) return;
    
    setIsRagSyncing(true);
    
    try {
      // uncomment this to run locally
      // const response = await fetch('http://127.0.0.1:8000/load_user_data', {
      
      //uncomment this to push to the github repo
      const response = await fetch('https://api.know360.io/llm_twin/load_user_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || 'Failed to sync RAG data');
      }
      
      const data = await response.json();
      
      setIsRagSynced(true);
      localStorage.setItem(`rag_sync_status_${userId}`, 'synced');
      
      // Add a system message about successful sync
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I've successfully synced your data. ${data.document_count} items are now available for chat, including ${data.document_types.emails} emails, ${data.document_types.calendar_events} calendar events, and ${data.document_types.next_week_events} upcoming events. How can I help you today?`,
          timestamp: new Date()
        }
      ]);
      
      toast.success('RAG data synced successfully');
    } catch (error: any) {
      console.error('Error syncing RAG data:', error);
      toast.error(`Failed to sync RAG data: ${error.message}`);
      
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `I encountered an error while syncing your data. Please try again or contact support if the issue persists.`,
          timestamp: new Date(),
          error: true
        }
      ]);
    } finally {
      setIsRagSyncing(false);
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
    if (isLoading || !isRagSynced) return;
    
    setRetryingMessage(messageContent);
    setIsLoading(true);
    
    try {
      // uncomment this to run locally
      // const response = await fetch('http://127.0.0.1:8000/query', {
      
      //uncomment this to push to the github repo
      const response = await fetch('https://api.know360.io/llm_twin/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: messageContent,
          filter_by: { user_id: userId }
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
      toast.error('Failed to get a response again. Please try a different question. ');
    } finally {
      setIsLoading(false);
      setRetryingMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading || !isRagSynced) return;
    
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
    
    try {
      // Convert previous messages to the format expected by the backend
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // uncomment this to run locally
      // const response = await fetch('http://127.0.0.1:8000/query', {
      
      //uncomment this to push to the github repo
      const response = await fetch('https://api.know360.io/llm_twin/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: userMessage.content,
          filter_by: { user_id: userId },
          conversation_history: conversationHistory
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
        <div className="flex items-center space-x-2">
          {isRagSynced && (
            <button
              onClick={handleRagSync}
              className="bg-green-50 text-green-600 hover:bg-green-100 transition-colors px-3 py-1.5 rounded-full text-sm font-medium border border-green-200 flex items-center"
              disabled={isRagSyncing}
              title="Sync your data again"
            >
              {isRagSyncing ? (
                <>
                  <div className="w-3 h-3 rounded-full border-2 border-green-600 border-t-transparent animate-spin mr-1"></div>
                  Syncing...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  RAG Sync
                </>
              )}
            </button>
          )}
          {isRagSynced && (
            <div 
              className={`ml-2 px-4 py-2 rounded-lg flex items-center text-sm ${hasConversationMemory ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'} cursor-pointer relative`}
              onClick={() => setShowMemoryDetails(!showMemoryDetails)}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`h-5 w-5 mr-2 ${hasConversationMemory ? 'text-green-600' : 'text-gray-400'}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v8l4-2 4 2V6z" 
                  clipRule="evenodd" 
                />
              </svg>
              {hasConversationMemory ? 'Memory Active' : 'No Memory'}
              
              {/* Memory Details Tooltip */}
              {showMemoryDetails && memoryDetails && (
                <div className="absolute bottom-full left-0 mb-2 p-3 bg-white rounded-lg shadow-lg border border-gray-200 w-64 z-10">
                  <h4 className="font-semibold text-gray-800 mb-2">Conversation Memory</h4>
                  <div className="space-y-1 text-xs">
                    <p className="flex justify-between">
                      <span className="text-gray-600">Messages:</span>
                      <span className="font-medium">{memoryDetails.length}</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-600">Memory Size:</span>
                      <span className="font-medium">{memoryDetails.size} KB</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-600">Context Window:</span>
                      <span className="font-medium">Last 6 messages</span>
                    </p>
                    <div className="pt-2 text-gray-500 text-[10px] italic">
                      Click "Start New" to clear conversation memory
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={handleClearConversation}
            className="bg-white text-blue-600 hover:bg-blue-50 transition-colors px-3 py-1.5 rounded-full text-sm font-medium border border-blue-200"
            title="Start a new conversation"
          >
            Start New
          </button>
        </div>
      </div>
      
      {!isRagSynced ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50">
          <div className="text-center max-w-md">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-blue-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Sync Your Data</h3>
            <p className="text-gray-600 mb-6">
              To use the assistant, you need to sync your emails, calendar events, and documents first.
              This ensures that the assistant can provide personalized responses based on your data.
            </p>
            <button
              onClick={handleRagSync}
              className="bg-blue-600 text-white hover:bg-blue-700 transition-colors px-6 py-3 rounded-lg text-base font-medium shadow-md flex items-center justify-center mx-auto"
              disabled={isRagSyncing}
            >
              {isRagSyncing ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin mr-2"></div>
                  Syncing Your Data...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  RAG Sync
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <>
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
        </>
      )}
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
    <>
      <style dangerouslySetInnerHTML={{ __html: typingIndicatorStyles }} />
      <div className="flex items-center text-black text-sm">
        <span className="inline-flex items-center font-light tracking-wide">
          Thinking
          <span className="inline-flex w-4 overflow-hidden">
            <span className="animate-wave-1">.</span>
            <span className="animate-wave-2">.</span>
            <span className="animate-wave-3">.</span>
          </span>
        </span>
      </div>
    </>
  );
} 