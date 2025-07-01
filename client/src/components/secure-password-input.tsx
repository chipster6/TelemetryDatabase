import { useState, useRef, useEffect, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SecurePasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

export const SecurePasswordInput = forwardRef<HTMLInputElement, SecurePasswordInputProps>(
  ({ id, value, onChange, placeholder, className, required, disabled }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [displayValue, setDisplayValue] = useState("");
    const hiddenInputRef = useRef<HTMLInputElement>(null);
    const visibleInputRef = useRef<HTMLInputElement>(null);

    // Create masked display value
    useEffect(() => {
      setDisplayValue("•".repeat(value.length));
    }, [value.length]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const currentValue = value;
      let newValue = currentValue;

      if (e.key === "Backspace") {
        newValue = currentValue.slice(0, -1);
      } else if (e.key === "Delete") {
        newValue = "";
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Only allow printable characters
        if (e.key.match(/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~\s]$/)) {
          newValue = currentValue + e.key;
        }
      }

      if (newValue !== currentValue) {
        onChange(newValue);
      }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
      e.preventDefault();
      // Optionally allow paste - uncomment below if needed
      // const pasteText = e.clipboardData.getData('text');
      // onChange(value + pasteText);
    };

    const preventDefaultEvents = (e: React.SyntheticEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    return (
      <div className="relative">
        {/* Hidden input that holds the real value */}
        <input
          ref={hiddenInputRef}
          type="password"
          value={value}
          onChange={() => {}} // Controlled by keydown handler
          style={{
            position: "absolute",
            left: "-9999px",
            opacity: 0,
            pointerEvents: "none",
          }}
          tabIndex={-1}
          autoComplete="new-password"
        />

        {/* Visible input that shows masks */}
        <input
          ref={visibleInputRef}
          id={id}
          type="text"
          value={showPassword ? value : displayValue}
          readOnly
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCopy={preventDefaultEvents}
          onCut={preventDefaultEvents}
          onDrag={preventDefaultEvents}
          onDrop={preventDefaultEvents}
          onSelect={preventDefaultEvents}
          onMouseDown={(e) => {
            // Prevent text selection
            if (!showPassword) {
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          style={{
            fontFamily: "monospace",
            letterSpacing: showPassword ? "normal" : "2px",
            WebkitUserSelect: showPassword ? "auto" : "none",
            userSelect: showPassword ? "auto" : "none",
            cursor: "text",
          }}
          required={required}
          disabled={disabled}
          autoComplete="new-password"
          spellCheck="false"
          data-1p-ignore="true"
          data-lpignore="true"
          data-form-type="password"
        />

        {/* Toggle visibility button */}
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 focus:outline-none"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);

SecurePasswordInput.displayName = "SecurePasswordInput";