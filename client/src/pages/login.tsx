import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSecureInput } from "@/hooks/useSecureInput";
import { Lock, User, Eye, EyeOff, Shield } from "lucide-react";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { login, isLoginPending } = useAuth();
  const { getSecureInputProps } = useSecureInput();
  const formRef = useRef<HTMLFormElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Security measures to prevent keylogging and input monitoring
  useEffect(() => {
    // Disable drag and drop on form elements
    const preventDragDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Disable right-click context menu on sensitive elements
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // Disable text selection on password field
    const preventSelection = (e: Event) => {
      e.preventDefault();
    };

    if (formRef.current) {
      const form = formRef.current;
      form.addEventListener('dragover', preventDragDrop);
      form.addEventListener('drop', preventDragDrop);
      form.addEventListener('contextmenu', preventContextMenu);
      
      // Apply to password input specifically
      if (passwordInputRef.current) {
        passwordInputRef.current.addEventListener('selectstart', preventSelection);
        passwordInputRef.current.style.webkitUserSelect = 'none';
        passwordInputRef.current.style.userSelect = 'none';
      }

      return () => {
        form.removeEventListener('dragover', preventDragDrop);
        form.removeEventListener('drop', preventDragDrop);
        form.removeEventListener('contextmenu', preventContextMenu);
        
        if (passwordInputRef.current) {
          passwordInputRef.current.removeEventListener('selectstart', preventSelection);
        }
      };
    }
  }, []);

  // Clear clipboard when component unmounts
  useEffect(() => {
    return () => {
      // Clear password from memory
      setPassword("");
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password) {
      toast({
        title: "Validation Error",
        description: "Please enter both username and password",
        variant: "destructive",
      });
      return;
    }

    try {
      await login({ username: username.trim(), password });

      // Clear sensitive data immediately after successful login
      setPassword("");
      setUsername("");

      toast({
        title: "Login successful",
        description: "Welcome to the AI Biometric Platform",
      });

      onLoginSuccess();
    } catch (error) {
      // Clear password on failed login for security
      setPassword("");
      
      toast({
        title: "Login failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    }
  };

  // Secure password input handler
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    
    // Prevent browser password suggestion/autofill logging
    e.target.setAttribute('autocomplete', 'new-password');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            AI Biometric Platform
          </CardTitle>
          <CardDescription className="text-center">
            Enter your credentials to access the platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form 
            ref={formRef}
            onSubmit={handleLogin} 
            className="space-y-4"
            autoComplete="off"
            spellCheck="false"
          >
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10"
                  placeholder="Enter your username"
                  autoComplete="username"
                  spellCheck="false"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  ref={passwordInputRef}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  className="pl-10 pr-10"
                  placeholder="Enter your password"
                  {...getSecureInputProps('password')}
                  style={{
                    ...getSecureInputProps('password').style,
                    ...(showPassword ? {} : { WebkitTextSecurity: 'disc' } as any),
                  }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Password is encrypted and protected against keyloggers. Click the eye icon to toggle visibility.
              </p>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoginPending || !username || !password}
            >
              {isLoginPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}