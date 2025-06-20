import React, { useState, useRef, useEffect } from "react";
import io from "socket.io-client";
import AudioInputControl from "./AudioInputControl";

const socket = io("http://localhost:9000");

const LoadingSpinner: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{ margin: "auto", background: "none", display: "block" }}
    width="50px"
    height="50px"
    viewBox="0 0 100 100"
    preserveAspectRatio="xMidYMid"
  >
    <circle
      cx="50"
      cy="50"
      fill="none"
      stroke="#007bff"
      strokeWidth="10"
      r="35"
      strokeDasharray="164.93361431346415 56.97787143782138"
    >
      <animateTransform
        attributeName="transform"
        type="rotate"
        repeatCount="indefinite"
        dur="1s"
        values="0 50 50;360 50 50"
        keyTimes="0;1"
      />
    </circle>
  </svg>
);

enum EnumAudioStatus {
  ProcessingVoice = "Processing",
  RecordingVoice = "Recording",
  Silence = "Silence",
}

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingRef = useRef(false);
  const lastTranscriptRef = useRef("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [audioStatus, setAudioStatus] = useState<EnumAudioStatus>(
    EnumAudioStatus.Silence
  );

  useEffect(() => {
    socket.on("transcription", (data) => {
      console.log("Received transcription:", data);

      const textarea = document.querySelector("textarea");
      if (textarea) {
        const startPos = textarea.selectionStart;
        const endPos = textarea.selectionEnd;
        const newText = data.trim();

        setTranscription((prev) => {
          const beforeCursor = prev.substring(0, startPos);
          const afterCursor = prev.substring(endPos, prev.length);
          return beforeCursor + newText + afterCursor;
        });

        lastTranscriptRef.current = data;

        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd =
            startPos + newText.length;
        }, 0);

        setAudioStatus(EnumAudioStatus.Silence);
      }
    });

    socket.on("audioStatus", (data) => {
      console.log("Received audio status:", data);
      setAudioStatus(data);
    });

    return () => {
      socket.off("transcription");
      socket.off("audioStatus");
    };
  }, []);

  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!isRecordingRef.current) return;

      analyserRef.current?.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barCount = 21;
      const barWidth = canvas.width / barCount;
      const centerY = canvas.height / 2;

      for (let i = 0; i < barCount; i++) {
        const index = Math.floor((i / barCount) * bufferLength);
        const value = dataArray[index];
        const barHeight = (value / 255) * canvas.height * 0.5;

        const x = i * barWidth + barWidth / 4;
        ctx.fillStyle = "#003366";
        ctx.fillRect(x, centerY - barHeight, barWidth / 2, barHeight * 2);
      }

      requestAnimationFrame(draw);
    };
    draw();
  };

  const startRecording = async () => {
    isRecordingRef.current = true;
    setIsRecording(true);

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1 },
    });
    streamRef.current = stream;

    const audioContext = new AudioContext({ sampleRate: 16000 });
    await audioContext.resume();

    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyser.connect(processor);
    processor.connect(audioContext.destination);

    processor.onaudioprocess = (event) => {
      if (!isRecordingRef.current) return;

      const audioData = event.inputBuffer.getChannelData(0);
      const int16Array = new Int16Array(audioData.length);
      for (let i = 0; i < audioData.length; i++) {
        const s = Math.max(-1, Math.min(1, audioData[i])); // clamp to [-1, 1]
        int16Array[i] = s < 0 ? s * 32768 : s * 32767;
      }
      socket.emit("audio", int16Array.buffer);
    };

    audioContextRef.current = audioContext;
    processorRef.current = processor;
    analyserRef.current = analyser;
    drawWaveform();
  };

  const stopRecording = () => {
    setAudioStatus(EnumAudioStatus.Silence);
    setIsRecording(false);
    isRecordingRef.current = false;
    socket.emit("stop");

    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current)
      streamRef.current.getTracks().forEach((track) => track.stop());
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>Voice To Text (Whisper AI)</h1>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
      <br />
      <textarea
        value={transcription}
        onChange={(e) => setTranscription(e.target.value)}
        style={{ width: "100%", height: "200px", marginTop: "20px" }}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: "20px",
        }}
      >
        <div>
          {(audioStatus === EnumAudioStatus.ProcessingVoice ||
            audioStatus === EnumAudioStatus.RecordingVoice) && (
            <>
              <LoadingSpinner />
              <div>{audioStatus}</div>
            </>
          )}
        </div>
        <canvas
          ref={canvasRef}
          style={{
            border: "1px solid black",
            marginTop: "20px",
            width: "200px",
            height: "100px",
          }}
        ></canvas>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          style={{
            marginLeft: "10px",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          {isRecording ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="red"
            >
              <rect width="24" height="24" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="green"
            >
              <circle cx="12" cy="12" r="12" />
            </svg>
          )}
        </button>
        <AudioInputControl />
      </div>
    </div>
  );
};

export default App;
