import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { AlertCircle, Check, X, Loader2, Moon, Sun, Eye, EyeOff, ChevronDown, Search, Settings, Home, Calendar, MapPin, Star, User, Heart, Bell, Menu } from 'lucide-react';

// Design Tokens & Theme System - HolidaiButler Mediterranean Color System
const designTokens = {
  colors: {
    // Mediterraan Teal - Primaire merkkleur
    primary: {
      50: '#f0f7f6',
      100: '#dbeeed',
      200: '#b7dddc',
      300: '#8ac5c2',
      400: '#5e8b7e', // Main brand color #5E8B7E
      500: '#4a7069',
      600: '#3c5954',
      700: '#324745',
      800: '#2a3a38',
      900: '#242f2e',
      950: '#13191a'
    // Mediterranean Cream - Additional brand color
    cream: {
      50: '#fefdfb',
      100: '#fdfcf7',
      200: '#fbf8ef',
      300: '#f8f3e4',
      400: '#f5f5dc', // Mediterranean Cream #F5F5DC
      500: '#f0efd0',
      600: '#e8e3b8',
      700: '#ddd49d',
      800: '#d0c282',
      900: '#c0ad6b',
      950: '#9e8b47'
    },
    // Kompas Goud - AI-intelligentie accent
    secondary: {
      50: '#fdfcf0',
      100: '#faf7db',
      200: '#f4eeb7',
      300: '#ece087',
      400: '#d4af37', // Kompas Goud #D4AF37
      500: '#c49a2e',
      600: '#a67c24',
      700: '#895f20',
      800: '#724c20',
      900: '#5f3f1f',
      950: '#37210f'
    },
    // Oceaan Blauw - Ondersteunende kleur
    ocean: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0284c7', // Oceaan Blauw #0284C7
      600: '#0369a1',
      700: '#075985',
      800: '#0c4a6e',
      900: '#082f49',
      950: '#0a1929'
    },
    // Zonsondergang Koraal - Mediterrane warmte accent
    coral: {
      50: '#fff7ed',
      100: '#ffedd5',
      200: '#fed7aa',
      300: '#fdba74',
      400: '#fb923c',
      500: '#f97316', // Zonsondergang Koraal #F97316
      600: '#ea580c',
      700: '#c2410c',
      800: '#9a3412',
      900: '#7c2d12',
      950: '#431407'
    },
    // Deep Sea Navy - Primaire tekst & logo
    navy: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#2c3e50', // Deep Sea Navy #2C3E50
      900: '#1e293b',
      950: '#0f172a'
    },
    neutral: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#e5e5e5',
      300: '#d4d4d4',
      400: '#a3a3a3',
      500: '#737373',
      600: '#525252',
      700: '#404040',
      800: '#2c3e50', // Using Deep Sea Navy for dark text
      900: '#171717',
      950: '#0a0a0a'
    },
    success: {
      50: '#f0fdf4',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d'
    },
    warning: {
      50: '#fffbeb',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309'
    },
    error: {
      50: '#fef2f2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c'
    }
  },
  typography: {
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['Fira Code', 'monospace']
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem'
    },
    fontWeight: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700'
    },
    lineHeight: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75'
    }
  },
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    5: '1.25rem',
    6: '1.5rem',
    8: '2rem',
    10: '2.5rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem'
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',
    default: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    '2xl': '1rem',
    full: '9999px'
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    default: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
  }
};

// Theme Context
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('holidaybutler-theme') || 'light';
    }
    return 'light';
  });

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('holidaybutler-theme', newTheme);
    }
  }, [theme]);

  const themeValue = useMemo(() => ({
    theme,
    toggleTheme,
    tokens: designTokens,
    isDark: theme === 'dark'
  }), [theme, toggleTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  );
};

const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Accessibility Hook
const useAccessibility = () => {
  const [announcements, setAnnouncements] = useState([]);
  
  const announce = useCallback((message, priority = 'polite') => {
    const id = Date.now();
    setAnnouncements(prev => [...prev, { id, message, priority }]);
    setTimeout(() => {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }, 1000);
  }, []);

  return { announce, announcements };
};

