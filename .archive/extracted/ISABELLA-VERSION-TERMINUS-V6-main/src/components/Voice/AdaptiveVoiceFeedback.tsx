import React, { useEffect, useRef } from "react";
import { useCrown } from "../../context/CrownContext";

interface AdaptiveVoiceFeedbackProps {
  className?: string;
  width?: number;
  height?: number;
}

export const AdaptiveVoiceFeedback: React.FC<AdaptiveVoiceFeedbackProps> = ({ 
  className = "", 
  width = 600, 
  height = 100 
}) => {
  const { state } = useCrown();
  const { isSpeaking, isListening } = state;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // If not active, clean up and clear canvas
    if (!isSpeaking && !isListening) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Draw flat line
          ctx.beginPath();
          ctx.moveTo(0, canvas.height / 2);
          ctx.lineTo(canvas.width, canvas.height / 2);
          ctx.strokeStyle = "rgba(16, 185, 129, 0.2)";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
      return;
    }

    const initAudio = async () => {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        if (isListening) {
          // Connect real microphone for listening
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          streamRef.current = stream;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);
        } else if (isSpeaking) {
          // Simulate RVC/VITS output audio context (since we can't easily hook native SpeechSynthesis)
          // In a real VITS implementation, the <audio> tag stream would be piped here using createMediaElementSource
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 150; // Human vocal fundamental freq
          
          // Modulate gain to simulate speech envelope
          const modulateEnvelope = () => {
            if (!isSpeaking || !gainNode) return;
            const now = audioCtx.currentTime;
            const duration = 0.1 + Math.random() * 0.3;
            gainNode.gain.setValueAtTime(gainNode.gain.value, now);
            gainNode.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.5, now + duration / 2);
            gainNode.gain.linearRampToValueAtTime(0.1, now + duration);
            setTimeout(modulateEnvelope, duration * 1000);
          };
          
          oscillator.connect(gainNode);
          gainNode.connect(analyser);
          // Do not connect to destination to avoid playing the simulated tone
          oscillator.start();
          modulateEnvelope();
        }

        drawWaveform();
      } catch (err) {
        console.error("Failed to initialize Web Audio API for AdaptiveVoiceFeedback", err);
      }
    };

    initAudio();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isSpeaking, isListening]);

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "rgba(3, 7, 18, 0.2)"; // Slate-950 with opacity for motion trail
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      // Use Amber when speaking (Isabella), Rose/Emerald when listening (User)
      ctx.strokeStyle = isSpeaking ? "rgba(245, 158, 11, 0.8)" : "rgba(16, 185, 129, 0.8)"; 
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          // Add a bit of smoothing/bezier curves for organic look
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full rounded-lg border border-slate-800/50 bg-[#030712] shadow-inner"
        style={{ filter: "drop-shadow(0 0 8px rgba(16, 185, 129, 0.1))" }}
      />
      {/* Decorative center line */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-full h-[1px] bg-emerald-500/10" />
      </div>
      
      {/* Status Badges */}
      <div className="absolute top-2 right-2 flex gap-2">
        {isListening && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 font-mono animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            MIC ACTIVE
          </span>
        )}
        {isSpeaking && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-mono animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            VITS SYNTHESIS
          </span>
        )}
      </div>
    </div>
  );
};
