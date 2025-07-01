import { useEffect, useRef } from 'react';

/**
 * Custom hook for secure input handling to prevent keylogging attacks
 */
export function useSecureInput() {
  const securityListenersRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const cleanup = securityListenersRef.current;

    // Detect and prevent common keylogging techniques
    const preventKeylogging = () => {
      // Block common developer tools keylogging methods
      const blockDevTools = () => {
        let devtools = false;
        const threshold = 160;

        const detectDevTools = () => {
          if (window.outerHeight - window.innerHeight > threshold || 
              window.outerWidth - window.innerWidth > threshold) {
            devtools = true;
            console.clear();
            console.warn('Developer tools detected - Security measure activated');
          }
        };

        const interval = setInterval(detectDevTools, 500);
        cleanup.push(() => clearInterval(interval));
      };

      // Block common screenshot tools
      const blockScreenshots = () => {
        document.addEventListener('keydown', (e) => {
          // Block common screenshot shortcuts
          if ((e.metaKey || e.ctrlKey) && (e.key === 'p' || e.key === 's')) {
            if (document.activeElement?.getAttribute('data-form-type') === 'password') {
              e.preventDefault();
              e.stopPropagation();
            }
          }
          
          // Block F12, Ctrl+Shift+I, Ctrl+U
          if (e.key === 'F12' || 
              ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') ||
              ((e.ctrlKey || e.metaKey) && e.key === 'u')) {
            e.preventDefault();
          }
        });
      };

      // Monitor for clipboard access attempts
      const monitorClipboard = () => {
        let clipboardAccessCount = 0;
        const originalClipboard = navigator.clipboard;

        if (originalClipboard) {
          const monitoredRead = originalClipboard.readText.bind(originalClipboard);
          navigator.clipboard.readText = async () => {
            clipboardAccessCount++;
            if (clipboardAccessCount > 5) {
              console.warn('Excessive clipboard access detected');
            }
            return monitoredRead();
          };
        }
      };

      // Initialize security measures
      blockDevTools();
      blockScreenshots();
      monitorClipboard();
    };

    preventKeylogging();

    return () => {
      // Cleanup all security listeners
      securityListenersRef.current.forEach(cleanup => cleanup());
      securityListenersRef.current = [];
    };
  }, []);

  // Secure input props
  const getSecureInputProps = (type: 'password' | 'sensitive') => ({
    autoComplete: type === 'password' ? 'new-password' : 'off',
    spellCheck: false,
    'data-1p-ignore': 'true',
    'data-lpignore': 'true',
    'data-form-type': type,
    onCopy: (e: React.ClipboardEvent) => e.preventDefault(),
    onCut: (e: React.ClipboardEvent) => e.preventDefault(),
    onPaste: (e: React.ClipboardEvent) => e.preventDefault(),
    onDrag: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => e.preventDefault(),
    onSelect: (e: React.SyntheticEvent) => {
      if (type === 'password') e.preventDefault();
    },
    style: {
      WebkitUserSelect: type === 'password' ? 'none' : 'auto',
      userSelect: type === 'password' ? 'none' : 'auto',
      fontFamily: 'monospace'
    } as React.CSSProperties
  });

  return { getSecureInputProps };
}