// Focus Management Hook
const useFocusManagement = () => {
  const focusableElementsSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  
  const trapFocus = useCallback((element) => {
    const focusableElements = element.querySelectorAll(focusableElementsSelector);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    element.addEventListener('keydown', handleTabKey);
    return () => element.removeEventListener('keydown', handleTabKey);
  }, []);

  return { trapFocus };
};

// HolidaiButler Logo Component - Officiële SVG versie
const HolidaiButlerLogo = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: { scale: 0.5, width: 'w-48', height: 'h-32' },
    md: { scale: 0.7, width: 'w-64', height: 'h-40' },
    lg: { scale: 1, width: 'w-80', height: 'h-52' },
    xl: { scale: 1.3, width: 'w-96', height: 'h-64' }
  };

  const sizeConfig = sizes[size];

  return (
    <div className={`${sizeConfig.width} ${sizeConfig.height} ${className}`}>
      <svg 
        viewBox="0 0 400 250" 
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        style={{ transform: `scale(${sizeConfig.scale})` }}
      >
        <g transform="translate(200, 80)">
          {/* Mediterranean Wave Base */}
          <path 
            d="M -60,30 Q -30,10 0,30 Q 30,50 60,30"
            stroke="#5E8B7E" 
            strokeWidth="3" 
            fill="none"
          />
          <path 
            d="M -60,40 Q -30,20 0,40 Q 30,60 60,40"
            stroke="#5E8B7E" 
            strokeWidth="2" 
            fill="none" 
            opacity="0.6"
          />

          {/* Compass Ring */}
          <circle 
            cx="0" 
            cy="0" 
            r="35" 
            fill="none" 
            stroke="#5E8B7E"
            strokeWidth="2" 
            strokeDasharray="4,2"
          />

          {/* Navigation Star */}
          <g fill="#D4AF37">
            <polygon points="0,-50 -6,-15 -20,-15 -10,-5 -15,10 0,0 15,10 10,-5 20,-15 6,-15" />
          </g>

          {/* Cardinal Points */}
          <g fill="#D4AF37" opacity="0.7">
            <circle cx="0" cy="-35" r="2"/>
            <circle cx="35" cy="0" r="2"/>
            <circle cx="0" cy="35" r="2"/>
            <circle cx="-35" cy="0" r="2"/>
          </g>

          {/* Center Point */}
          <circle cx="0" cy="0" r="3" fill="#5E8B7E"/>
          <circle cx="0" cy="0" r="1.5" fill="#D4AF37"/>
        </g>

        {/* Text */}
        <text 
          x="200" 
          y="200" 
          textAnchor="middle" 
          fill="#2C3E50"
          fontFamily="Inter, sans-serif" 
          fontSize="27" 
          fontWeight="400"
          style={{ fontVariant: 'small-caps' }}
        >
          HolidaiButler
        </text>
        <text 
          x="200" 
          y="225" 
          textAnchor="middle" 
          fill="#5E8B7E"
          fontFamily="Inter, sans-serif" 
          fontSize="13"
          fontStyle="italic"
        >
          Je persoonlijke AI-reiscompas
        </text>
      </svg>
    </div>
  );
};

