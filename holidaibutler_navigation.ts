// types/navigation.ts
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
  TripDetail: { tripId: string };
  Booking: { destinationId: string };
  Profile: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Explore: undefined;
  Trips: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  BiometricSetup: undefined;
};

export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  CompositeScreenProps<
    BottomTabScreenProps<MainTabParamList, T>,
    RootStackScreenProps<keyof RootStackParamList>
  >;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authSlice } from './slices/authSlice';
import { userSlice } from './slices/userSlice';
import { tripsSlice } from './slices/tripsSlice';
import { appSlice } from './slices/appSlice';
import { apiSlice } from './api/apiSlice';

const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'user', 'app'],
  blacklist: ['api'],
};

const rootReducer = {
  auth: authSlice.reducer,
  user: userSlice.reducer,
  trips: tripsSlice.reducer,
  app: appSlice.reducer,
  api: apiSlice.reducer,
};

const persistedReducer = persistReducer(persistConfig, combineReducers(rootReducer));

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/FLUSH',
          'persist/REHYDRATE',
          'persist/PAUSE',
          'persist/PERSIST',
          'persist/PURGE',
          'persist/REGISTER',
        ],
      },
    }).concat(apiSlice.middleware),
  devTools: __DEV__,
});

export const persistor = persistStore(store);

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// store/slices/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PURGE } from 'redux-persist';

export interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  biometricEnabled: boolean;
  lastActivity: number;
  loginAttempts: number;
  isLocked: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
}

interface UserPreferences {
  currency: string;
  language: string;
  notifications: boolean;
  darkMode: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  token: null,
  refreshToken: null,
  user: null,
  biometricEnabled: false,
  lastActivity: Date.now(),
  loginAttempts: 0,
  isLocked: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginSuccess: (state, action: PayloadAction<{
      token: string;
      refreshToken: string;
      user: User;
    }>) => {
      state.isAuthenticated = true;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.user = action.payload.user;
      state.loginAttempts = 0;
      state.isLocked = false;
      state.lastActivity = Date.now();
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      state.lastActivity = Date.now();
    },
    updateToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      state.lastActivity = Date.now();
    },
    enableBiometric: (state) => {
      state.biometricEnabled = true;
    },
    disableBiometric: (state) => {
      state.biometricEnabled = false;
    },
    updateActivity: (state) => {
      state.lastActivity = Date.now();
    },
    incrementLoginAttempts: (state) => {
      state.loginAttempts += 1;
      if (state.loginAttempts >= 3) {
        state.isLocked = true;
      }
    },
    resetLoginAttempts: (state) => {
      state.loginAttempts = 0;
      state.isLocked = false;
    },
    updateUserPreferences: (state, action: PayloadAction<Partial<UserPreferences>>) => {
      if (state.user) {
        state.user.preferences = { ...state.user.preferences, ...action.payload };
      }
    },
  },
  extraReducers: (builder) => {
    builder.addCase(PURGE, () => initialState);
  },
});

export const {
  loginSuccess,
  logout,
  updateToken,
  enableBiometric,
  disableBiometric,
  updateActivity,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateUserPreferences,
} = authSlice.actions;

// store/slices/appSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AppState {
  isLoading: boolean;
  isFirstLaunch: boolean;
  appState: 'active' | 'background' | 'inactive';
  networkStatus: 'online' | 'offline';
  theme: 'light' | 'dark' | 'system';
  language: string;
  notifications: {
    enabled: boolean;
    permissions: 'granted' | 'denied' | 'not-determined';
  };
  deepLink: string | null;
}

const initialState: AppState = {
  isLoading: true,
  isFirstLaunch: true,
  appState: 'active',
  networkStatus: 'online',
  theme: 'system',
  language: 'nl',
  notifications: {
    enabled: true,
    permissions: 'not-determined',
  },
  deepLink: null,
};

export const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setFirstLaunch: (state, action: PayloadAction<boolean>) => {
      state.isFirstLaunch = action.payload;
    },
    setAppState: (state, action: PayloadAction<'active' | 'background' | 'inactive'>) => {
      state.appState = action.payload;
    },
    setNetworkStatus: (state, action: PayloadAction<'online' | 'offline'>) => {
      state.networkStatus = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    setNotificationPermissions: (state, action: PayloadAction<'granted' | 'denied' | 'not-determined'>) => {
      state.notifications.permissions = action.payload;
    },
    toggleNotifications: (state) => {
      state.notifications.enabled = !state.notifications.enabled;
    },
    setDeepLink: (state, action: PayloadAction<string | null>) => {
      state.deepLink = action.payload;
    },
  },
});

export const {
  setLoading,
  setFirstLaunch,
  setAppState,
  setNetworkStatus,
  setTheme,
  setLanguage,
  setNotificationPermissions,
  toggleNotifications,
  setDeepLink,
} = appSlice.actions;

