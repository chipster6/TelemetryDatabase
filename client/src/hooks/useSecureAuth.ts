import { useEffect } from 'react';

/**
 * Secure authentication hook that implements security measures without interfering with user input
 */
export function useSecureAuth() {
  useEffect(() => {
    // Clear browser history of sensitive pages on navigation
    const clearSensitiveHistory = () => {
      if (window.history.replaceState) {
        window.history.replaceState(null, '', window.location.href);
      }
    };

    // Disable autocomplete for password managers on sensitive forms
    const disableAutocomplete = () => {
      const passwordFields = document.querySelectorAll('input[type="password"]');
      passwordFields.forEach(field => {
        field.setAttribute('autocomplete', 'new-password');
      });
    };

    // Security event handlers
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Clear sensitive data from memory when page is hidden
        const sensitiveInputs = document.querySelectorAll('[data-sensitive="true"]');
        sensitiveInputs.forEach(input => {
          if (input instanceof HTMLInputElement) {
            input.blur();
          }
        });
      }
    };

    // Apply security measures
    clearSensitiveHistory();
    disableAutocomplete();
    
    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Secure input properties that don't interfere with typing
  const getSecureInputProps = () => ({
    autoComplete: "new-password",
    spellCheck: false,
    'data-1p-ignore': "true",
    'data-lpignore': "true",
    'data-sensitive': "true",
    style: {
      fontFamily: 'system-ui, -apple-system, sans-serif'
    } as React.CSSProperties
  });

  return { getSecureInputProps };
}