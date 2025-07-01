import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";

interface DeviceConnection {
  id: number;
  deviceType: string;
  deviceName: string;
  connectionStatus: string;
}

export default function Sidebar() {
  const { data: devices = [] } = useQuery<DeviceConnection[]>({
    queryKey: ['/api/devices'],
  });
  const [location] = useLocation();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600 bg-green-500';
      case 'simulated':
        return 'text-yellow-600 bg-yellow-500';
      default:
        return 'text-gray-600 bg-gray-500';
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'heart_rate_monitor':
        return 'fas fa-heartbeat';
      case 'smart_ring':
        return 'fas fa-ring';
      case 'environmental':
        return 'fas fa-thermometer-half';
      default:
        return 'fas fa-device';
    }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo and Title */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-lg flex items-center justify-center">
            <i className="fas fa-brain text-white text-sm"></i>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AI Platform</h1>
            <p className="text-xs text-gray-500">v3.0 - Biometric</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          location === '/' 
            ? 'text-primary-600 bg-primary-50 border border-primary-200' 
            : 'text-gray-600 hover:bg-gray-100'
        }`}>
          <i className="fas fa-edit w-5 h-5 mr-3"></i>
          Prompt Engineering
        </Link>
        <Link href="/biometric-monitor" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          location === '/biometric-monitor' 
            ? 'text-primary-600 bg-primary-50 border border-primary-200' 
            : 'text-gray-600 hover:bg-gray-100'
        }`}>
          <i className="fas fa-heartbeat w-5 h-5 mr-3"></i>
          Biometric Monitor
        </Link>
        <Link href="/analytics" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          location === '/analytics' 
            ? 'text-primary-600 bg-primary-50 border border-primary-200' 
            : 'text-gray-600 hover:bg-gray-100'
        }`}>
          <i className="fas fa-chart-line w-5 h-5 mr-3"></i>
          Analytics
        </Link>
        <Link href="/training-data" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          location === '/training-data' 
            ? 'text-primary-600 bg-primary-50 border border-primary-200' 
            : 'text-gray-600 hover:bg-gray-100'
        }`}>
          <i className="fas fa-database w-5 h-5 mr-3"></i>
          Training Data
        </Link>
        <Link href="/weaviate-monitor" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          location === '/weaviate-monitor' 
            ? 'text-primary-600 bg-primary-50 border border-primary-200' 
            : 'text-gray-600 hover:bg-gray-100'
        }`}>
          <i className="fas fa-brain w-5 h-5 mr-3"></i>
          Weaviate Monitor
        </Link>
        <Link href="/privacy-settings" className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
          location === '/privacy-settings' 
            ? 'text-primary-600 bg-primary-50 border border-primary-200' 
            : 'text-gray-600 hover:bg-gray-100'
        }`}>
          <i className="fas fa-shield-alt w-5 h-5 mr-3"></i>
          Privacy Settings
        </Link>
      </nav>

      {/* Device Status */}
      <div className="p-4 border-t border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Connected Devices</h3>
        <div className="space-y-2">
          {devices.map((device) => (
            <div key={device.id} className="flex items-center justify-between">
              <div className="flex items-center">
                <i className={`${getDeviceIcon(device.deviceType)} text-gray-500 text-sm mr-2`}></i>
                <span className="text-sm text-gray-600">{device.deviceName}</span>
              </div>
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(device.connectionStatus).split(' ')[1]} ${device.connectionStatus === 'connected' ? 'animate-pulse' : ''}`}></div>
                <span className={`text-xs ${getStatusColor(device.connectionStatus).split(' ')[0]}`}>
                  {device.connectionStatus === 'connected' ? 'Active' : 
                   device.connectionStatus === 'simulated' ? 'Simulated' : 
                   'Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