// navigation/AppNavigator.tsx
import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector, useDispatch } from 'react-redux';
import { Linking } from 'react-native';
import { RootState } from '../store';
import { setDeepLink } from '../store/slices/appSlice';
import { SplashScreen } from '../screens/SplashScreen';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { TripDetailScreen } from '../screens/TripDetailScreen';
import { BookingScreen } from '../screens/BookingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { LinkingConfiguration } from './LinkingConfiguration';
import type { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const { isLoading, theme } = useSelector((state: RootState) => state.app);

  const navigationTheme = theme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    const handleDeepLink = (url: string) => {
      dispatch(setDeepLink(url));
    };

    // Handle initial URL
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription?.remove();
  }, [dispatch]);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer 
      theme={navigationTheme}
      linking={LinkingConfiguration}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen 
              name="TripDetail" 
              component={TripDetailScreen}
              options={{
                headerShown: true,
                title: 'Trip Details',
                animation: 'slide_from_bottom',
              }}
            />
            <Stack.Screen 
              name="Booking" 
              component={BookingScreen}
              options={{
                headerShown: true,
                title: 'Book Trip',
                presentation: 'modal',
              }}
            />
            <Stack.Screen 
              name="Profile" 
              component={ProfileScreen}
              options={{
                headerShown: true,
                title: 'Profile',
              }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen}
              options={{
                headerShown: true,
                title: 'Settings',
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// navigation/AuthNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '../screens/auth/WelcomeScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { BiometricSetupScreen } from '../screens/auth/BiometricSetupScreen';
import type { AuthStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen 
        name="BiometricSetup" 
        component={BiometricSetupScreen}
        options={{
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
};

// navigation/MainNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/Ionicons';
import { HomeScreen } from '../screens/main/HomeScreen';
import { ExploreScreen } from '../screens/main/ExploreScreen';
import { TripsScreen } from '../screens/main/TripsScreen';
import { MessagesScreen } from '../screens/main/MessagesScreen';
import { ProfileScreen } from '../screens/main/ProfileScreen';
import { RootState } from '../store';
import type { MainTabParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  const { theme } = useSelector((state: RootState) => state.app);
  
  const tabBarStyle = {
    backgroundColor: theme === 'dark' ? '#1a1a1a' : '#ffffff',
    borderTopColor: theme === 'dark' ? '#333333' : '#e0e0e0',
    height: 90,
    paddingBottom: 20,
    paddingTop: 10,
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: theme === 'dark' ? '#8E8E93' : '#999999',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Explore':
              iconName = focused ? 'compass' : 'compass-outline';
              break;
            case 'Trips':
              iconName = focused ? 'airplane' : 'airplane-outline';
              break;
            case 'Messages':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'circle';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tab.Screen 
        name="Explore" 
        component={ExploreScreen}
        options={{ title: 'Explore' }}
      />
      <Tab.Screen 
        name="Trips" 
        component={TripsScreen}
        options={{ title: 'My Trips' }}
      />
      <Tab.Screen 
        name="Messages" 
        component={MessagesScreen}
        options={{ title: 'Messages' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// navigation/LinkingConfiguration.ts
import { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from '../types/navigation';

export const LinkingConfiguration: LinkingOptions<RootStackParamList> = {
  prefixes: ['holidaibutler://', 'https://holidaibutler.com'],
  config: {
    screens: {
      Splash: '',
      Auth: {
        screens: {
          Welcome: 'welcome',
          Login: 'login',
          Register: 'register',
          ForgotPassword: 'forgot-password',
          BiometricSetup: 'biometric-setup',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          Explore: 'explore',
          Trips: 'trips',
          Messages: 'messages',
          Profile: 'profile',
        },
      },
      TripDetail: {
        path: 'trip/:tripId',
        parse: {
          tripId: (tripId: string) => tripId,
        },
      },
      Booking: {
        path: 'book/:destinationId',
        parse: {
          destinationId: (destinationId: string) => destinationId,
        },
      },
      Settings: 'settings',
    },
  },
};

// hooks/useAuth.ts
import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { RootState } from '../store';
import { 
  loginSuccess, 
  logout, 
  enableBiometric, 
  disableBiometric,
  incrementLoginAttempts,
  resetLoginAttempts,
  updateActivity 
} from '../store/slices/authSlice';
import { AuthService } from '../services/AuthService';

export const useAuth = () => {
  const dispatch = useDispatch();
  const authState = useSelector((state: RootState) => state.auth);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await AuthService.login(email, password);
      dispatch(loginSuccess(response));
      dispatch(resetLoginAttempts());
      return { success: true };
    } catch (error) {
      dispatch(incrementLoginAttempts());
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  }, [dispatch]);

  const biometricLogin = useCallback(async () => {
    try {
      const biometricResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with biometrics',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use password',
      });

      if (biometricResult.success) {
        const storedCredentials = await AsyncStorage.getItem('biometric_credentials');
        if (storedCredentials) {
          const { email, token } = JSON.parse(storedCredentials);
          const response = await AuthService.refreshToken(token);
          dispatch(loginSuccess(response));
          return { success: true };
        }
      }
      return { success: false, error: 'Biometric authentication failed' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Biometric login failed' 
      };
    }
  }, [dispatch]);

  const setupBiometric = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      if (!hasHardware || !isEnrolled) {
        return { success: false, error: 'Biometric authentication not available' };
      }

      if (authState.token && authState.user) {
        await AsyncStorage.setItem('biometric_credentials', JSON.stringify({
          email: authState.user.email,
          token: authState.refreshToken,
        }));
        dispatch(enableBiometric());
        return { success: true };
      }
      
      return { success: false, error: 'No active session' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to setup biometric' 
      };
    }
  }, [dispatch, authState.token, authState.user, authState.refreshToken]);

  const disableBiometricAuth = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('biometric_credentials');
      dispatch(disableBiometric());
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to disable biometric' 
      };
    }
  }, [dispatch]);

  const signOut = useCallback(async () => {
    try {
      if (authState.token) {
        await AuthService.logout(authState.token);
      }
      await AsyncStorage.removeItem('biometric_credentials');
      dispatch(logout());
      return { success: true };
    } catch (error) {
      // Still logout locally even if server request fails
      dispatch(logout());
      return { success: true };
    }
  }, [dispatch, authState.token]);

  const updateLastActivity = useCallback(() => {
    dispatch(updateActivity());
  }, [dispatch]);

  return {
    ...authState,
    login,
    biometricLogin,
    setupBiometric,
    disableBiometricAuth,
    signOut,
    updateLastActivity,
  };
};

