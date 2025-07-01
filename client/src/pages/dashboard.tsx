import { useEffect } from "react";
import Sidebar from "@/components/sidebar";
import PromptInterface from "@/components/prompt-interface";
import PromptRefinement from "@/components/ai-response";
import BiometricPanel from "@/components/biometric-panel";
import BiometricDashboard from "@/components/biometric-dashboard";
import { WeaviateStatus } from "@/components/weaviate-status";
import { NexisBrainStatus } from "@/components/nexis-brain-status";
import { WeaviatePrimaryStatus } from "@/components/weaviate-primary-status";
import { useBiometric } from "@/hooks/use-biometric";
import { useWebSocket } from "@/hooks/use-websocket";

export default function Dashboard() {
  const { currentBiometrics, updateBiometrics } = useBiometric();
  const { lastMessage } = useWebSocket('/ws');

  useEffect(() => {
    if (lastMessage?.type === 'biometric_update' && lastMessage.data) {
      updateBiometrics(lastMessage.data);
    }
  }, [lastMessage, updateBiometrics]);

  useEffect(() => {
    document.title = "🧠 AI Prompt Engineering Platform v3.0";
  }, []);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">Prompt Engineering Studio</h2>
              <div className="flex items-center space-x-2">
                <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  AI Ready
                </div>
                <div className="flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                  <i className="fas fa-heartbeat mr-1"></i>
                  <span>{currentBiometrics?.heartRate || 72}</span> BPM
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {/* Privacy Toggle */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Privacy Mode</span>
                <button className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-primary-600 transition-colors duration-200 ease-in-out">
                  <span className="translate-x-5 inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"></span>
                </button>
              </div>
              {/* User Avatar */}
              <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-white text-sm"></i>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6">
            {/* Prompt Engineering Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              <div className="xl:col-span-2">
                <PromptInterface />
              </div>
              <div className="space-y-4">
                <BiometricPanel currentBiometrics={currentBiometrics} />
                <WeaviatePrimaryStatus />
                <WeaviateStatus />
                <NexisBrainStatus />
              </div>
            </div>

            {/* Prompt Refinement Area */}
            <PromptRefinement />

            {/* Biometric Analytics Dashboard */}
            <BiometricDashboard />
          </div>
        </main>
      </div>
    </div>
  );
}
