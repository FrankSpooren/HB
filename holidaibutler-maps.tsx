import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  MapPin, 
  Search, 
  Navigation, 
  Plus, 
  Minus,
  Layers,
  Star,
  Camera,
  Coffee,
  Utensils,
  Bed,
  ShoppingBag,
  Car,
  Plane,
  AlertCircle,
  CheckCircle,
  X,
  Filter,
  List,
  Heart,
  Share,
  Info,
  Settings
} from 'lucide-react';

// Simulated Redux-like state management
const useMapStore = () => {
  const [state, setState] = useState({
    // Map state
    center: { lat: 52.3676, lng: 4.9041 }, // Amsterdam
    zoom: 13,
    mapType: 'roadmap',
    
    // POI state
    pois: [
      {
        id: 1,
        name: 'Anne Frank House',
        category: 'attraction',
        position: { lat: 52.3752, lng: 4.8840 },
        rating: 4.8,
        description: 'Historic museum and former hiding place',
        image: '/api/placeholder/100/100',
        visited: false,
        favorite: true
      },
      {
        id: 2,
        name: 'Vondelpark',
        category: 'park',
        position: { lat: 52.3579, lng: 4.8686 },
        rating: 4.6,
        description: 'Beautiful city park perfect for walking',
        image: '/api/placeholder/100/100',
        visited: true,
        favorite: false
      },
      {
        id: 3,
        name: 'Café Central',
        category: 'restaurant',
        position: { lat: 52.3702, lng: 4.8952 },
        rating: 4.4,
        description: 'Traditional Dutch brown café',
        image: '/api/placeholder/100/100',
        visited: false,
        favorite: false
      },
      {
        id: 4,
        name: 'Hotel Okura',
        category: 'accommodation',
        position: { lat: 52.3505, lng: 4.8995 },
        rating: 4.7,
        description: 'Luxury hotel with amazing views',
        image: '/api/placeholder/100/100',
        visited: false,
        favorite: true
      },
      {
        id: 5,
        name: 'De Bijenkorf',
        category: 'shopping',
        position: { lat: 52.3738, lng: 4.8910 },
        rating: 4.3,
        description: 'Premium department store',
        image: '/api/placeholder/100/100',
        visited: false,
        favorite: false
      }
    ],
    selectedPoi: null,
    visibleCategories: ['attraction', 'restaurant', 'accommodation', 'shopping', 'park'],
    
    // Location state
    currentLocation: null,
    locationHistory: [],
    searchResults: [],
    
    // UI state
    showSearch: false,
    showFilters: false,
    showPOIList: false,
    mapLoaded: false,
    locationPermission: 'prompt',
    
    // Offline state
    offlineMode: false,
    cachedTiles: new Set()
  });

  const updateState = useCallback((updates) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  return [state, updateState];
};

// POI Categories configuration
const POI_CATEGORIES = {
  attraction: { icon: Camera, color: '#e11d48', label: 'Attractions' },
  restaurant: { icon: Utensils, color: '#ea580c', label: 'Restaurants' },
  accommodation: { icon: Bed, color: '#7c3aed', label: 'Hotels' },
  shopping: { icon: ShoppingBag, color: '#059669', label: 'Shopping' },
  park: { icon: MapPin, color: '#16a34a', label: 'Parks' },
  transport: { icon: Car, color: '#2563eb', label: 'Transport' }
};

// Custom Map Controls Component
const MapControls = ({ onZoomIn, onZoomOut, onCurrentLocation, onMapType, mapType, locationLoading }) => (
  <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <button
        onClick={onZoomIn}
        className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 border-b border-gray-200"
        aria-label="Zoom in"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="w-10 h-10 flex items-center justify-center hover:bg-gray-50"
        aria-label="Zoom out"
      >
        <Minus className="w-4 h-4" />
      </button>
    </div>
    
    <button
      onClick={onCurrentLocation}
      disabled={locationLoading}
      className={`w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 ${
        locationLoading ? 'opacity-50' : ''
      }`}
      aria-label="Current location"
    >
      <Navigation className={`w-4 h-4 ${locationLoading ? 'animate-spin' : ''}`} />
    </button>
    
    <button
      onClick={onMapType}
      className="w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50"
      aria-label={`Switch to ${mapType === 'roadmap' ? 'satellite' : 'roadmap'} view`}
    >
      <Layers className="w-4 h-4" />
    </button>
  </div>
);

// POI Marker Component
const POIMarker = ({ poi, isSelected, onClick }) => {
  const category = POI_CATEGORIES[poi.category];
  const IconComponent = category?.icon || MapPin;
  
  return (
    <div
      className={`relative cursor-pointer transform transition-all duration-200 ${
        isSelected ? 'scale-125 z-20' : 'hover:scale-110 z-10'
      }`}
      onClick={() => onClick(poi)}
      role="button"
      tabIndex={0}
      aria-label={`${poi.name} - ${poi.category}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(poi);
        }
      }}
    >
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg ${
          isSelected ? 'ring-4 ring-white ring-opacity-50' : ''
        }`}
        style={{ backgroundColor: category?.color || '#6b7280' }}
      >
        <IconComponent className="w-4 h-4" />
      </div>
      {poi.favorite && (
        <Heart className="absolute -top-1 -right-1 w-3 h-3 text-red-500 fill-current" />
      )}
      {poi.visited && (
        <CheckCircle className="absolute -bottom-1 -right-1 w-3 h-3 text-green-500 fill-current" />
      )}
    </div>
  );
};

// POI Info Window Component
const POIInfoWindow = ({ poi, onClose, onToggleFavorite, onMarkVisited, onShare }) => (
  <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm relative">
    <button
      onClick={onClose}
      className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
      aria-label="Close"
    >
      <X className="w-4 h-4" />
    </button>
    
    <div className="pr-8">
      <img
        src={poi.image}
        alt={poi.name}
        className="w-full h-32 object-cover rounded-lg mb-3"
      />
      
      <div className="flex items-center gap-2 mb-2">
        <h3 className="font-semibold text-lg">{poi.name}</h3>
        <div className="flex items-center gap-1">
          <Star className="w-4 h-4 text-yellow-400 fill-current" />
          <span className="text-sm text-gray-600">{poi.rating}</span>
        </div>
      </div>
      
      <p className="text-gray-600 text-sm mb-3">{poi.description}</p>
      
      <div className="flex items-center gap-2 mb-3">
        <span className={`px-2 py-1 rounded-full text-xs text-white`}
              style={{ backgroundColor: POI_CATEGORIES[poi.category]?.color }}>
          {POI_CATEGORIES[poi.category]?.label}
        </span>
        {poi.visited && (
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
            Visited
          </span>
        )}
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onToggleFavorite(poi.id)}
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
            poi.favorite 
              ? 'bg-red-100 text-red-700 hover:bg-red-200' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Heart className={`w-3 h-3 ${poi.favorite ? 'fill-current' : ''}`} />
          {poi.favorite ? 'Favorited' : 'Favorite'}
        </button>
        
        {!poi.visited && (
          <button
            onClick={() => onMarkVisited(poi.id)}
            className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded-full text-sm"
          >
            <CheckCircle className="w-3 h-3" />
            Mark Visited
          </button>
        )}
        
        <button
          onClick={() => onShare(poi)}
          className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-full text-sm"
        >
          <Share className="w-3 h-3" />
          Share
        </button>
      </div>
    </div>
  </div>
);

