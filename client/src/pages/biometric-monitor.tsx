import { useEffect } from "react";
import Sidebar from "@/components/sidebar";
import BiometricDashboard from "@/components/biometric-dashboard";
import BiometricPanel from "@/components/biometric-panel";
import { useBiometric } from "@/hooks/use-biometric";
import { useWebSocket } from "@/hooks/use-websocket";

export default function BiometricMonitor() {
  const { currentBiometrics, updateBiometrics } = useBiometric();
  const { lastMessage } = useWebSocket('/ws');

  useEffect(() => {
    if (lastMessage?.type === 'biometric_update' && lastMessage.data) {
      updateBiometrics(lastMessage.data);
    }
  }, [lastMessage, updateBiometrics]);

  useEffect(() => {
    document.title = "🫀 Biometric Monitor - AI Platform v3.0";
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">Biometric Monitor</h2>
              <div className="flex items-center space-x-2">
                <div className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse"></div>
                  Live Monitoring
                </div>
                <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  <i className="fas fa-heartbeat mr-1"></i>
                  <span>{currentBiometrics?.heartRate || 72}</span> BPM
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <div className="lg:col-span-2">
                <BiometricDashboard />
              </div>
              <div>
                <BiometricPanel currentBiometrics={currentBiometrics} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}