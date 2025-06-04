import React, { useState, useEffect, useReducer, useRef, useCallback, useMemo } from 'react';
import { Mic, MicOff, Send, Wifi, WifiOff, Volume2, VolumeX, MoreHorizontal, Check, CheckCheck, Clock, AlertCircle } from 'lucide-react';

// Types
interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'failed';
  parentId?: string;
  audioUrl?: string;
}

interface ChatState {
  messages: Message[];
  isTyping: boolean;
  isConnected: boolean;
  isRecording: boolean;
  currentConversationId: string;
  offlineQueue: Message[];
  error: string | null;
}

interface TypingIndicator {
  userId: string;
  isTyping: boolean;
}

// Actions
type ChatAction = 
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE_STATUS'; payload: { id: string; status: Message['status'] } }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_RECORDING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'QUEUE_OFFLINE_MESSAGE'; payload: Message }
  | { type: 'PROCESS_OFFLINE_QUEUE' }
  | { type: 'LOAD_MESSAGES'; payload: Message[] };

// Reducer
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        error: null
      };
    case 'UPDATE_MESSAGE_STATUS':
      return {
        ...state,
        messages: state.messages.map(msg => 
          msg.id === action.payload.id 
            ? { ...msg, status: action.payload.status }
            : msg
        )
      };
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_RECORDING':
      return { ...state, isRecording: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'QUEUE_OFFLINE_MESSAGE':
      return {
        ...state,
        offlineQueue: [...state.offlineQueue, action.payload]
      };
    case 'PROCESS_OFFLINE_QUEUE':
      return {
        ...state,
        messages: [...state.messages, ...state.offlineQueue],
        offlineQueue: []
      };
    case 'LOAD_MESSAGES':
      return { ...state, messages: action.payload };
    default:
      return state;
  }
};

// Error Boundary Component
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Chat Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-64 bg-red-50 rounded-lg">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Chat Error</h3>
            <p className="text-red-600">Something went wrong with the chat interface.</p>
            <button 
              onClick={() => this.setState({ hasError: false })}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Message Status Icon Component
const MessageStatusIcon: React.FC<{ status: Message['status'] }> = ({ status }) => {
  switch (status) {
    case 'sending':
      return <Clock className="w-3 h-3 text-gray-400" />;
    case 'sent':
      return <Check className="w-3 h-3 text-gray-400" />;
    case 'delivered':
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    default:
      return null;
  }
};

// Typing Animation Component
const TypingAnimation: React.FC = () => (
  <div className="flex space-x-1 p-4">
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  </div>
);

