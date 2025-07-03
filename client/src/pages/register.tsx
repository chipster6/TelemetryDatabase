import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useSecureAuth } from "@/hooks/useSecureAuth";
import { SecurePasswordInput } from "@/components/secure-password-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertCircle, UserPlus } from "lucide-react";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { register, isRegisterPending } = useAuth();
  const { getSecureInputProps } = useSecureAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!username.trim() || !password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (username.length < 3 || username.length > 50) {
      setError("Username must be between 3 and 50 characters");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Password strength check
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const strengthCount = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChar].filter(Boolean).length;
    
    if (strengthCount < 3) {
      setError("Password must contain at least 3 of: uppercase, lowercase, numbers, special characters");
      return;
    }

    try {
      await register({ username: username.trim(), password });
      toast({
        title: "Registration successful",
        description: "Your account has been created and you are now logged in",
        variant: "default",
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Registration failed");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <CardTitle className="text-2xl">Create Account</CardTitle>
          </div>
          <CardDescription>
            Register for a secure account with biometric protection
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                minLength={3}
                maxLength={50}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <SecurePasswordInput
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                {...getSecureInputProps()}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <SecurePasswordInput
                id="confirmPassword"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                {...getSecureInputProps()}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>

            <div className="text-sm text-muted-foreground">
              Password must:
              <ul className="list-disc list-inside mt-1">
                <li>Be at least 8 characters long</li>
                <li>Contain at least 3 of: uppercase, lowercase, numbers, special characters</li>
              </ul>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isRegisterPending}
            >
              {isRegisterPending ? (
                "Creating account..."
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Account
                </>
              )}
            </Button>
            
            <div className="text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}