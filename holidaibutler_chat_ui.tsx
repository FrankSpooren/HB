import React, { useState, useEffect, useRef } from 'react';
import { Send, MapPin, Calendar, Users, Star, Sparkles, MessageCircle, Bot, User, Clock, Plane, Hotel, DollarSign, Search } from 'lucide-react';

const HolidAIButlerChat = () => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: 'Hi! 👋 I\'m your HolidAIButler assistant. I can help you find perfect accommodations, plan amazing trips, and answer any travel questions you have. What adventure can I help you plan today?',
      timestamp: new Date(),
      suggestedActions: [
        { type: 'quick_search', text: 'Find hotels in Paris', action: 'search:paris' },
        { type: 'quick_search', text: 'Plan a weekend getaway', action: 'plan:weekend' },
        { type: 'quick_search', text: 'Budget accommodation tips', action: 'tips:budget' }
      ]
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const simulateAIResponse = async (userMessage) => {
    setIsTyping(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock AI responses based on message content
    let response = {
      content: '',
      suggestedActions: [],
      searchResults: []
    };

    const lowerMessage = userMessage.toLowerCase();

    if (lowerMessage.includes('paris') || lowerMessage.includes('france')) {
      response = {
        content: 'Paris is absolutely magical! ✨ I found some wonderful accommodation options for you. From charming boutique hotels in Montmartre to luxury stays near the Champs-Élysées, there\'s something for every traveler. Would you like me to show you specific recommendations based on your budget and preferred area?',
        suggestedActions: [
          { type: 'view_accommodations', text: 'Show Paris hotels', action: 'view:paris-hotels' },
          { type: 'plan_itinerary', text: 'Plan 3-day Paris itinerary', action: 'itinerary:paris-3d' },
          { type: 'budget_help', text: 'Budget planning for Paris', action: 'budget:paris' }
        ],
        searchResults: [
          {
            id: 1,
            name: 'Hotel des Grands Boulevards',
            type: 'hotel',
            location: 'Paris, 2nd Arrondissement',
            price_per_night: 180,
            avg_rating: 4.6,
            image_url: '/api/placeholder/300/200',
            amenities: ['wifi', 'restaurant', 'bar']
          },
          {
            id: 2,
            name: 'Le Marais Boutique Apartment',
            type: 'apartment',
            location: 'Paris, Le Marais',
            price_per_night: 120,
            avg_rating: 4.8,
            image_url: '/api/placeholder/300/200',
            amenities: ['kitchen', 'wifi', 'balcony']
          },
          {
            id: 3,
            name: 'Luxury Suite Champs-Élysées',
            type: 'apartment',
            location: 'Paris, 8th Arrondissement',
            price_per_night: 320,
            avg_rating: 4.9,
            image_url: '/api/placeholder/300/200',
            amenities: ['spa', 'concierge', 'wifi', 'gym']
          }
        ]
      };
    } else if (lowerMessage.includes('budget') || lowerMessage.includes('cheap')) {
      response = {
        content: 'Great question about budget travel! 💰 Here are my top tips for finding amazing accommodations without breaking the bank:\n\n• Book during off-peak seasons\n• Consider apartments over hotels for longer stays\n• Look for places slightly outside city centers\n• Check for hostels with private rooms\n• Use filters to find the best value options\n\nWhat\'s your approximate budget range? I can find perfect options for you!',
        suggestedActions: [
          { type: 'budget_search', text: 'Under $50/night', action: 'search:budget-50' },
          { type: 'budget_search', text: '$50-100/night', action: 'search:budget-100' },
          { type: 'tips', text: 'More budget tips', action: 'tips:budget-advanced' }
        ]
      };
    } else if (lowerMessage.includes('weekend') || lowerMessage.includes('getaway')) {
      response = {
        content: 'A weekend getaway sounds perfect! 🌟 I\'d love to help you plan an amazing short trip. To give you the best recommendations, could you tell me:\n\n• Where are you located or where would you like to go?\n• What type of experience are you looking for? (relaxation, adventure, culture, food, etc.)\n• What\'s your approximate budget?\n• Any specific dates in mind?\n\nOnce I know more, I can create a personalized itinerary with perfect accommodations!',
        suggestedActions: [
          { type: 'location_input', text: 'Tell me your location', action: 'input:location' },
          { type: 'quick_weekend', text: 'Popular weekend spots', action: 'show:weekend-destinations' },
          { type: 'romantic_weekend', text: 'Romantic getaway ideas', action: 'show:romantic' }
        ]
      };
    } else if (lowerMessage.includes('itinerary') || lowerMessage.includes('plan')) {
      response = {
        content: 'I\'d be happy to create a detailed itinerary for you! 📋 I can plan everything from day-to-day activities to restaurant recommendations and transportation tips. Just let me know:\n\n• Your destination\n• How many days you\'ll be staying\n• Your interests (museums, food, nightlife, nature, etc.)\n• Your travel style and budget\n\nI\'ll create a personalized plan that makes the most of your time!',
        suggestedActions: [
          { type: 'popular_destinations', text: 'Popular destinations', action: 'show:popular' },
          { type: 'custom_itinerary', text: 'Create custom plan', action: 'form:itinerary' }
        ]
      };
    } else {
      response = {
        content: 'I\'m here to help with all your travel needs! Whether you\'re looking for the perfect place to stay, planning an itinerary, or need travel advice, I\'ve got you covered. What would you like to explore today?',
        suggestedActions: [
          { type: 'search', text: 'Find accommodations', action: 'search:start' },
          { type: 'plan', text: 'Plan a trip', action: 'plan:start' },
          { type: 'advice', text: 'Travel advice', action: 'advice:start' }
        ]
      };
    }

    setIsTyping(false);
    
    const aiMessage = {
      id: Date.now(),
      role: 'assistant',
      content: response.content,
      timestamp: new Date(),
      suggestedActions: response.suggestedActions,
      searchResults: response.searchResults
    };

    setMessages(prev => [...prev, aiMessage]);
    if (response.searchResults.length > 0) {
      setSearchResults(response.searchResults);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageContent = inputMessage;
    setInputMessage('');

    // Simulate AI response
    await simulateAIResponse(messageContent);
  };

  const handleQuickAction = (action) => {
    const actionMap = {
      'search:paris': 'I\'d like to find accommodations in Paris',
      'plan:weekend': 'Help me plan a weekend getaway',
      'tips:budget': 'What are some budget travel tips?',
      'search:start': 'Help me find accommodations',
      'plan:start': 'I want to plan a trip',
      'advice:start': 'I need some travel advice'
    };

    if (actionMap[action]) {
      setInputMessage(actionMap[action]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const AccommodationCard = ({ accommodation }) => (
    <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-shadow">
      <div className="h-32 bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center">
        <Hotel className="h-12 w-12 text-white" />
      </div>
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-semibold text-sm">{accommodation.name}</h4>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-yellow-400 fill-current" />
            <span className="text-xs text-gray-600">{accommodation.avg_rating}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 mb-2">
          <MapPin className="h-3 w-3 text-gray-400" />
          <span className="text-xs text-gray-600">{accommodation.location}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-green-600">
            ${accommodation.price_per_night}/night
          </span>
          <button className="bg-blue-500 text-white px-3 py-1 rounded text-xs hover:bg-blue-600 transition-colors">
            View Details
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-full">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">HolidAIButler</h1>
            <p className="text-sm text-gray-600">Your AI Travel Assistant</p>
          </div>
          <div className="ml-auto flex gap-2">
            <button 
              onClick={() => setShowRecommendations(!showRecommendations)}
              className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm hover:bg-purple-200 transition-colors"
            >
              <Sparkles className="h-4 w-4 inline mr-1" />
              Recommendations
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' && (
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-full h-8 w-8 flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
            )}
            
            <div className={`max-w-2xl ${message.role === 'user' ? 'order-first' : ''}`}>
              <div className={`p-3 rounded-lg ${
                message.role === 'user' 
                  ? 'bg-blue-500 text-white ml-12' 
                  : 'bg-white border border-gray-200 shadow-sm'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <div className="flex items-center gap-1 mt-1 opacity-70">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Suggested Actions */}
              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.suggestedActions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => handleQuickAction(action.action)}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs transition-colors border"
                    >
                      {action.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Search Results */}
              {message.searchResults && message.searchResults.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Found {message.searchResults.length} accommodations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {message.searchResults.map((accommodation) => (
                      <AccommodationCard key={accommodation.id} accommodation={accommodation} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="bg-gray-300 p-2 rounded-full h-8 w-8 flex items-center justify-center">
                <User className="h-4 w-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex gap-3 justify-start">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-full h-8 w-8 flex items-center justify-center">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="bg-white border border-gray-200 shadow-sm p-3 rounded-lg">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Recommendations Sidebar */}
      {showRecommendations && (
        <div className="bg-white border-t border-gray-200 p-4">
          <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            Quick Suggestions
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { icon: Plane, text: 'Weekend Trips', action: 'plan:weekend' },
              { icon: Hotel, text: 'Luxury Stays', action: 'search:luxury' },
              { icon: DollarSign, text: 'Budget Options', action: 'search:budget' },
              { icon: MapPin, text: 'Local Gems', action: 'discover:local' }
            ].map((item, index) => (
              <button
                key={index}
                onClick={() => handleQuickAction(item.action)}
                className="flex flex-col items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border"
              >
                <item.icon className="h-5 w-5 text-gray-600 mb-1" />
                <span className="text-xs text-gray-700">{item.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about travel, accommodations, or planning your trip..."
              className="w-full p-3 pr-12 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows="1"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isTyping}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-3 rounded-lg hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          HolidAIButler can help you find accommodations, plan trips, and provide travel advice
        </p>
      </div>
    </div>
  );
};

export default HolidAIButlerChat;