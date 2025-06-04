// ==========================================
// HOLIDAIBUTLER - REACT NATIVE AUTH CONFIG & UTILS
// ==========================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Network from 'expo-network';
import { Alert } from 'react-native';

// ==========================================
// API CONFIGURATION
// ==========================================

export const API_CONFIG = {
  BASE_URL: __DEV__ 
    ? 'http://localhost:3000/api' 
    : 'https://holidaibutler-api.com/api',
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// ==========================================
// SECURE STORAGE UTILITIES
// ==========================================

export class SecureStorage {
  static async setItem(key, value) {
    try {
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      // Fallback to AsyncStorage
      await AsyncStorage.setItem(key, value);
    }
  }

  static async getItem(key) {
    try {
      const value = await SecureStore.getItemAsync(key);
      return value;
    } catch (error) {
      console.error(`Error retrieving ${key}:`, error);
      // Fallback to AsyncStorage
      return await AsyncStorage.getItem(key);
    }
  }

  static async removeItem(key) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error(`Error removing ${key}:`, error);
      // Fallback to AsyncStorage
      await AsyncStorage.removeItem(key);
    }
  }

  static async clear() {
    try {
      const keys = ['auth_token', 'refresh_token', 'user_data', 'biometric_enabled'];
      await Promise.all(keys.map(key => this.removeItem(key)));
    } catch (error) {
      console.error('Error clearing secure storage:', error);
    }
  }
}

// ==========================================
// HTTP CLIENT
// ==========================================