// components/SplashScreen.tsx
import React, { useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  Dimensions,
  StatusBar 
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { LinearGradient } from 'expo-linear-gradient';
import { setLoading, setFirstLaunch } from '../store/slices/appSlice';
import { updateToken } from '../store/slices/authSlice';
import { AuthService } from '../services/AuthService';
import { RootState } from '../store';

const { width, height } = Dimensions.get('window');

export const SplashScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { isFirstLaunch } = useSelector((state: RootState) => state.app);
  const { token, refreshToken } = useSelector((state: RootState) => state.auth);
  
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.3);

  useEffect(() => {
    const initializeApp = async () => {
      // Logo animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 10,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();

      // Simulate app initialization
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check authentication status
      if (token && refreshToken) {
        try {
          const newToken = await AuthService.refreshToken(refreshToken);
          dispatch(updateToken(newToken));
        } catch (error) {
          console.log('Token refresh failed:', error);
        }
      }

      // Mark first launch as complete
      if (isFirstLaunch) {
        dispatch(setFirstLaunch(false));
      }

      // Hide splash screen
      dispatch(setLoading(false));
    };

    initializeApp();
  }, [dispatch, fadeAnim, scaleAnim, isFirstLaunch, token, refreshToken]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#007AFF', '#00C7BE', '#32D74B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Animated.View 
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>🏖️</Text>
          </View>
          <Text style={styles.appName}>HolidAI Butler</Text>
          <Text style={styles.tagline}>Your AI Travel Companion</Text>
        </Animated.View>
        
        <Animated.View 
          style={[styles.loadingContainer, { opacity: fadeAnim }]}
        >
          <View style={styles.loadingBar}>
            <View style={styles.loadingFill} />
          </View>
          <Text style={styles.loadingText}>Preparing your journey...</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: height * 0.2,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 48,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    bottom: height * 0.15,
    alignItems: 'center',
  },
  loadingBar: {
    width: width * 0.6,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 20,
  },
  loadingFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    width: '70%',
    borderRadius: 2,
  },
  loadingText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    textAlign: 'center',
  },
});

// App.tsx (Root Component)
import React, { useEffect } from 'react';
import { StatusBar, AppState, AppStateStatus } from 'react-native';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NetInfo from '@react-native-community/netinfo';
import { store, persistor } from './store';
import { AppNavigator } from './navigation/AppNavigator';
import { SplashScreen } from './components/SplashScreen';
import { setAppState, setNetworkStatus } from './store/slices/appSlice';
import { updateActivity } from './store/slices/authSlice';

const AppContent: React.FC = () => {
  useEffect(() => {
    // App state listener
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      store.dispatch(setAppState(nextAppState));
      if (nextAppState === 'active') {
        store.dispatch(updateActivity());
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Network state listener
    const networkSubscription = NetInfo.addEventListener(state => {
      store.dispatch(setNetworkStatus(state.isConnected ? 'online' : 'offline'));
    });

    return () => {
      appStateSubscription?.remove();
      networkSubscription();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="transparent" 
        translucent 
      />
      <AppNavigator />
    </SafeAreaProvider>
  );
};

export const App: React.FC = () => {
  return (
    <Provider store={store}>
      <PersistGate loading={<SplashScreen />} persistor={persistor}>
        <AppContent />
      </PersistGate>
    </Provider>
  );
};

export default App;