// Search Component
const SearchComponent = ({ onSearch, results, onSelectResult, loading }) => {
  const [query, setQuery] = useState('');
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      onSearch(query);
    }
  };
  
  return (
    <div className="absolute top-4 left-4 right-16 z-10">
      <div className="relative">
        <div className="flex items-center bg-white rounded-lg shadow-lg">
          <Search className="w-5 h-5 text-gray-400 ml-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search locations, addresses..."
            className="flex-1 px-3 py-3 rounded-lg focus:outline-none"
            aria-label="Search locations"
          />
          {loading && (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
          )}
        </div>
        
        {results.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={index}
                onClick={() => onSelectResult(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              >
                <div className="font-medium">{result.name}</div>
                <div className="text-sm text-gray-600">{result.address}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Category Filter Component
const CategoryFilter = ({ categories, visible, onToggle }) => (
  <div className="absolute bottom-20 left-4 right-4 z-10">
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="font-medium mb-3">Filter Categories</h3>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(categories).map(([key, category]) => {
          const IconComponent = category.icon;
          const isVisible = visible.includes(key);
          
          return (
            <button
              key={key}
              onClick={() => onToggle(key)}
              className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                isVisible 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <IconComponent 
                className="w-4 h-4" 
                style={{ color: isVisible ? category.color : undefined }} 
              />
              {category.label}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// POI List Component
const POIList = ({ pois, onSelectPoi, selectedPoi }) => (
  <div className="absolute bottom-4 left-4 right-4 z-10 max-h-60">
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="p-3 border-b border-gray-200">
        <h3 className="font-medium">Points of Interest</h3>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {pois.map((poi) => {
          const category = POI_CATEGORIES[poi.category];
          const IconComponent = category?.icon || MapPin;
          const isSelected = selectedPoi?.id === poi.id;
          
          return (
            <button
              key={poi.id}
              onClick={() => onSelectPoi(poi)}
              className={`w-full p-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                isSelected ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                  style={{ backgroundColor: category?.color }}
                >
                  <IconComponent className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{poi.name}</div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <span>{category?.label}</span>
                    <span>•</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-yellow-400 fill-current" />
                      <span>{poi.rating}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1">
                  {poi.favorite && <Heart className="w-4 h-4 text-red-500 fill-current" />}
                  {poi.visited && <CheckCircle className="w-4 h-4 text-green-500 fill-current" />}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

// Current Location Marker
const CurrentLocationMarker = ({ accuracy }) => (
  <div className="relative">
    <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg" />
    {accuracy && (
      <div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 border-2 border-blue-300 rounded-full opacity-30"
        style={{
          width: `${Math.min(accuracy / 5, 100)}px`,
          height: `${Math.min(accuracy / 5, 100)}px`
        }}
      />
    )}
  </div>
);

// Main Maps Component
const HolidAIButlerMaps = () => {
  const [state, updateState] = useMapStore();
  const [searchLoading, setSearchLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const mapRef = useRef(null);

  // Simulated geolocation
  const getCurrentLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      // Simulate permission request and geolocation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockLocation = {
        lat: 52.3676 + (Math.random() - 0.5) * 0.01,
        lng: 4.9041 + (Math.random() - 0.5) * 0.01,
        accuracy: Math.floor(Math.random() * 50) + 10
      };
      
      updateState({
        currentLocation: mockLocation,
        center: { lat: mockLocation.lat, lng: mockLocation.lng },
        locationPermission: 'granted',
        locationHistory: [...state.locationHistory, { ...mockLocation, timestamp: Date.now() }]
      });
    } catch (error) {
      updateState({ locationPermission: 'denied' });
    } finally {
      setLocationLoading(false);
    }
  }, [state.locationHistory, updateState]);

  // Simulated address search
  const handleSearch = useCallback(async (query) => {
    setSearchLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const mockResults = [
        {
          name: query,
          address: 'Amsterdam, Netherlands',
          position: { lat: 52.3676, lng: 4.9041 }
        },
        {
          name: `${query} Center`,
          address: 'City Center, Amsterdam',
          position: { lat: 52.3702, lng: 4.8952 }
        }
      ];
      
      updateState({ searchResults: mockResults });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setSearchLoading(false);
    }
  }, [updateState]);

  const handleSelectSearchResult = useCallback((result) => {
    updateState({
      center: result.position,
      zoom: 15,
      searchResults: [],
      showSearch: false
    });
  }, [updateState]);

  const handlePOIClick = useCallback((poi) => {
    updateState({
      selectedPoi: poi,
      center: poi.position,
      zoom: Math.max(state.zoom, 15)
    });
  }, [state.zoom, updateState]);

  const handleToggleFavorite = useCallback((poiId) => {
    updateState({
      pois: state.pois.map(poi =>
        poi.id === poiId ? { ...poi, favorite: !poi.favorite } : poi
      )
    });
  }, [state.pois, updateState]);

  const handleMarkVisited = useCallback((poiId) => {
    updateState({
      pois: state.pois.map(poi =>
        poi.id === poiId ? { ...poi, visited: true } : poi
      )
    });
  }, [state.pois, updateState]);

  const handleShare = useCallback((poi) => {
    if (navigator.share) {
      navigator.share({
        title: poi.name,
        text: poi.description,
        url: `${window.location.origin}?poi=${poi.id}`
      });
    } else {
      navigator.clipboard.writeText(`${poi.name} - ${poi.description}`);
    }
  }, []);

  const handleToggleCategory = useCallback((category) => {
    const isVisible = state.visibleCategories.includes(category);
    updateState({
      visibleCategories: isVisible
        ? state.visibleCategories.filter(c => c !== category)
        : [...state.visibleCategories, category]
    });
  }, [state.visibleCategories, updateState]);

  const visiblePOIs = useMemo(() => 
    state.pois.filter(poi => state.visibleCategories.includes(poi.category)),
    [state.pois, state.visibleCategories]
  );

  // Initialize map
  useEffect(() => {
    updateState({ mapLoaded: true });
  }, [updateState]);

  return (
    <div className="w-full h-screen bg-gray-100 relative overflow-hidden">
      {/* Map Container */}
      <div ref={mapRef} className="w-full h-full bg-gradient-to-br from-blue-100 to-green-100 relative">
        {/* Simulated Map Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-gradient-to-br from-blue-200 via-green-200 to-yellow-200" />
          {/* Grid pattern to simulate map */}
          <div className="absolute inset-0 opacity-30"
               style={{
                 backgroundImage: `linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                                   linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)`,
                 backgroundSize: '50px 50px'
               }} />
        </div>

        {/* POI Markers */}
        {visiblePOIs.map((poi) => (
          <div
            key={poi.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${45 + (poi.position.lng - 4.8) * 200}%`,
              top: `${55 - (poi.position.lat - 52.35) * 500}%`
            }}
          >
            <POIMarker
              poi={poi}
              isSelected={state.selectedPoi?.id === poi.id}
              onClick={handlePOIClick}
            />
          </div>
        ))}

        {/* Current Location Marker */}
        {state.currentLocation && (
          <div
            className="absolute transform -translate-x-1/2 -translate-y-1/2 z-20"
            style={{
              left: `${45 + (state.currentLocation.lng - 4.8) * 200}%`,
              top: `${55 - (state.currentLocation.lat - 52.35) * 500}%`
            }}
          >
            <CurrentLocationMarker accuracy={state.currentLocation.accuracy} />
          </div>
        )}

        {/* Map Controls */}
        <MapControls
          onZoomIn={() => updateState({ zoom: Math.min(state.zoom + 1, 20) })}
          onZoomOut={() => updateState({ zoom: Math.max(state.zoom - 1, 1) })}
          onCurrentLocation={getCurrentLocation}
          onMapType={() => updateState({ 
            mapType: state.mapType === 'roadmap' ? 'satellite' : 'roadmap' 
          })}
          mapType={state.mapType}
          locationLoading={locationLoading}
        />

        {/* Search Bar */}
        {state.showSearch && (
          <SearchComponent
            onSearch={handleSearch}
            results={state.searchResults}
            onSelectResult={handleSelectSearchResult}
            loading={searchLoading}
          />
        )}

        {/* Category Filter */}
        {state.showFilters && (
          <CategoryFilter
            categories={POI_CATEGORIES}
            visible={state.visibleCategories}
            onToggle={handleToggleCategory}
          />
        )}

        {/* POI List */}
        {state.showPOIList && (
          <POIList
            pois={visiblePOIs}
            onSelectPoi={handlePOIClick}
            selectedPoi={state.selectedPoi}
          />
        )}

        {/* Selected POI Info Window */}
        {state.selectedPoi && (
          <div
            className="absolute transform -translate-x-1/2 translate-y-full z-30"
            style={{
              left: `${45 + (state.selectedPoi.position.lng - 4.8) * 200}%`,
              top: `${55 - (state.selectedPoi.position.lat - 52.35) * 500}%`
            }}
          >
            <POIInfoWindow
              poi={state.selectedPoi}
              onClose={() => updateState({ selectedPoi: null })}
              onToggleFavorite={handleToggleFavorite}
              onMarkVisited={handleMarkVisited}
              onShare={handleShare}
            />
          </div>
        )}

        {/* Bottom UI Controls */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
          <div className="flex items-center gap-2 bg-white rounded-full shadow-lg px-2 py-2">
            <button
              onClick={() => updateState({ showSearch: !state.showSearch })}
              className={`p-2 rounded-full transition-colors ${
                state.showSearch ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
              aria-label="Toggle search"
            >
              <Search className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => updateState({ showFilters: !state.showFilters })}
              className={`p-2 rounded-full transition-colors ${
                state.showFilters ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
              aria-label="Toggle filters"
            >
              <Filter className="w-5 h-5" />
            </button>
            
            <button
              onClick={() => updateState({ showPOIList: !state.showPOIList })}
              className={`p-2 rounded-full transition-colors ${
                state.showPOIList ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
              }`}
              aria-label="Toggle POI list"
            >
              <List className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex flex-col gap-2">
            {state.locationPermission === 'granted' && (
              <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Location enabled
              </div>
            )}
            
            {state.offlineMode && (
              <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Offline mode
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow-sm px-3 py-1 text-sm text-gray-600">
              Zoom: {state.zoom} | {visiblePOIs.length} POIs
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HolidAIButlerMaps;