export class ApiClient {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.timeout = API_CONFIG.TIMEOUT;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    const token = await SecureStorage.getItem('auth_token');
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      // Check network connectivity
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected) {
        throw new Error('No internet connection');
      }

      const response = await this.fetchWithTimeout(url, config);
      
      // Handle token expiration
      if (response.status === 401) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          config.headers.Authorization = `Bearer ${await SecureStorage.getItem('auth_token')}`;
          return await this.fetchWithTimeout(url, config);
        } else {
          throw new Error('Authentication expired');
        }
      }

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API request failed: ${url}`, error);
      throw error;
    }
  }

  async fetchWithTimeout(url, config) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async refreshToken() {
    try {
      const refreshToken = await SecureStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        await SecureStorage.setItem('auth_token', data.token);
        if (data.refreshToken) {
          await SecureStorage.setItem('refresh_token', data.refreshToken);
        }
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  // Auth specific methods
  async login(credentials) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token, password) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      await SecureStorage.clear();
    }
  }

  async getProfile() {
    return this.request('/users/profile');
  }

  async updateProfile(updates) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }
}

// ==========================================
// SOCIAL AUTH CONFIGURATION
// ==========================================

export const SOCIAL_AUTH_CONFIG = {
  google: {
    androidClientId: 'your-android-client-id.googleusercontent.com',
    iosClientId: 'your-ios-client-id.googleusercontent.com',
    webClientId: 'your-web-client-id.googleusercontent.com',
  },
  facebook: {
    appId: 'your-facebook-app-id',
  },
  apple: {
    // Apple Sign In is automatically configured
  },
};

// ==========================================
// SOCIAL AUTH HANDLERS
// ==========================================

export class SocialAuthHandler {
  static async handleGoogleAuth() {
    try {
      const { GoogleSignin } = require('@react-native-google-signin/google-signin');
      
      GoogleSignin.configure({
        webClientId: SOCIAL_AUTH_CONFIG.google.webClientId,
        offlineAccess: true,
      });

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      
      return {
        success: true,
        user: {
          email: userInfo.user.email,
          name: userInfo.user.name,
          avatar: userInfo.user.photo,
          socialId: userInfo.user.id,
          provider: 'google',
        },
        token: userInfo.idToken,
      };
    } catch (error) {
      console.error('Google sign in error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async handleFacebookAuth() {
    try {
      const { LoginManager, AccessToken, GraphRequest, GraphRequestManager } = require('react-native-fbsdk-next');
      
      const result = await LoginManager.logInWithPermissions(['public_profile', 'email']);
      
      if (result.isCancelled) {
        return { success: false, error: 'User cancelled login' };
      }

      const data = await AccessToken.getCurrentAccessToken();
      
      return new Promise((resolve) => {
        const infoRequest = new GraphRequest(
          '/me',
          {
            accessToken: data.accessToken,
            parameters: {
              fields: {
                string: 'email,name,first_name,middle_name,last_name,picture'
              }
            }
          },
          (error, result) => {
            if (error) {
              resolve({ success: false, error: error.message });
            } else {
              resolve({
                success: true,
                user: {
                  email: result.email,
                  name: result.name,
                  avatar: result.picture?.data?.url,
                  socialId: result.id,
                  provider: 'facebook',
                },
                token: data.accessToken,
              });
            }
          }
        );
        
        new GraphRequestManager().addRequest(infoRequest).start();
      });
    } catch (error) {
      console.error('Facebook sign in error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  static async handleAppleAuth() {
    try {
      const { AppleAuthentication } = require('expo-apple-authentication');
      
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      return {
        success: true,
        user: {
          email: credential.email,
          name: credential.fullName ? 
            `${credential.fullName.givenName} ${credential.fullName.familyName}` : 
            'Apple User',
          socialId: credential.user,
          provider: 'apple',
        },
        token: credential.identityToken,
      };
    } catch (error) {
      console.error('Apple sign in error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// ==========================================
// BIOMETRIC AUTH UTILITIES
// ==========================================

export class BiometricAuth {
  static async isAvailable() {
    try {
      const { LocalAuthentication } = require('expo-local-authentication');
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return compatible && enrolled;
    } catch (error) {
      console.error('Biometric availability check failed:', error);
      return false;
    }
  }

  static async getSupportedTypes() {
    try {
      const { LocalAuthentication } = require('expo-local-authentication');
      return await LocalAuthentication.supportedAuthenticationTypesAsync();
    } catch (error) {
      console.error('Error getting biometric types:', error);
      return [];
    }
  }

  static async authenticate(options = {}) {
    try {
      const { LocalAuthentication } = require('expo-local-authentication');
      
      const defaultOptions = {
        promptMessage: 'Authenticate to access HolidAIButler',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      };

      const result = await LocalAuthentication.authenticateAsync({
        ...defaultOptions,
        ...options,
      });

      return result;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return { success: false, error: error.message };
    }
  }

  static async enableBiometricLogin(credentials) {
    try {
      const available = await this.isAvailable();
      if (!available) {
        throw new Error('Biometric authentication not available');
      }

      // Store encrypted credentials for biometric login
      await SecureStorage.setItem('biometric_enabled', 'true');
      await SecureStorage.setItem('biometric_email', credentials.email);
      // Note: In production, never store plain text passwords
      // Use a secure key derivation function or server-side solution
      
      return { success: true };
    } catch (error) {
      console.error('Error enabling biometric login:', error);
      return { success: false, error: error.message };
    }
  }

  static async disableBiometricLogin() {
    try {
      await SecureStorage.removeItem('biometric_enabled');
      await SecureStorage.removeItem('biometric_email');
      return { success: true };
    } catch (error) {
      console.error('Error disabling biometric login:', error);
      return { success: false, error: error.message };
    }
  }

  static async isBiometricLoginEnabled() {
    try {
      const enabled = await SecureStorage.getItem('biometric_enabled');
      return enabled === 'true';
    } catch (error) {
      console.error('Error checking biometric login status:', error);
      return false;
    }
  }
}

// ==========================================
// VALIDATION UTILITIES
// ==========================================

export class ValidationUtils {
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static validatePassword(password) {
    const errors = [];
    
    if (password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      strength: this.getPasswordStrength(password),
    };
  }

  static getPasswordStrength(password) {
    let score = 0;
    
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  }

  static validateName(name) {
    const trimmedName = name.trim();
    
    if (trimmedName.length < 2) {
      return { isValid: false, error: 'Name must be at least 2 characters long' };
    }
    
    if (trimmedName.length > 50) {
      return { isValid: false, error: 'Name must be less than 50 characters' };
    }
    
    if (!/^[a-zA-Z\s'-]+$/.test(trimmedName)) {
      return { isValid: false, error: 'Name contains invalid characters' };
    }
    
    return { isValid: true };
  }

  static validatePhone(phone) {
    const phoneRegex = /^\+?[\d\s-()]+$/;
    const cleanPhone = phone.replace(/\s|-|\(|\)/g, '');
    
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      return { isValid: false, error: 'Invalid phone number length' };
    }
    
    if (!phoneRegex.test(phone)) {
      return { isValid: false, error: 'Invalid phone number format' };
    }
    
    return { isValid: true };
  }
}

// ==========================================
// ERROR HANDLING
// ==========================================

export class ErrorHandler {
  static handle(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    if (error.message === 'No internet connection') {
      Alert.alert(
        'Connection Error',
        'Please check your internet connection and try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (error.message === 'Request timeout') {
      Alert.alert(
        'Timeout Error',
        'The request is taking longer than expected. Please try again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (error.message === 'Authentication expired') {
      Alert.alert(
        'Session Expired',
        'Your session has expired. Please sign in again.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    // Generic error
    Alert.alert(
      'Error',
      error.message || 'An unexpected error occurred. Please try again.',
      [{ text: 'OK' }]
    );
  }

  static async handleApiError(error, options = {}) {
    const { showAlert = true, logError = true } = options;
    
    if (logError) {
      console.error('API Error:', error);
    }
    
    if (showAlert) {
      let title = 'Error';
      let message = 'An unexpected error occurred';
      
      switch (error.status) {
        case 400:
          title = 'Invalid Request';
          message = error.message || 'Please check your input and try again';
          break;
        case 401:
          title = 'Authentication Required';
          message = 'Please sign in to continue';
          break;
        case 403:
          title = 'Access Denied';
          message = 'You don\'t have permission to perform this action';
          break;
        case 404:
          title = 'Not Found';
          message = 'The requested resource was not found';
          break;
        case 429:
          title = 'Too Many Requests';
          message = 'Please wait a moment before trying again';
          break;
        case 500:
          title = 'Server Error';
          message = 'Our servers are experiencing issues. Please try again later';
          break;
        default:
          message = error.message || message;
      }
      
      Alert.alert(title, message, [{ text: 'OK' }]);
    }
    
    return {
      success: false,
      error: error.message,
      status: error.status,
    };
  }
}

// ==========================================
// ANALYTICS & TRACKING
// ==========================================

export class AuthAnalytics {
  static trackLogin(method = 'email') {
    try {
      // Integrate with your analytics service (Firebase, Mixpanel, etc.)
      console.log('Auth Event: Login', { method });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  static trackRegister(method = 'email') {
    try {
      console.log('Auth Event: Register', { method });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  static trackLogout() {
    try {
      console.log('Auth Event: Logout');
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  static trackBiometricEnable() {
    try {
      console.log('Auth Event: Biometric Enabled');
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }

  static trackSocialAuth(provider) {
    try {
      console.log('Auth Event: Social Login', { provider });
    } catch (error) {
      console.error('Analytics tracking error:', error);
    }
  }
}

// ==========================================
// DEVICE INFO UTILITIES
// ==========================================

export class DeviceUtils {
  static async getDeviceInfo() {
    try {
      const { Constants } = require('expo-constants');
      const { getUniqueId, getSystemName, getSystemVersion } = require('react-native-device-info');
      
      return {
        deviceId: await getUniqueId(),
        platform: Constants.platform.ios ? 'ios' : 'android',
        systemName: await getSystemName(),
        systemVersion: await getSystemVersion(),
        appVersion: Constants.manifest?.version || '1.0.0',
      };
    } catch (error) {
      console.error('Error getting device info:', error);
      return {
        deviceId: 'unknown',
        platform: 'unknown',
        systemName: 'unknown',
        systemVersion: 'unknown',
        appVersion: '1.0.0',
      };
    }
  }

  static async registerDeviceForPushNotifications() {
    try {
      const { registerForPushNotificationsAsync } = require('./pushNotifications');
      const token = await registerForPushNotificationsAsync();
      
      if (token) {
        // Send device token to your backend
        const apiClient = new ApiClient();
        await apiClient.request('/users/device-token', {
          method: 'POST',
          body: JSON.stringify({ 
            token,
            platform: Constants.platform.ios ? 'ios' : 'android'
          }),
        });
      }
      
      return token;
    } catch (error) {
      console.error('Push notification registration failed:', error);
      return null;
    }
  }
}

// ==========================================
// EXPORT ALL UTILITIES
// ==========================================

export default {
  ApiClient,
  SecureStorage,
  SocialAuthHandler,
  BiometricAuth,
  ValidationUtils,
  ErrorHandler,
  AuthAnalytics,
  DeviceUtils,
  API_CONFIG,
  SOCIAL_AUTH_CONFIG,
};