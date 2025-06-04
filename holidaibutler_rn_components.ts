# HolidAIButler React Native Core Components

## Project Structure
```
src/
├── components/
│   ├── chat/
│   ├── maps/
│   ├── booking/
│   └── ui/
├── navigation/
├── store/
├── services/
├── types/
├── utils/
└── storybook/
```

## Package Dependencies
```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.6",
    "react-navigation/native": "^6.1.9",
    "react-navigation/stack": "^6.3.20",
    "react-navigation/bottom-tabs": "^6.5.11",
    "@reduxjs/toolkit": "^1.9.7",
    "react-redux": "^8.1.3",
    "redux-persist": "^6.0.0",
    "react-native-maps": "^1.8.0",
    "react-native-google-places-autocomplete": "^2.5.6",
    "react-native-voice": "^3.2.4",
    "socket.io-client": "^4.7.2",
    "react-native-push-notification": "^8.1.1",
    "react-native-async-storage": "^1.19.3",
    "react-native-netinfo": "^9.4.1",
    "react-native-reanimated": "^3.5.4",
    "react-native-gesture-handler": "^2.13.4",
    "react-native-vector-icons": "^10.0.0",
    "react-native-paper": "^5.11.1",
    "react-native-elements": "^3.4.3",
    "react-native-fast-image": "^8.6.3",
    "react-native-modal": "^13.0.1",
    "react-native-webview": "^13.6.2"
  },
  "devDependencies": {
    "@storybook/react-native": "^6.5.6",
    "@types/react": "^18.2.24",
    "@types/react-native": "^0.72.3",
    "typescript": "^5.2.2"
  }
}
```

## 1. TypeScript Types & Interfaces

```typescript
// src/types/index.ts
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  language: string;
  currency: string;
  notifications: boolean;
  darkMode: boolean;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  type: 'text' | 'voice' | 'recommendation';
  metadata?: MessageMetadata;
}

export interface MessageMetadata {
  voiceUrl?: string;
  duration?: number;
  recommendations?: Recommendation[];
}

export interface Recommendation {
  id: string;
  type: 'hotel' | 'restaurant' | 'activity' | 'transport';
  title: string;
  description: string;
  images: string[];
  rating: number;
  price: Price;
  location: Location;
  availability: boolean;
  provider: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  address: string;
  city: string;
  country: string;
}

export interface Price {
  amount: number;
  currency: string;
  period?: 'night' | 'person' | 'hour';
}

export interface Booking {
  id: string;
  recommendationId: string;
  userId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  checkIn?: Date;
  checkOut?: Date;
  guests: number;
  totalPrice: Price;
  confirmation?: string;
  createdAt: Date;
}

export interface MapMarker {
  id: string;
  coordinate: Location;
  title: string;
  description: string;
  type: 'hotel' | 'restaurant' | 'activity' | 'transport';
  recommendation?: Recommendation;
}
```

## 2. Redux Store Configuration

```typescript
// src/store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import bookingReducer from './slices/bookingSlice';
import mapReducer from './slices/mapSlice';
import uiReducer from './slices/uiSlice';

const persistConfig = {