import React from "react";
import { OscilloscopeWaveform } from "../AudioVisualizer/OscilloscopeWaveform";

interface NeuralWaveformProps {
  height?: number;
  showLabels?: boolean;
}

export const NeuralWaveform: React.FC<NeuralWaveformProps> = ({
  height = 48,
  showLabels = true,
}) => {
  return <OscilloscopeWaveform height={height} showControls={showLabels} />;
};
