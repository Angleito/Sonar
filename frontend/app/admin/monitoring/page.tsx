/**
 * Admin Kiosk Monitoring Page
 *
 * Admin-only page for monitoring kiosk health and metrics
 * Route: /admin/monitoring
 */

import { KioskMonitoringDashboard } from '@/components/admin/KioskMonitoringDashboard';

export const metadata = {
  title: 'Kiosk Monitoring | SONAR Admin',
  description: 'Monitor kiosk health, reserves, and transaction success rates',
};

export default function MonitoringPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Kiosk Monitoring Dashboard</h1>
        <p className="text-gray-600">
          Real-time monitoring of SONAR kiosk health, reserves, and transaction metrics
        </p>
      </header>

      <KioskMonitoringDashboard />

      <footer className="mt-12 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Health Checks</h3>
            <ul className="space-y-1">
              <li>• Reserve levels (low/critical thresholds)</li>
              <li>• Purchase success rate (&lt;85% warning)</li>
              <li>• Depletion rate (48h warning)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Alert Thresholds</h3>
            <ul className="space-y-1">
              <li>• SONAR Low: &lt;1M tokens</li>
              <li>• SONAR Critical: &lt;100K tokens</li>
              <li>• Success Rate Warning: &lt;85%</li>
              <li>• Success Rate Critical: &lt;70%</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Monitoring Details</h3>
            <ul className="space-y-1">
              <li>• Backend checks every 5 minutes</li>
              <li>• Frontend auto-refresh: 30 seconds</li>
              <li>• Metrics window: 24 hours</li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This dashboard is for administrative use. In production,
            implement proper authentication and access control before exposing this route.
          </p>
        </div>
      </footer>
    </div>
  );
}