// Performance Optimization: Lazy Image Component
const LazyImage = React.memo(({ src, alt, className, ...props }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`} {...props}>
      {isInView && (
        <>
          {!isLoaded && (
            <div className="absolute inset-0 bg-neutral-200 dark:bg-neutral-700 animate-pulse" />
          )}
          <img
            src={src}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setIsLoaded(true)}
            loading="lazy"
          />
        </>
      )}
    </div>
  );
});

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-lg">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-error-500" />
          <h3 className="text-lg font-semibold text-error-700 dark:text-error-400 mb-2">
            Er is iets misgegaan
          </h3>
          <p className="text-error-600 dark:text-error-300 mb-4">
            We konden deze component niet laden. Probeer de pagina te vernieuwen.
          </p>
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()}
            className="border-error-300 text-error-700 hover:bg-error-50"
          >
            Pagina vernieuwen
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Loading Spinner Component
const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  return (
    <Loader2 
      className={`animate-spin text-primary-500 ${sizeClasses[size]} ${className}`}
      aria-label="Laden..."
    />
  );
};

// Button Component with accessibility
const Button = React.forwardRef(({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false, 
  className = '', 
  onClick,
  ...props 
}, ref) => {
  const { announce } = useAccessibility();

  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary-400 hover:bg-primary-500 text-white focus:ring-primary-500',
    secondary: 'bg-secondary-400 hover:bg-secondary-500 text-white focus:ring-secondary-500',
    ocean: 'bg-ocean-500 hover:bg-ocean-600 text-white focus:ring-ocean-500',
    coral: 'bg-coral-500 hover:bg-coral-600 text-white focus:ring-coral-500',
    outline: 'border-2 border-primary-400 text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:ring-primary-500',
    ghost: 'text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:ring-primary-500',
    danger: 'bg-error-500 hover:bg-error-600 text-white focus:ring-error-500'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
    xl: 'px-8 py-4 text-xl'
  };

  const handleClick = (e) => {
    if (loading || disabled) return;
    onClick?.(e);
    announce('Knop geactiveerd');
  };

  return (
    <button
      ref={ref}
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      onClick={handleClick}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading && <LoadingSpinner size="sm" className="mr-2" />}
      {children}
    </button>
  );
});

// Input Component with accessibility
const Input = React.forwardRef(({ 
  label, 
  error, 
  help, 
  type = 'text', 
  className = '', 
  required = false,
  ...props 
}, ref) => {
  const [showPassword, setShowPassword] = useState(false);
  const id = props.id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const { announce } = useAccessibility();

  const inputType = type === 'password' && showPassword ? 'text' : type;

  const handleChange = (e) => {
    props.onChange?.(e);
    if (error) {
      announce('Invoerfout gecorrigeerd');
    }
  };

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label 
          htmlFor={id} 
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          {label}
          {required && <span className="text-error-500 ml-1" aria-label="verplicht">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={inputType}
          className={`
            w-full px-3 py-2 border rounded-lg text-neutral-900 dark:text-neutral-100 
            bg-white dark:bg-neutral-800 
            border-neutral-300 dark:border-neutral-600
            focus:ring-2 focus:ring-primary-500 focus:border-primary-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-error-500 focus:ring-error-500' : ''}
            ${type === 'password' ? 'pr-10' : ''}
          `}
          onChange={handleChange}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : help ? `${id}-help` : undefined}
          {...props}
        />
        {type === 'password' && (
          <button
            type="button"
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-neutral-400" />
            ) : (
              <Eye className="h-4 w-4 text-neutral-400" />
            )}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-error-600 dark:text-error-400" role="alert">
          {error}
        </p>
      )}
      {help && !error && (
        <p id={`${id}-help`} className="text-sm text-neutral-500 dark:text-neutral-400">
          {help}
        </p>
      )}
    </div>
  );
});

// Modal Component with focus management
const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
  const modalRef = useRef();
  const { trapFocus } = useFocusManagement();
  const { announce } = useAccessibility();

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };

  useEffect(() => {
    if (isOpen) {
      announce('Modal geopend');
      document.body.style.overflow = 'hidden';
      const cleanup = modalRef.current ? trapFocus(modalRef.current) : null;
      
      return () => {
        document.body.style.overflow = 'unset';
        cleanup?.();
      };
    }
  }, [isOpen, trapFocus, announce]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 bg-neutral-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
        
        <div
          ref={modalRef}
          className={`
            inline-block align-bottom bg-white dark:bg-neutral-800 rounded-lg text-left 
            overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle 
            ${sizes[size]} sm:w-full
          `}
        >
          <div className="bg-white dark:bg-neutral-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 
                    id="modal-title"
                    className="text-lg leading-6 font-medium text-neutral-900 dark:text-neutral-100"
                  >
                    {title}
                  </h3>
                  <button
                    onClick={onClose}
                    className="rounded-md text-neutral-400 hover:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    aria-label="Modal sluiten"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="mt-2">
                  {children}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Alert Component
const Alert = ({ type = 'info', title, children, onClose, className = '' }) => {
  const types = {
    info: {
      bg: 'bg-primary-50 dark:bg-primary-900/20',
      border: 'border-primary-200 dark:border-primary-800',
      icon: 'text-primary-400',
      title: 'text-primary-800 dark:text-primary-200',
      text: 'text-primary-700 dark:text-primary-300'
    },
    success: {
      bg: 'bg-success-50 dark:bg-success-900/20',
      border: 'border-success-200 dark:border-success-800',
      icon: 'text-success-400',
      title: 'text-success-800 dark:text-success-200',
      text: 'text-success-700 dark:text-success-300'
    },
    warning: {
      bg: 'bg-warning-50 dark:bg-warning-900/20',
      border: 'border-warning-200 dark:border-warning-800',
      icon: 'text-warning-400',
      title: 'text-warning-800 dark:text-warning-200',
      text: 'text-warning-700 dark:text-warning-300'
    },
    error: {
      bg: 'bg-error-50 dark:bg-error-900/20',
      border: 'border-error-200 dark:border-error-800',
      icon: 'text-error-400',
      title: 'text-error-800 dark:text-error-200',
      text: 'text-error-700 dark:text-error-300'
    }
  };

  const icons = {
    info: AlertCircle,
    success: Check,
    warning: AlertCircle,
    error: X
  };

  const Icon = icons[type];
  const styles = types[type];

  return (
    <div 
      className={`
        rounded-md p-4 border ${styles.bg} ${styles.border} ${className}
      `}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <Icon className={`h-5 w-5 ${styles.icon}`} />
        </div>
        <div className="ml-3 flex-1">
          {title && (
            <h3 className={`text-sm font-medium ${styles.title}`}>
              {title}
            </h3>
          )}
          <div className={`text-sm ${styles.text} ${title ? 'mt-2' : ''}`}>
            {children}
          </div>
        </div>
        {onClose && (
          <div className="ml-auto pl-3">
            <button
              onClick={onClose}
              className={`
                inline-flex rounded-md p-1.5 ${styles.icon} 
                hover:bg-black hover:bg-opacity-10 
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500
              `}
              aria-label="Alert sluiten"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Screen Reader Announcements
const ScreenReaderAnnouncements = () => {
  const { announcements } = useAccessibility();

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcements.map(announcement => (
        <div key={announcement.id} aria-live={announcement.priority}>
          {announcement.message}
        </div>
      ))}
    </div>
  );
};

// Component Showcase/Storybook-like Demo
const ComponentShowcase = () => {
  const { theme, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const [alertVisible, setAlertVisible] = useState(true);

  const validateInput = (value) => {
    if (value.length < 3) {
      setInputError('Minimaal 3 karakters vereist');
    } else {
      setInputError('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-navy-900 dark:via-navy-800 dark:to-primary-900 transition-colors duration-300">
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-6">
            <HolidaiButlerLogo size="lg" />
            <div>
              <h1 className="text-3xl font-bold text-navy-800 dark:text-navy-100">
                Mediterranean Design System
              </h1>
              <p className="text-primary-600 dark:text-primary-400 mt-1">
                Geïnspireerd door de mediterrane kust
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            aria-label={`Schakel naar ${theme === 'light' ? 'donkere' : 'lichte'} modus`}
          >
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </div>

        {/* Typography */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-navy-800 dark:text-navy-200">
            Typography System
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h1 className="text-5xl font-bold text-navy-800 dark:text-navy-100">Heading 1</h1>
              <h2 className="text-4xl font-bold text-navy-800 dark:text-navy-100">Heading 2</h2>
              <h3 className="text-3xl font-semibold text-navy-800 dark:text-navy-100">Heading 3</h3>
              <h4 className="text-2xl font-semibold text-navy-700 dark:text-navy-200">Heading 4</h4>
              <h5 className="text-xl font-medium text-navy-700 dark:text-navy-200">Heading 5</h5>
              <h6 className="text-lg font-medium text-navy-700 dark:text-navy-200">Heading 6</h6>
            </div>
            <div className="space-y-3">
              <p className="text-base text-navy-600 dark:text-navy-300 leading-relaxed">
                Body text - Deze paragraaf tekst gebruikt de optimale regelafstand en spacing voor uitstekende leesbaarheid in het mediterrane design systeem.
              </p>
              <p className="text-sm text-navy-500 dark:text-navy-400">
                Small text - Gebruikt voor bijschriften, metadata, en secundaire informatie in de HolidaiButler interface.
              </p>
              <p className="text-xs text-navy-400 dark:text-navy-500">
                Extra small text - Voor juridische tekst en disclaimers in reisboekingen.
              </p>
              <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-700">
                <p className="text-sm text-primary-700 dark:text-primary-300 italic">
                  "De mediterrane kleuren en typografie creëren een gevoel van ontspanning en avontuur." - HolidaiButler Design Principles
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Mediterranean Color System */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-navy-800 dark:text-navy-200 mb-2">
              Mediterranean Color System
            </h2>
            <p className="text-primary-600 dark:text-primary-400 max-w-2xl mx-auto">
              Ons kleurenpalet put inspiratie uit de mediterrane kust, waarbij de kalmerende teal van kustwateren wordt gecombineerd met de warmte van gouden zonsondergangen.
            </p>
          </div>
          
          {/* Brand Color Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {/* Mediterraan Teal */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full shadow-lg" style={{ backgroundColor: '#5E8B7E' }}></div>
              <div>
                <h3 className="font-semibold text-navy-800 dark:text-navy-200">Mediterraan Teal</h3>
                <p className="text-xs text-navy-600 dark:text-navy-400 font-mono">#5E8B7E</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Primaire merkkleur</p>
              </div>
            </div>

            {/* Kompas Goud */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full shadow-lg" style={{ backgroundColor: '#D4AF37' }}></div>
              <div>
                <h3 className="font-semibold text-navy-800 dark:text-navy-200">Kompas Goud</h3>
                <p className="text-xs text-navy-600 dark:text-navy-400 font-mono">#D4AF37</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">AI-intelligentie accent</p>
              </div>
            </div>

            {/* Mediterranean Cream */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full shadow-lg border border-neutral-200" style={{ backgroundColor: '#F5F5DC' }}></div>
              <div>
                <h3 className="font-semibold text-navy-800 dark:text-navy-200">Mediterranean Cream</h3>
                <p className="text-xs text-navy-600 dark:text-navy-400 font-mono">#F5F5DC</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Zachte achtergrond</p>
              </div>
            </div>

            {/* Oceaan Blauw */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full shadow-lg" style={{ backgroundColor: '#0284C7' }}></div>
              <div>
                <h3 className="font-semibold text-navy-800 dark:text-navy-200">Oceaan Blauw</h3>
                <p className="text-xs text-navy-600 dark:text-navy-400 font-mono">#0284C7</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Ondersteunende kleur</p>
              </div>
            </div>

            {/* Zonsondergang Koraal */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full shadow-lg" style={{ backgroundColor: '#F97316' }}></div>
              <div>
                <h3 className="font-semibold text-navy-800 dark:text-navy-200">Zonsondergang Koraal</h3>
                <p className="text-xs text-navy-600 dark:text-navy-400 font-mono">#F97316</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Mediterrane warmte accent</p>
              </div>
            </div>

            {/* Deep Sea Navy */}
            <div className="text-center space-y-3">
              <div className="w-20 h-20 mx-auto rounded-full shadow-lg" style={{ backgroundColor: '#2C3E50' }}></div>
              <div>
                <h3 className="font-semibold text-navy-800 dark:text-navy-200">Deep Sea Navy</h3>
                <p className="text-xs text-navy-600 dark:text-navy-400 font-mono">#2C3E50</p>
                <p className="text-xs text-primary-600 dark:text-primary-400 mt-1">Primaire tekst & logo</p>
              </div>
            </div>
          </div>

          {/* Extended Color Palette */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            {Object.entries(designTokens.colors).filter(([name]) => ['primary', 'secondary', 'cream', 'ocean', 'coral', 'navy'].includes(name)).map(([colorName, shades]) => (
              <div key={colorName} className="space-y-2">
                <h4 className="font-medium text-navy-700 dark:text-navy-300 capitalize text-sm">
                  {colorName === 'primary' ? 'Teal Tinten' : 
                   colorName === 'secondary' ? 'Goud Tinten' :
                   colorName === 'cream' ? 'Cream Tinten' :
                   colorName === 'ocean' ? 'Blauw Tinten' :
                   colorName === 'coral' ? 'Koraal Tinten' :
                   'Navy Tinten'}
                </h4>
                <div className="grid grid-cols-5 gap-1">
                  {Object.entries(shades).slice(0, 10).map(([shade, value]) => (
                    <div
                      key={shade}
                      className="h-8 rounded-sm flex items-end p-1"
                      style={{ backgroundColor: value }}
                      title={`${colorName}-${shade}: ${value}`}
                    >
                      <span className="text-xs text-white font-mono bg-black bg-opacity-50 px-1 rounded text-center w-full leading-none">
                        {shade}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-navy-800 dark:text-navy-200">
            Button Components
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-navy-700 dark:text-navy-300 mb-3">Mediterranean Variants</h3>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Mediterraan Teal</Button>
                <Button variant="secondary">Kompas Goud</Button>
                <Button variant="ocean">Oceaan Blauw</Button>
                <Button variant="coral">Zonsondergang Koraal</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button variant="danger">Danger Button</Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-navy-700 dark:text-navy-300 mb-3">Button Sizes</h3>
              <div className="flex flex-wrap gap-3 items-center">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
                <Button size="xl">Extra Large</Button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-navy-700 dark:text-navy-300 mb-3">Button States</h3>
              <div className="flex flex-wrap gap-3">
                <Button loading>Loading Button</Button>
                <Button disabled>Disabled Button</Button>
              </div>
            </div>
          </div>
        </section>

        {/* Form Components */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
            Form Components
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                placeholder="Enter your email"
                help="We'll never share your email address"
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                required
              />
              <Input
                label="Name"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  validateInput(e.target.value);
                }}
                error={inputError}
                placeholder="Enter your name"
              />
            </div>
            <div className="space-y-4">
              <Input label="Phone Number" type="tel" placeholder="+31 6 12345678" />
              <Input label="Website" type="url" placeholder="https://example.com" />
              <Input label="Date of Birth" type="date" />
            </div>
          </div>
        </section>

        {/* Alerts */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
            Alert Components
          </h2>
          <div className="space-y-4">
            {alertVisible && (
              <Alert 
                type="info" 
                title="Information"
                onClose={() => setAlertVisible(false)}
              >
                This is an informational alert with a close button.
              </Alert>
            )}
            <Alert type="success" title="Success">
              Your operation completed successfully!
            </Alert>
            <Alert type="warning" title="Warning">
              Please review your settings before continuing.
            </Alert>
            <Alert type="error" title="Error">
              An error occurred while processing your request.
            </Alert>
          </div>
        </section>

        {/* Loading States */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
            Loading Components
          </h2>
          <div className="flex items-center gap-4">
            <LoadingSpinner size="sm" />
            <LoadingSpinner size="md" />
            <LoadingSpinner size="lg" />
            <LoadingSpinner size="xl" />
          </div>
        </section>

        {/* Modal */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
            Modal Component
          </h2>
          <Button onClick={() => setModalOpen(true)}>
            Open Modal
          </Button>
          <Modal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Example Modal"
            size="md"
          >
            <div className="space-y-4">
              <p className="text-neutral-600 dark:text-neutral-400">
                This is an example modal with proper focus management and accessibility features.
              </p>
              <div className="flex gap-3">
                <Button variant="primary" onClick={() => setModalOpen(false)}>
                  Confirm
                </Button>
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Modal>
        </section>

        {/* Lazy Images */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-neutral-800 dark:text-neutral-200">
            Optimized Images
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <LazyImage
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=200&fit=crop"
              alt="Beautiful landscape"
              className="rounded-lg h-48"
            />
            <LazyImage
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=200&fit=crop"
              alt="Mountain view"
              className="rounded-lg h-48"
            />
            <LazyImage
              src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=300&h=200&fit=crop"
              alt="Ocean waves"
              className="rounded-lg h-48"
            />
          </div>
        </section>

        {/* HolidaiButler Preview */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold text-navy-800 dark:text-navy-200">
            HolidaiButler Interface Preview
          </h2>
          
          {/* Trip Card */}
          <div className="bg-white dark:bg-navy-800 rounded-xl shadow-lg p-6 space-y-6 border border-primary-100 dark:border-primary-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-ocean-500 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-navy-800 dark:text-navy-100">
                    Mediterrane Droomreis
                  </h3>
                  <p className="text-primary-600 dark:text-primary-400">
                    Santorini, Mykonos & Kreta
                  </p>
                  <p className="text-sm text-navy-600 dark:text-navy-400">
                    15-29 Augustus 2025 • 14 dagen
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-coral-500 hover:text-coral-600">
                <Heart className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-navy-600 dark:text-navy-400">
                  <MapPin className="w-4 h-4 text-coral-500" />
                  <span>Griekse Eilanden, Egeïsche Zee</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-navy-600 dark:text-navy-400">
                  <Star className="w-4 h-4 text-secondary-400" />
                  <span>4.9 sterren • AI-gecureerd</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-navy-600 dark:text-navy-400">
                  <User className="w-4 h-4 text-ocean-500" />
                  <span>Perfect voor cultuurliefhebbers</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-secondary-400">
                  €2,849
                </p>
                <p className="text-sm text-navy-600 dark:text-navy-400">
                  per persoon • alles inclusief
                </p>
                <p className="text-xs text-coral-500 mt-1">
                  🔥 Laatste 3 plekken beschikbaar
                </p>
              </div>
            </div>
            
            {/* AI Recommendations */}
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-700">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 bg-secondary-400 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-navy-700 dark:text-navy-300">AI Reiscompas Aanbeveling</span>
              </div>
              <p className="text-sm text-navy-600 dark:text-navy-400">
                Gebaseerd op je voorkeur voor cultuur en gastronomie, heb ik deze reis samengesteld met de beste lokale ervaringen en verborgen pareltjes.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button variant="primary" className="flex-1">
                <Calendar className="w-4 h-4 mr-2" />
                Boek Deze Reis
              </Button>
              <Button variant="outline" className="flex-1">
                <Settings className="w-4 h-4 mr-2" />
                Personaliseer
              </Button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-primary-400 to-primary-500 rounded-lg p-4 text-white text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Mijn Reizen</p>
            </div>
            <div className="bg-gradient-to-br from-secondary-400 to-secondary-500 rounded-lg p-4 text-white text-center">
              <Search className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Ontdekken</p>
            </div>
            <div className="bg-gradient-to-br from-ocean-500 to-ocean-600 rounded-lg p-4 text-white text-center">
              <Bell className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Meldingen</p>
            </div>
            <div className="bg-gradient-to-br from-coral-500 to-coral-600 rounded-lg p-4 text-white text-center">
              <User className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Profiel</p>
            </div>
          </div>
        </section>
      </div>

      <ScreenReaderAnnouncements />
    </div>
  );
};

// Main App Component
const DesignSystemApp = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <div className="font-sans antialiased">
          <ComponentShowcase />
        </div>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default DesignSystemApp;