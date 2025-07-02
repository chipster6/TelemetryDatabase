import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useSecureInput } from "@/hooks/useSecureInput";
import { SecurePasswordInput } from "@/components/secure-password-input";
import { Lock, User, Shield } from "lucide-react";

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { toast } = useToast();
  const { login, isLoginPending } = useAuth();
  const { getSecureInputProps } = useSecureInput();
  const formRef = useRef<HTMLFormElement>(null);

  // Clear password from memory when component unmounts
  useEffect(() => {
    return () => {
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

  // Secure password change handler
  const handlePasswordChange = (value: string) => {
    setPassword(value);
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
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            Use your configured username and password from Replit secrets
          </div>
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
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400 z-10" />
                <SecurePasswordInput
                  id="password"
                  value={password}
                  onChange={handlePasswordChange}
                  className="pl-10 pr-10"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Secure password input with visibility toggle
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