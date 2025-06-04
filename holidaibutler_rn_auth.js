// ==========================================
// HOLIDAIBUTLER - REACT NATIVE AUTH COMPONENTS
// ==========================================

import React, { useState, useEffect, useContext, createContext } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  StatusBar,
  Modal,
  ActivityIndicator,
  Animated,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as Facebook from 'expo-auth-session/providers/facebook';
import * as Apple from 'expo-auth-session/providers/apple';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ==========================================
// AUTH CONTEXT & HOOKS
// ==========================================

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Auth Provider Component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Auth state check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
      
      setToken(data.token);
      setUser(data.user);
      
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const register = async (userData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      await AsyncStorage.setItem('auth_token', data.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
      
      setToken(data.token);
      setUser(data.user);
      
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(['auth_token', 'user_data', 'biometric_enabled']);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const updateProfile = async (updates) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const updatedUser = { ...user, ...updates };
        await AsyncStorage.setItem('user_data', JSON.stringify(updatedUser));
        setUser(updatedUser);
        return { success: true };
      }
      
      throw new Error('Profile update failed');
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!token,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ==========================================
// ANIMATED INPUT COMPONENT
// ==========================================

const AnimatedInput = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  secureTextEntry, 
  keyboardType = 'default',
  icon,
  error 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const animatedValue = new Animated.Value(value ? 1 : 0);

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const labelStyle = {
    position: 'absolute',
    left: 50,
    top: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [18, 0],
    }),
    fontSize: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    color: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#9CA3AF', '#6366F1'],
    }),
  };

  return (
    <View style={styles.inputContainer}>
      <View style={[styles.inputWrapper, error && styles.inputError, isFocused && styles.inputFocused]}>
        <Ionicons name={icon} size={20} color={isFocused ? '#6366F1' : '#9CA3AF'} style={styles.inputIcon} />
        <Animated.Text style={labelStyle}>{label}</Animated.Text>
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize="none"
        />
        {secureTextEntry && (
          <TouchableOpacity 
            onPress={() => setShowPassword(!showPassword)}
            style={styles.passwordToggle}
          >
            <Ionicons 
              name={showPassword ? 'eye-off' : 'eye'} 
              size={20} 
              color="#9CA3AF" 
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// ==========================================
// SOCIAL AUTH BUTTONS
// ==========================================

const SocialAuthButton = ({ provider, onPress, loading }) => {
  const getProviderConfig = (provider) => {
    const configs = {
      google: {
        icon: 'logo-google',
        color: '#4285F4',
        text: 'Continue with Google'
      },
      facebook: {
        icon: 'logo-facebook',
        color: '#1877F2',
        text: 'Continue with Facebook'
      },
      apple: {
        icon: 'logo-apple',
        color: '#000000',
        text: 'Continue with Apple'
      }
    };
    return configs[provider];
  };

  const config = getProviderConfig(provider);

  return (
    <TouchableOpacity 
      style={[styles.socialButton, { borderColor: config.color }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={config.color} />
      ) : (
        <>
          <Ionicons name={config.icon} size={20} color={config.color} />
          <Text style={[styles.socialButtonText, { color: config.color }]}>
            {config.text}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// ==========================================
// BIOMETRIC AUTH COMPONENT
// ==========================================

const BiometricAuth = ({ onSuccess, onError }) => {
  const [isSupported, setIsSupported] = useState(false);
  const [biometricType, setBiometricType] = useState(null);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      setIsSupported(compatible && enrolled);
      setBiometricType(types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) 
        ? 'face-id' : 'fingerprint');
    } catch (error) {
      console.error('Biometric check failed:', error);
    }
  };

  const authenticateWithBiometrics = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access HolidAIButler',
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        onSuccess();
      } else {
        onError('Biometric authentication failed');
      }
    } catch (error) {
      onError(error.message);
    }
  };

  if (!isSupported) return null;

  return (
    <TouchableOpacity 
      style={styles.biometricButton}
      onPress={authenticateWithBiometrics}
    >
      <Ionicons 
        name={biometricType === 'face-id' ? 'scan' : 'finger-print'} 
        size={24} 
        color="#6366F1" 
      />
      <Text style={styles.biometricText}>
        Use {biometricType === 'face-id' ? 'Face ID' : 'Fingerprint'}
      </Text>
    </TouchableOpacity>
  );
};

// ==========================================
// LOGIN SCREEN
// ==========================================

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const { login } = useAuth();

  const validateForm = () => {
    const newErrors = {};
    
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    
    if (!result.success) {
      Alert.alert('Login Failed', result.error);
    }
  };

  const handleBiometricSuccess = async () => {
    // Get stored credentials and auto-login
    try {
      const storedEmail = await AsyncStorage.getItem('biometric_email');
      const storedPassword = await AsyncStorage.getItem('biometric_password');
      
      if (storedEmail && storedPassword) {
        setLoading(true);
        const result = await login(storedEmail, storedPassword);
        setLoading(false);
        
        if (!result.success) {
          Alert.alert('Login Failed', result.error);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Biometric authentication failed');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="airplane" size={40} color="#ffffff" />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your journey</Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <AnimatedInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              icon="mail"
              error={errors.email}
            />

            <AnimatedInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed"
              error={errors.password}
            />

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.loginButton, loading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Biometric Auth */}
            <BiometricAuth 
              onSuccess={handleBiometricSuccess}
              onError={(error) => Alert.alert('Error', error)}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Auth */}
            <View style={styles.socialContainer}>
              <SocialAuthButton 
                provider="google" 
                onPress={() => console.log('Google login')}
              />
              <SocialAuthButton 
                provider="facebook" 
                onPress={() => console.log('Facebook login')}
              />
              {Platform.OS === 'ios' && (
                <SocialAuthButton 
                  provider="apple" 
                  onPress={() => console.log('Apple login')}
                />
              )}
            </View>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// REGISTER SCREEN
// ==========================================

export const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1);
  const { register } = useAuth();

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;
    
    setLoading(true);
    const result = await register(formData);
    setLoading(false);
    
    if (!result.success) {
      Alert.alert('Registration Failed', result.error);
    }
  };

  const renderStep1 = () => (
    <>
      <AnimatedInput
        label="Full Name"
        value={formData.name}
        onChangeText={(value) => updateField('name', value)}
        icon="person"
        error={errors.name}
      />

      <AnimatedInput
        label="Email"
        value={formData.email}
        onChangeText={(value) => updateField('email', value)}
        keyboardType="email-address"
        icon="mail"
        error={errors.email}
      />

      <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
        <Text style={styles.nextButtonText}>Next</Text>
        <Ionicons name="arrow-forward" size={20} color="#ffffff" />
      </TouchableOpacity>
    </>
  );

  const renderStep2 = () => (
    <>
      <AnimatedInput
        label="Password"
        value={formData.password}
        onChangeText={(value) => updateField('password', value)}
        secureTextEntry
        icon="lock-closed"
        error={errors.password}
      />

      <AnimatedInput
        label="Confirm Password"
        value={formData.confirmPassword}
        onChangeText={(value) => updateField('confirmPassword', value)}
        secureTextEntry
        icon="lock-closed"
        error={errors.confirmPassword}
      />

      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => setStep(1)}
        >
          <Ionicons name="arrow-back" size={20} color="#6366F1" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.registerButton, loading && styles.registerButtonDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.registerButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" />
      
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="airplane" size={40} color="#ffffff" />
            </View>
            <Text style={styles.title}>Join HolidAIButler</Text>
            <Text style={styles.subtitle}>Create your account to start exploring</Text>
          </View>

          {/* Progress Indicator */}
          <View style={styles.progressContainer}>
            <View style={[styles.progressDot, step >= 1 && styles.progressDotActive]} />
            <View style={[styles.progressLine, step >= 2 && styles.progressLineActive]} />
            <View style={[styles.progressDot, step >= 2 && styles.progressDotActive]} />
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            {step === 1 ? renderStep1() : renderStep2()}

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// FORGOT PASSWORD SCREEN
// ==========================================

export const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setSent(true);
      } else {
        const data = await response.json();
        Alert.alert('Error', data.error || 'Failed to send reset email');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.centerContainer}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#10B981" />
            <Text style={styles.successTitle}>Email Sent!</Text>
            <Text style={styles.successText}>
              We've sent a password reset link to {email}. 
              Please check your email and follow the instructions.
            </Text>
            <TouchableOpacity 
              style={styles.backToLoginButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.backToLoginText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backIcon}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color="#ffffff" />
            </TouchableOpacity>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password
            </Text>
          </View>

          <View style={styles.formContainer}>
            <AnimatedInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              icon="mail"
            />

            <TouchableOpacity 
              style={[styles.resetButton, loading && styles.resetButtonDisabled]}
              onPress={handleResetPassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.resetButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    paddingHorizontal: 15,
    height: 55,
    position: 'relative',
  },
  inputFocused: {
    borderColor: '#6366F1',
    borderWidth: 2,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingTop: 8,
  },
  passwordToggle: {
    padding: 5,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 5,
    marginLeft: 5,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 20,
  },
  forgotPasswordText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginBottom: 20,
  },
  biometricText: {
    color: '#6366F1',
    fontSize: 14,
    marginLeft: 8,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 15,
    color: '#6B7280',
    fontSize: 14,
  },
  socialContainer: {
    gap: 12,
    marginBottom: 20,
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 50,
    backgroundColor: '#ffffff',
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 10,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    color: '#6B7280',
    fontSize: 14,
  },
  registerLink: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: '#ffffff',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 8,
  },
  progressLineActive: {
    backgroundColor: '#ffffff',
  },
  nextButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 50,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  nextButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  backButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 12,
    height: 50,
  },
  backButtonText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  registerButton: {
    flex: 2,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#6B7280',
    fontSize: 14,
  },
  loginLink: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
    marginBottom: 15,
  },
  successText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  backToLoginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  backToLoginText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  backIcon: {
    position: 'absolute',
    left: 0,
    top: 0,
    padding: 10,
  },
  resetButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// ==========================================
// CONSTANTS & CONFIG
// ==========================================

const API_BASE_URL = 'https://your-api-domain.com/api';

export default {
  AuthProvider,
  LoginScreen,
  RegisterScreen,
  ForgotPasswordScreen,
  useAuth,
};