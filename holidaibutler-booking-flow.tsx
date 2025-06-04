import React, { useState, useReducer, useEffect, createContext, useContext } from 'react';
import { Calendar, Clock, Users, Heart, Star, MapPin, CreditCard, Check, X, AlertCircle, Loader, ChevronRight, Phone, Mail, Wifi, WifiOff } from 'lucide-react';

// Mock Stripe for demo purposes
const mockStripe = {
  confirmCardPayment: (clientSecret, paymentMethod) => 
    new Promise(resolve => 
      setTimeout(() => resolve({ error: null, paymentIntent: { status: 'succeeded' } }), 2000)
    ),
  elements: () => ({
    create: () => ({
      mount: () => {},
      on: (event, callback) => {},
      destroy: () => {}
    })
  })
};

// Redux-like state management
const initialBookingState = {
  favorites: [],
  currentBooking: null,
  bookingHistory: [],
  paymentStatus: 'idle',
  error: null,
  isOffline: false
};

const bookingReducer = (state, action) => {
  switch (action.type) {
    case 'TOGGLE_FAVORITE':
      return {
        ...state,
        favorites: state.favorites.includes(action.payload)
          ? state.favorites.filter(id => id !== action.payload)
          : [...state.favorites, action.payload]
      };
    case 'START_BOOKING':
      return {
        ...state,
        currentBooking: action.payload,
        error: null
      };
    case 'UPDATE_BOOKING':
      return {
        ...state,
        currentBooking: { ...state.currentBooking, ...action.payload }
      };
    case 'SET_PAYMENT_STATUS':
      return {
        ...state,
        paymentStatus: action.payload
      };
    case 'COMPLETE_BOOKING':
      return {
        ...state,
        bookingHistory: [action.payload, ...state.bookingHistory],
        currentBooking: null,
        paymentStatus: 'idle'
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        paymentStatus: 'error'
      };
    case 'SET_OFFLINE':
      return {
        ...state,
        isOffline: action.payload
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    default:
      return state;
  }
};

// Context for booking state
const BookingContext = createContext();

// Sample data
const sampleRecommendations = [
  {
    id: '1',
    name: 'Restaurant De Kas',
    type: 'restaurant',
    rating: 4.8,
    reviews: 156,
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
    description: 'Fine dining in a beautiful greenhouse setting with farm-to-table cuisine.',
    price: '€€€',
    location: 'Park Frankendael, Amsterdam',
    cuisine: 'Modern European',
    features: ['Vegetarian Options', 'Romantic', 'Garden View'],
    availability: true,
    phone: '+31 20 462 4562',
    email: 'info@restaurantdekas.nl'
  },
  {
    id: '2',
    name: 'Anne Frank House',
    type: 'attraction',
    rating: 4.6,
    reviews: 2431,
    image: 'https://images.unsplash.com/photo-1585211969224-3e992986159d?w=400&h=300&fit=crop',
    description: 'Historic house and biographical museum dedicated to Anne Frank.',
    price: '€',
    location: 'Prinsengracht 263-267, Amsterdam',
    duration: '1.5 hours',
    features: ['Audio Guide', 'Historical', 'Educational'],
    availability: true,
    phone: '+31 20 556 7105',
    email: 'info@annefrank.org'
  },
  {
    id: '3',
    name: 'Hotel V Nesplein',
    type: 'hotel',
    rating: 4.4,
    reviews: 892,
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=400&h=300&fit=crop',
    description: 'Boutique hotel in the heart of Amsterdam with modern amenities.',
    price: '€€',
    location: 'Nes 49, Amsterdam',
    features: ['Free WiFi', 'Fitness Center', 'Bar'],
    availability: true,
    phone: '+31 20 662 3233',
    email: 'nesplein@hotelv.nl'
  }
];

// Recommendation Card Component
const RecommendationCard = ({ recommendation, onSelect, onToggleFavorite, isFavorite }) => {
  const getTypeIcon = (type) => {
    switch (type) {
      case 'restaurant': return '🍽️';
      case 'attraction': return '🎭';
      case 'hotel': return '🏨';
      default: return '📍';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="relative">
        <img 
          src={recommendation.image} 
          alt={recommendation.name}
          className="w-full h-48 object-cover"
          loading="lazy"
        />
        <button
          onClick={() => onToggleFavorite(recommendation.id)}
          className={`absolute top-3 right-3 p-2 rounded-full transition-colors ${
            isFavorite ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-600 hover:bg-white'
          }`}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} />
        </button>
        <div className="absolute top-3 left-3 bg-white/90 px-2 py-1 rounded-full text-sm font-medium">
          {getTypeIcon(recommendation.type)} {recommendation.type}
        </div>
      </div>
      
      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-900 flex-1">
            {recommendation.name}
          </h3>
          <div className="flex items-center ml-4">
            <Star className="w-4 h-4 text-yellow-400 fill-current" />
            <span className="ml-1 text-sm font-medium text-gray-700">
              {recommendation.rating}
            </span>
            <span className="ml-1 text-sm text-gray-500">
              ({recommendation.reviews})
            </span>
          </div>
        </div>
        
        <div className="flex items-center text-gray-600 mb-3">
          <MapPin className="w-4 h-4 mr-1" />
          <span className="text-sm">{recommendation.location}</span>
        </div>
        
        <p className="text-gray-600 mb-4 line-clamp-2">
          {recommendation.description}
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {recommendation.features.map((feature, index) => (
            <span 
              key={index}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
            >
              {feature}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-lg font-bold text-green-600">
              {recommendation.price}
            </span>
            {recommendation.availability && (
              <span className="ml-3 text-sm text-green-600 font-medium">
                Available
              </span>
            )}
          </div>
          
          <button
            onClick={() => onSelect(recommendation)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
            aria-label={`View details for ${recommendation.name}`}
          >
            View Details
            <ChevronRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
};

// POI Details Modal Component
const POIDetailsModal = ({ poi, isOpen, onClose, onBook }) => {
  if (!isOpen || !poi) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="relative">
          <img 
            src={poi.image} 
            alt={poi.name}
            className="w-full h-64 object-cover"
          />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/80 hover:bg-white p-2 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900">{poi.name}</h2>
            <div className="flex items-center">
              <Star className="w-5 h-5 text-yellow-400 fill-current" />
              <span className="ml-1 font-medium">{poi.rating}</span>
              <span className="ml-1 text-gray-500">({poi.reviews} reviews)</span>
            </div>
          </div>
          
          <div className="flex items-center text-gray-600 mb-4">
            <MapPin className="w-5 h-5 mr-2" />
            <span>{poi.location}</span>
          </div>
          
          <p className="text-gray-700 mb-6">{poi.description}</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Features</h3>
              <div className="flex flex-wrap gap-2">
                {poi.features.map((feature, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
              <div className="space-y-2">
                <div className="flex items-center text-gray-600">
                  <Phone className="w-4 h-4 mr-2" />
                  <span className="text-sm">{poi.phone}</span>
                </div>
                <div className="flex items-center text-gray-600">
                  <Mail className="w-4 h-4 mr-2" />
                  <span className="text-sm">{poi.email}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => onBook(poi)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
            >
              Book Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Date Time Picker Component
const DateTimePicker = ({ selectedDate, selectedTime, onDateChange, onTimeChange }) => {
  const today = new Date().toISOString().split('T')[0];
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
    '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
    '18:00', '18:30', '19:00', '19:30', '20:00', '20:30'
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Date
        </label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="date"
            value={selectedDate}
            min={today}
            onChange={(e) => onDateChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Time
        </label>
        <div className="grid grid-cols-4 gap-2">
          {timeSlots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => onTimeChange(time)}
              className={`p-2 text-sm rounded-lg border transition-colors ${
                selectedTime === time
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-blue-50'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Party Size Selector Component
const PartySizeSelector = ({ partySize, onPartySizeChange }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Party Size
      </label>
      <div className="relative">
        <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <select
          value={partySize}
          onChange={(e) => onPartySizeChange(parseInt(e.target.value))}
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1} {i === 0 ? 'person' : 'people'}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

// Special Requests Input Component
const SpecialRequestsInput = ({ requests, onRequestsChange }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Special Requests (Optional)
      </label>
      <textarea
        value={requests}
        onChange={(e) => onRequestsChange(e.target.value)}
        placeholder="Any special requirements, dietary restrictions, accessibility needs, etc."
        rows={3}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
      />
    </div>
  );
};

// Payment Form Component
const PaymentForm = ({ onSubmit, loading }) => {
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });

  const handleSubmit = () => {
    onSubmit(cardData);
  };

  const formatCardNumber = (value) => {
    return value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (value) => {
    return value.replace(/\D/g, '').replace(/(\d{2})/, '$1/').substr(0, 5);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Number
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            value={cardData.number}
            onChange={(e) => setCardData({ ...cardData, number: formatCardNumber(e.target.value) })}
            placeholder="1234 5678 9012 3456"
            maxLength={19}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiry Date
          </label>
          <input
            type="text"
            value={cardData.expiry}
            onChange={(e) => setCardData({ ...cardData, expiry: formatExpiry(e.target.value) })}
            placeholder="MM/YY"
            maxLength={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            CVC
          </label>
          <input
            type="text"
            value={cardData.cvc}
            onChange={(e) => setCardData({ ...cardData, cvc: e.target.value.replace(/\D/g, '') })}
            placeholder="123"
            maxLength={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Cardholder Name
        </label>
        <input
          type="text"
          value={cardData.name}
          onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
          placeholder="John Doe"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          required
        />
      </div>
      
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center"
      >
        {loading ? (
          <>
            <Loader className="w-5 h-5 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          'Complete Payment'
        )}
      </button>
    </div>
  );
};

// Booking Form Component
const BookingForm = ({ poi, onClose, onComplete }) => {
  const [bookingData, setBookingData] = useState({
    date: '',
    time: '',
    partySize: 2,
    specialRequests: ''
  });
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { state, dispatch } = useContext(BookingContext);

  const handleBookingSubmit = () => {
    if (!bookingData.date || !bookingData.time) {
      dispatch({ type: 'SET_ERROR', payload: 'Please select date and time' });
      return;
    }
    
    dispatch({ 
      type: 'UPDATE_BOOKING', 
      payload: { ...bookingData, poi: poi.id, poiName: poi.name }
    });
    setStep(2);
  };

  const handlePaymentSubmit = async (cardData) => {
    setLoading(true);
    dispatch({ type: 'SET_PAYMENT_STATUS', payload: 'processing' });
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (state.isOffline) {
        throw new Error('Payment failed: No internet connection');
      }
      
      const booking = {
        id: Date.now().toString(),
        poi,
        ...bookingData,
        cardData,
        status: 'confirmed',
        bookingDate: new Date().toISOString(),
        confirmationNumber: `HB${Date.now()}`
      };
      
      dispatch({ type: 'SET_PAYMENT_STATUS', payload: 'succeeded' });
      dispatch({ type: 'COMPLETE_BOOKING', payload: booking });
      setStep(3);
      
      setTimeout(() => {
        onComplete(booking);
      }, 2000);
      
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error.message });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-900">Booking Details</h3>
            
            <DateTimePicker
              selectedDate={bookingData.date}
              selectedTime={bookingData.time}
              onDateChange={(date) => setBookingData({ ...bookingData, date })}
              onTimeChange={(time) => setBookingData({ ...bookingData, time })}
            />
            
            <PartySizeSelector
              partySize={bookingData.partySize}
              onPartySizeChange={(size) => setBookingData({ ...bookingData, partySize: size })}
            />
            
            <SpecialRequestsInput
              requests={bookingData.specialRequests}
              onRequestsChange={(requests) => setBookingData({ ...bookingData, specialRequests: requests })}
            />
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBookingSubmit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Continue to Payment
              </button>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Payment</h3>
              <button
                onClick={() => setStep(1)}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                ← Back to Details
              </button>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Booking Summary</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>Venue: {poi.name}</div>
                <div>Date: {new Date(bookingData.date).toLocaleDateString()}</div>
                <div>Time: {bookingData.time}</div>
                <div>Party Size: {bookingData.partySize} people</div>
                {bookingData.specialRequests && (
                  <div>Special Requests: {bookingData.specialRequests}</div>
                )}
              </div>
            </div>
            
            <PaymentForm onSubmit={handlePaymentSubmit} loading={loading} />
          </div>
        );
        
      case 3:
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Booking Confirmed!</h3>
              <p className="text-gray-600">
                Your booking has been confirmed. You'll receive a confirmation email shortly.
              </p>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Book {poi.name}</h2>
            {step !== 3 && (
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close booking form"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>
          
          {state.error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700 text-sm">{state.error}</span>
              <button
                onClick={() => dispatch({ type: 'CLEAR_ERROR' })}
                className="ml-auto text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

// Booking History Component
const BookingHistory = ({ bookings }) => {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
        <p className="text-gray-500">Your booking history will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold text-gray-900">Booking History</h3>
      {bookings.map((booking) => (
        <div key={booking.id} className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-medium text-gray-900">{booking.poi.name}</h4>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(booking.date).toLocaleDateString()} at {booking.time}
              </p>
              <p className="text-sm text-gray-600">
                {booking.partySize} people • {booking.confirmationNumber}
              </p>
            </div>
            <div className="text-right">
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                booking.status === 'confirmed' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {booking.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Network Status Component
const NetworkStatus = ({ isOffline }) => {
  if (!isOffline) return null;

  return (
    <div className="fixed top-4 right-4 bg-orange-100 border border-orange-200 rounded-lg p-3 flex items-center z-40">
      <WifiOff className="w-5 h-5 text-orange-600 mr-2" />
      <span className="text-orange-800 text-sm font-medium">You're offline</span>
    </div>
  );
};

// Main App Component
const HolidAIButlerBookingFlow = () => {
  const [state, dispatch] = useReducer(bookingReducer, initialBookingState);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [activeTab, setActiveTab] = useState('recommendations');

  // Simulate network status
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_OFFLINE', payload: false });
    const handleOffline = () => dispatch({ type: 'SET_OFFLINE', payload: true });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleSelectPOI = (poi) => {
    setSelectedPOI(poi);
    setShowDetails(true);
  };

  const handleToggleFavorite = (poiId) => {
    dispatch({ type: 'TOGGLE_FAVORITE', payload: poiId });
  };

  const handleStartBooking = (poi) => {
    dispatch({ type: 'START_BOOKING', payload: { poi: poi.id, poiName: poi.name } });
    setSelectedPOI(poi);
    setShowDetails(false);
    setShowBooking(true);
  };

  const handleCompleteBooking = (booking) => {
    setShowBooking(false);
    setSelectedPOI(null);
    setActiveTab('history');
  };

  const handleCloseBooking = () => {
    setShowBooking(false);
    dispatch({ type: 'CLEAR_ERROR' });
  };

  return (
    <BookingContext.Provider value={{ state, dispatch }}>
      <div className="min-h-screen bg-gray-50">
        <NetworkStatus isOffline={state.isOffline} />
        
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <h1 className="text-2xl font-bold text-blue-600">HolidAIButler</h1>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">Amsterdam, NL</span>
                {state.isOffline ? (
                  <WifiOff className="w-5 h-5 text-orange-500" />
                ) : (
                  <Wifi className="w-5 h-5 text-green-500" />
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('recommendations')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'recommendations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Recommendations
              </button>
              <button
                onClick={() => setActiveTab('favorites')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'favorites'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Favorites ({state.favorites.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'history'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Booking History ({state.bookingHistory.length})
              </button>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'recommendations' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">
                Recommended for You
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sampleRecommendations.map((poi) => (
                  <RecommendationCard
                    key={poi.id}
                    recommendation={poi}
                    onSelect={handleSelectPOI}
                    onToggleFavorite={handleToggleFavorite}
                    isFavorite={state.favorites.includes(poi.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'favorites' && (
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-8">
                Your Favorites
              </h2>
              {state.favorites.length === 0 ? (
                <div className="text-center py-12">
                  <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No favorites yet
                  </h3>
                  <p className="text-gray-500">
                    Heart the places you love to save them here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sampleRecommendations
                    .filter((poi) => state.favorites.includes(poi.id))
                    .map((poi) => (
                      <RecommendationCard
                        key={poi.id}
                        recommendation={poi}
                        onSelect={handleSelectPOI}
                        onToggleFavorite={handleToggleFavorite}
                        isFavorite={true}
                      />
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <BookingHistory bookings={state.bookingHistory} />
          )}
        </main>

        {/* Modals */}
        <POIDetailsModal
          poi={selectedPOI}
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
          onBook={handleStartBooking}
        />

        {showBooking && selectedPOI && (
          <BookingForm
            poi={selectedPOI}
            onClose={handleCloseBooking}
            onComplete={handleCompleteBooking}
          />
        )}
      </div>
    </BookingContext.Provider>
  );
};

export default HolidAIButlerBookingFlow;