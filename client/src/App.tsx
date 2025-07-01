import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import BiometricMonitor from "@/pages/biometric-monitor";
import Analytics from "@/pages/analytics";
import TrainingData from "@/pages/training-data";
import PrivacySettings from "@/pages/privacy-settings";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/biometric-monitor" component={BiometricMonitor} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/training-data" component={TrainingData} />
      <Route path="/privacy-settings" component={PrivacySettings} />
      <Route component={NotFound} />
    </Switch>
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
