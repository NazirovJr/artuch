import React from 'react';
import StationKdsScreen from './StationKdsScreen';

// Kitchen display = the 'kitchen' station queue. Bar uses the same component
// with station="bar" (see BarKdsScreen).
export default function KitchenScreen() {
  return <StationKdsScreen station="kitchen" title="Кухня" />;
}
