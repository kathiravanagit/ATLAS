import { useDashboard } from '../context/DashboardContext';
import MapView from '../components/MapView';
import MuleNetworkGraph from '../components/MuleNetworkGraph';
import DemoNotice from '../components/DemoNotice';

export default function MapPage() {
  const { prediction, selectedLocation, setSelectedLocation, cityCenter, dataMode } = useDashboard();

  return (
    <div className="space-y-6">
      <MapView
        locations={prediction.ranked_locations}
        selectedLocation={selectedLocation}
        onSelectLocation={setSelectedLocation}
        cityCenter={cityCenter}
        surface={prediction.risk_surface}
        zones={prediction.intervention_zones}
      />
      {dataMode === 'demo' ? (
        <DemoNotice
          inline
          title="Account network"
          description="The transfer graph is built from backend records. The demo shows ranked fixtures and zone outlines only, so this panel stays empty."
        />
      ) : <MuleNetworkGraph />}
    </div>
  );
}
