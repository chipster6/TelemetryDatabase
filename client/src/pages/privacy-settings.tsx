import { useEffect, useState } from "react";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function PrivacySettings() {
  const [settings, setSettings] = useState({
    encryptionEnabled: true,
    biometricDataStorage: true,
    cloudBackup: true,
    anonymousMode: false,
    dataRetention: 30,
    shareAnalytics: false
  });

  useEffect(() => {
    document.title = "🔒 Privacy Settings - AI Platform v3.0";
  }, []);

  const handleSettingChange = (key: string, value: boolean | number) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-xl font-semibold text-gray-900">Privacy & Security Settings</h2>
              <div className="flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                Quantum Secure
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="p-6 max-w-4xl">
            {/* Encryption Settings */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Post-Quantum Encryption</CardTitle>
                <CardDescription>
                  Advanced encryption protocols protecting your data against quantum computing threats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Encryption Status</h4>
                      <p className="text-sm text-gray-600">
                        All sensitive data encrypted with quantum-resistant algorithms
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-100 text-green-800">
                        <i className="fas fa-shield-alt mr-1"></i>
                        Active
                      </Badge>
                      <Switch
                        checked={settings.encryptionEnabled}
                        onCheckedChange={(checked) => handleSettingChange('encryptionEnabled', checked)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Algorithm</span>
                      <span className="text-sm text-gray-600">HMAC-based Stream Cipher</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Key Rotation</span>
                      <span className="text-sm text-gray-600">Automatic</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Integrity Verification</span>
                      <span className="text-sm text-gray-600">SHA-256 HMAC</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Forward Secrecy</span>
                      <span className="text-sm text-gray-600">Enabled</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Data Storage Settings */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Data Storage & Retention</CardTitle>
                <CardDescription>
                  Control how your biometric and interaction data is stored and processed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Biometric Data Storage</h4>
                      <p className="text-sm text-gray-600">
                        Store physiological readings for analysis and optimization
                      </p>
                    </div>
                    <Switch
                      checked={settings.biometricDataStorage}
                      onCheckedChange={(checked) => handleSettingChange('biometricDataStorage', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Cloud Backup</h4>
                      <p className="text-sm text-gray-600">
                        Encrypted backup to Weaviate cloud for data retention
                      </p>
                    </div>
                    <Switch
                      checked={settings.cloudBackup}
                      onCheckedChange={(checked) => handleSettingChange('cloudBackup', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Anonymous Mode</h4>
                      <p className="text-sm text-gray-600">
                        Remove personal identifiers from stored data
                      </p>
                    </div>
                    <Switch
                      checked={settings.anonymousMode}
                      onCheckedChange={(checked) => handleSettingChange('anonymousMode', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium">Share Analytics</h4>
                      <p className="text-sm text-gray-600">
                        Contribute anonymized data to improve AI models
                      </p>
                    </div>
                    <Switch
                      checked={settings.shareAnalytics}
                      onCheckedChange={(checked) => handleSettingChange('shareAnalytics', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vector Database Security */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Vector Database Security</CardTitle>
                <CardDescription>
                  Advanced security features for semantic search and storage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Security Features</h4>
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">Sharded vector storage</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">Encrypted embeddings</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">Secure search tunneling</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                        <span className="text-sm">Integrity verification</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Scheduled Operations</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Daily compression</span>
                        <span className="text-gray-600">2:00 AM UTC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Weekly backup</span>
                        <span className="text-gray-600">Sundays</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Key rotation</span>
                        <span className="text-gray-600">Monthly</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Analytics processing</span>
                        <span className="text-gray-600">Hourly</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex space-x-4">
              <Button>
                <i className="fas fa-save mr-2"></i>
                Save Settings
              </Button>
              <Button variant="outline">
                <i className="fas fa-download mr-2"></i>
                Export Data
              </Button>
              <Button variant="outline">
                <i className="fas fa-key mr-2"></i>
                Rotate Keys
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}