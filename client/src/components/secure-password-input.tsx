import { useState, forwardRef } from "react";
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          required={required}
          disabled={disabled}
          autoComplete="current-password"
          spellCheck="false"
          // Security attributes without interference
          data-1p-ignore="true"
          data-lpignore="true"
        />

        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 hover:text-gray-600 focus:outline-none z-10"
          tabIndex={-1}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  }
);

SecurePasswordInput.displayName = "SecurePasswordInput";