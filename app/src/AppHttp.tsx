import React, { useState, useRef } from "react";
import axios from "axios";
import RecordRTC from "recordrtc";

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState("");
  const recorderRef = useRef<RecordRTC | null>(null);

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    recorderRef.current = new RecordRTC(stream, {
      type: "audio",
      mimeType: "audio/wav",
      recorderType: RecordRTC.StereoAudioRecorder,
      numberOfAudioChannels: 1,
      sampleRate: 48000,
      desiredSampRate: 16000,
    });

    recorderRef.current.startRecording();
    setIsRecording(true);
  };

  const stopRecording = async () => {
    if (recorderRef.current) {
      recorderRef.current.stopRecording(async () => {
        setIsRecording(false);
        const blob = recorderRef.current?.getBlob();
        if (blob) {
          const formData = new FormData();
          formData.append("audio", blob, "audio.wav");

          try {
            const response = await axios.post(
              "http://localhost:5000/transcribe",
              formData,
              {
                headers: { "Content-Type": "multipart/form-data" },
              }
            );
            setTranscription(response.data.data);
          } catch (error) {
            console.error("Error transcribing audio:", error);
          }
        } else {
          console.error("Error: Blob is undefined");
        }
      });
    }
  };

  return (
    <div style={{ textAlign: "center", padding: "20px" }}>
      <h1>Google Cloud Speech-to-Text</h1>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
      <br />
      <textarea
        value={transcription}
        readOnly
        style={{ width: "100%", height: "200px", marginTop: "20px" }}
      />
      <div style={{ textAlign: "left", marginTop: "20px", fontSize: "24px" }}>
        <p>Patient, männlich, 45 Jahre.</p>
        <p>
          Anamnestisch persistierende Gonalgien bei mechanischer Belastung sowie
          intermittierende Hydropsbildung.{" "}
        </p>
        <p>
          Magnetresonanztomographische Diagnostik zeigt eine komplexe Ruptur des
          Meniscus medialis mit longitudinaler sowie radialer Komponente,
          begleitende Synovialitis mit hyperplastischen Zottenstrukturen sowie
          konsekutiver Chondromalazie Grad zwei des Condylus medialis femoris.
          Kein Anhalt für eine osteochondrale Dissektion oder eine subchondrale
          Mikrofraktur.
        </p>
        <p>
          Differenzialdiagnostisch kein Hinweis auf eine aktivierte rheumatoide
          Arthritis oder eine septische Arthritis. Keine floride
          Synovialproliferation im Sinne einer Villonodulären Synovialitis.{" "}
        </p>
        <p>
          Therapieempfehlung: Initial konservative Therapie mittels Analgesie
          und nichtsteroidalen Antiphlogistika sowie physiotherapeutischer
          Mobilisation mit isometrischem Quadrizepstraining. Bei Persistenz der
          Symptomatik Indikationsstellung zur arthroskopischen
          Partialmeniskektomie oder Meniskusrefixation unter Berücksichtigung
          der biomechanischen Achsverhältnisse und der femorotibialen
          Gelenkkongruenz.
        </p>
      </div>
    </div>
  );
};

export default App;
