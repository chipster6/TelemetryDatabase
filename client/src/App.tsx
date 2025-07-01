import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import BiometricMonitor from "@/pages/biometric-monitor";
import Analytics from "@/pages/analytics";
import TrainingData from "@/pages/training-data";
import PrivacySettings from "@/pages/privacy-settings";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

function Router() {
  const { isAuthenticated, isLoading, logout, user } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              AI Biometric Platform
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                Welcome, {user?.username}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/biometric-monitor" component={BiometricMonitor} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/training-data" component={TrainingData} />
          <Route path="/privacy-settings" component={PrivacySettings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