// Message Bubble Component
const MessageBubble: React.FC<{
  message: Message;
  isThreaded?: boolean;
  onReply?: (messageId: string) => void;
}> = ({ message, isThreaded = false, onReply }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const playAudio = async () => {
    if (message.audioUrl && audioRef.current) {
      try {
        setIsPlaying(true);
        await audioRef.current.play();
      } catch (error) {
        console.error('Error playing audio:', error);
        setIsPlaying(false);
      }
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const isUser = message.sender === 'user';

  return (
    <div 
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 ${isThreaded ? 'ml-8' : ''}`}
      role="article"
      aria-label={`Message from ${message.sender}`}
    >
      <div className={`max-w-xs lg:max-w-md ${isUser ? 'order-1' : 'order-2'}`}>
        <div
          className={`px-4 py-2 rounded-lg relative group ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-sm'
              : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          } transition-all duration-200 hover:shadow-md`}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
          
          {message.audioUrl && (
            <div className="mt-2 flex items-center space-x-2">
              <button
                onClick={isPlaying ? stopAudio : playAudio}
                className={`p-1 rounded-full ${
                  isUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-200 hover:bg-gray-300'
                }`}
                aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
              >
                {isPlaying ? (
                  <VolumeX className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>
              <audio
                ref={audioRef}
                src={message.audioUrl}
                onEnded={() => setIsPlaying(false)}
                aria-label="Audio message"
              />
            </div>
          )}

          {/* Message Actions */}
          <div className="absolute top-0 right-0 -mr-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onReply?.(message.id)}
              className="p-1 bg-white rounded-full shadow-md hover:bg-gray-50"
              aria-label="Reply to message"
            >
              <MoreHorizontal className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Timestamp and Status */}
        <div className={`flex items-center mt-1 space-x-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs text-gray-500" aria-label={`Sent ${formatTimestamp(message.timestamp)}`}>
            {formatTimestamp(message.timestamp)}
          </span>
          {isUser && (
            <span aria-label={`Message status: ${message.status}`}>
              <MessageStatusIcon status={message.status} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Voice Input Component
const VoiceInput: React.FC<{
  onTranscript: (text: string) => void;
  onAudioCapture: (audioBlob: Blob) => void;
  isRecording: boolean;
  onRecordingChange: (recording: boolean) => void;
}> = ({ onTranscript, onAudioCapture, isRecording, onRecordingChange }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onTranscript(transcript);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      onRecordingChange(false);
    };

    recognitionRef.current.onend = () => {
      onRecordingChange(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscript, onRecordingChange]);

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      setHasPermission(false);
      console.error('Microphone permission denied:', error);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      await requestPermission();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      // Start audio recording
      mediaRecorderRef.current = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        onAudioCapture(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      onRecordingChange(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      onRecordingChange(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    onRecordingChange(false);
  };

  if (!isSupported) {
    return (
      <div className="text-xs text-gray-500 text-center p-2">
        Voice input not supported in this browser
      </div>
    );
  }

  return (
    <button
      onClick={isRecording ? stopRecording : startRecording}
      className={`p-3 rounded-full transition-all duration-200 ${
        isRecording
          ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
          : hasPermission
          ? 'bg-blue-500 hover:bg-blue-600 text-white'
          : 'bg-gray-300 hover:bg-gray-400 text-gray-600'
      }`}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      disabled={hasPermission === false}
    >
      {isRecording ? (
        <MicOff className="w-5 h-5" />
      ) : (
        <Mic className="w-5 h-5" />
      )}
    </button>
  );
};

// WebSocket Hook (Simulated)
const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate WebSocket connection
    const connect = () => {
      setIsConnected(false);
      setError(null);
      
      // Simulate connection delay
      setTimeout(() => {
        if (Math.random() > 0.1) { // 90% success rate
          setIsConnected(true);
        } else {
          setError('Failed to connect to chat server');
        }
      }, 1000);
    };

    connect();

    // Simulate periodic disconnections
    const interval = setInterval(() => {
      if (Math.random() > 0.95) { // 5% chance of disconnect
        setIsConnected(false);
        setTimeout(connect, 2000);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [url]);

  const sendMessage = useCallback((message: any) => {
    if (!isConnected) {
      throw new Error('Not connected to server');
    }
    // Simulate message sending
    console.log('Sending message:', message);
  }, [isConnected]);

  return { isConnected, error, sendMessage };
};

// Main Chat Interface Component
const ChatInterface: React.FC = () => {
  const initialState: ChatState = {
    messages: [
      {
        id: '1',
        content: 'Hello! I\'m your HolidAI Butler. How can I help you plan your perfect holiday today?',
        sender: 'assistant',
        timestamp: new Date(Date.now() - 300000),
        status: 'delivered'
      }
    ],
    isTyping: false,
    isConnected: false,
    isRecording: false,
    currentConversationId: 'conv-1',
    offlineQueue: [],
    error: null
  };

  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [inputText, setInputText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { isConnected, error: wsError, sendMessage } = useWebSocket('wss://localhost:3001/chat');

  // Update connection status
  useEffect(() => {
    dispatch({ type: 'SET_CONNECTED', payload: isConnected });
    if (wsError) {
      dispatch({ type: 'SET_ERROR', payload: wsError });
    }
  }, [isConnected, wsError]);

  // Process offline queue when connected
  useEffect(() => {
    if (isConnected && state.offlineQueue.length > 0) {
      dispatch({ type: 'PROCESS_OFFLINE_QUEUE' });
    }
  }, [isConnected, state.offlineQueue.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, state.isTyping]);

  // Load messages from localStorage on mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem('holidaibutler-messages');
      if (savedMessages) {
        const messages = JSON.parse(savedMessages).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        dispatch({ type: 'LOAD_MESSAGES', payload: messages });
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('holidaibutler-messages', JSON.stringify(state.messages));
    } catch (error) {
      console.error('Error saving messages:', error);
    }
  }, [state.messages]);

  const generateResponse = useCallback((userMessage: string) => {
    // Simulate typing
    dispatch({ type: 'SET_TYPING', payload: true });

    setTimeout(() => {
      const responses = [
        "I'd be happy to help you plan your holiday! What type of destination interests you?",
        "That sounds like a wonderful idea! Let me suggest some options for you.",
        "I can help you find the perfect holiday package. What's your budget range?",
        "Great choice! I'll look up the best deals for that destination.",
        "Let me check the availability and prices for those dates."
      ];

      const response = responses[Math.floor(Math.random() * responses.length)];
      
      const assistantMessage: Message = {
        id: Date.now().toString(),
        content: response,
        sender: 'assistant',
        timestamp: new Date(),
        status: 'delivered',
        parentId: replyToId || undefined
      };

      dispatch({ type: 'SET_TYPING', payload: false });
      dispatch({ type: 'ADD_MESSAGE', payload: assistantMessage });
      setReplyToId(null);
    }, 1500 + Math.random() * 1000);
  }, [replyToId]);

  const handleSendMessage = useCallback(async (content: string, audioBlob?: Blob) => {
    if (!content.trim()) return;

    const message: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date(),
      status: 'sending',
      parentId: replyToId || undefined,
      audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : undefined
    };

    if (isConnected) {
      try {
        await sendMessage(message);
        dispatch({ type: 'ADD_MESSAGE', payload: message });
        
        // Simulate message status updates
        setTimeout(() => {
          dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: message.id, status: 'sent' } });
        }, 500);
        
        setTimeout(() => {
          dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: message.id, status: 'delivered' } });
        }, 1000);

        generateResponse(content);
      } catch (error) {
        dispatch({ type: 'UPDATE_MESSAGE_STATUS', payload: { id: message.id, status: 'failed' } });
        dispatch({ type: 'SET_ERROR', payload: 'Failed to send message' });
      }
    } else {
      // Queue for offline
      dispatch({ type: 'QUEUE_OFFLINE_MESSAGE', payload: message });
      dispatch({ type: 'SET_ERROR', payload: 'Message queued for when connection is restored' });
    }

    setInputText('');
    setReplyToId(null);
    inputRef.current?.focus();
  }, [isConnected, sendMessage, generateResponse, replyToId]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(inputText);
    }
  };

  const handleVoiceTranscript = useCallback((transcript: string) => {
    setInputText(transcript);
  }, []);

  const handleAudioCapture = useCallback((audioBlob: Blob) => {
    // In a real app, you might want to send both text and audio
    if (inputText.trim()) {
      handleSendMessage(inputText, audioBlob);
    }
  }, [inputText, handleSendMessage]);

  const handleReply = useCallback((messageId: string) => {
    setReplyToId(messageId);
    inputRef.current?.focus();
  }, []);

  const connectionStatus = useMemo(() => {
    if (state.isConnected) {
      return { icon: Wifi, text: 'Connected', color: 'text-green-500' };
    } else {
      return { icon: WifiOff, text: 'Offline', color: 'text-red-500' };
    }
  }, [state.isConnected]);

  const threaded = useMemo(() => {
    return state.messages.filter(msg => msg.parentId);
  }, [state.messages]);

  return (
    <ChatErrorBoundary>
      <div className="flex flex-col h-screen max-w-4xl mx-auto bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 bg-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800">HolidAI Butler</h1>
              <p className="text-sm text-gray-500">Your personal travel assistant</p>
            </div>
            <div className="flex items-center space-x-2">
              <connectionStatus.icon className={`w-5 h-5 ${connectionStatus.color}`} />
              <span className={`text-sm ${connectionStatus.color}`}>
                {connectionStatus.text}
              </span>
            </div>
          </div>
          
          {/* Error Banner */}
          {state.error && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">{state.error}</p>
              <button
                onClick={() => dispatch({ type: 'SET_ERROR', payload: null })}
                className="text-xs text-yellow-600 hover:text-yellow-800 mt-1"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
          {state.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isThreaded={!!message.parentId}
              onReply={handleReply}
            />
          ))}
          
          {/* Typing Indicator */}
          {state.isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg rounded-bl-sm max-w-xs">
                <TypingAnimation />
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Reply Context */}
        {replyToId && (
          <div className="border-t border-gray-200 p-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                Replying to: {state.messages.find(m => m.id === replyToId)?.content.slice(0, 50)}...
              </span>
              <button
                onClick={() => setReplyToId(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Cancel reply"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 p-4 bg-white">
          <div className="flex items-end space-x-2">
            <div className="flex-1">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={state.isRecording}
                aria-label="Type your message"
              />
            </div>
            
            <VoiceInput
              onTranscript={handleVoiceTranscript}
              onAudioCapture={handleAudioCapture}
              isRecording={state.isRecording}
              onRecordingChange={(recording) => dispatch({ type: 'SET_RECORDING', payload: recording })}
            />
            
            <button
              onClick={() => handleSendMessage(inputText)}
              disabled={!inputText.trim() || state.isRecording}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          
          {/* Offline Queue Indicator */}
          {state.offlineQueue.length > 0 && (
            <div className="mt-2 text-xs text-gray-500">
              {state.offlineQueue.length} message(s) queued for sending
            </div>
          )}
        </div>
      </div>
    </ChatErrorBoundary>
  );
};

export default ChatInterface;