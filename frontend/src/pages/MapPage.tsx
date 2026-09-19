import { motion } from 'motion/react';
import { useDashboard } from '../context/DashboardContext';
import MapView from '../components/MapView';
import MuleNetworkGraph from '../components/MuleNetworkGraph';

export default function MapPage() {
  const { prediction, selectedLocation, setSelectedLocation, cityCenter } = useDashboard();

  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}
      className="space-y-6">
      <MapView locations={prediction.ranked_locations} selectedLocation={selectedLocation} onSelectLocation={setSelectedLocation} cityCenter={cityCenter} />
      <MuleNetworkGraph />
    </motion.div>
  );
}
