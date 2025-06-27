import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { WaveFile } from "wavefile";
import { randomString } from "./tools";
import { SpeechClient, protos } from "@google-cloud/speech";

interface ConnectionState {
  audioChunks: Buffer[];
  silenceThreshold: number;
  j: number;
  numSilenceChunks: number;
  wasLastWAVFileClosedBySilence: boolean;
  transcriptionInProgress: boolean;
  isRealTimeActive: boolean;
  periodCounter: number;
  lastTranscriptSent: string;
  partialTranscriptBuffer: string[];
  hasProcessedWhisperAfterPeriod: boolean;
  googleSpeechStream: any;
  currentSentence: string;
  lastWhisperedChunkIndex: number;
  continuousTranscript: string;
}

const bcCfg = require("./bc-backend.json");
const q = (...args: any[]) => {
  console.log(new Date().toISOString(), ...args);
};

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "http://localhost:3000" },
});

const openai = new OpenAI({ apiKey: bcCfg.openAIKey });
const speechClient = new SpeechClient({
  keyFilename: path.join(__dirname, "google-key-2.json"),
});

const whisperHallucinations = [
  " www.mooji.org",
  " Ondertitels ingediend door de Amara.org gemeenschap",
  " Ondertiteld door de Amara.org gemeenschap",
  " Ondertiteling door de Amara.org gemeenschap",
  " Untertitelung aufgrund der Amara.org-Community",
  " Untertitel im Auftrag des ZDF für funk, 2017",
  " Untertitel von Stephanie Geiges",
  " Untertitel der Amara.org-Community",
  " Untertitel im Auftrag des ZDF, 2017",
  " Untertitel im Auftrag des ZDF, 2020",
  " Untertitel im Auftrag des ZDF, 2018",
  " Untertitel im Auftrag des ZDF, 2021",
  " Untertitelung im Auftrag des ZDF, 2021",
  " Copyright WDR 2021",
  " Copyright WDR 2020",
  " Copyright WDR 2019",
  " SWR 2021",
  " SWR 2020",
  " Sous-titres réalisés para la communauté d'Amara.org",
  " Sous-titres réalisés par la communauté d'Amara.org",
  " Sous-titres fait par Sous-titres par Amara.org",
  " Sous-titres réalisés par les SousTitres d'Amara.org",
  " Sous-titres par Amara.org",
  " Sous-titres par la communauté d'Amara.org",
  " Sous-titres réalisés pour la communauté d'Amara.org",
  " Sous-titres réalisés par la communauté de l'Amara.org",
  " Sous-Titres faits par la communauté d'Amara.org",
  " Sous-titres par l'Amara.org",
  " Sous-titres fait par la communauté d'Amara.org",
  " Sous-titrage ST' 501",
  " Sous-titrage ST'501",
  " Cliquez-vous sur les sous-titres et abonnez-vous à la chaîne d'Amara.org",
  " ❤️ par SousTitreur.com",
  " Sottotitoli creati dalla comunità Amara.org",
  " Sottotitoli di Sottotitoli di Amara.org",
  " Sottotitoli e revisione al canale di Amara.org",
  " Sottotitoli e revisione a cura di Amara.org",
  " Sottotitoli e revisione a cura di QTSS",
  " Sottotitoli e revisione a cura di QTSS.",
  " Sottotitoli a cura di QTSS",
  " Subtítulos realizados por la comunidad de Amara.org",
  " Subtitulado por la comunidad de Amara.org",
  " Subtítulos por la comunidad de Amara.org",
  " Subtítulos creados por la comunidad de Amara.org",
  " Subtítulos en español de Amara.org",
  " Subtítulos hechos por la comunidad de Amara.org",
  " Subtitulos por la comunidad de Amara.org",
  " Más información www.alimmenta.com",
  " www.mooji.org",
  " Subtítulos realizados por la comunidad de Amara.org",
  " Legendas pela comunidade Amara.org",
  " Legendas pela comunidade de Amara.org",
  " Legendas pela comunidade do Amara.org",
  " Legendas pela comunidade das Amara.org",
  " Transcrição e Legendas pela comunidade de Amara.org",
  " Sottotitoli creati dalla comunità Amara.org",
  " Sous-titres réalisés para la communauté d'Amara.org",
  " Sous-titres réalisés para la communauté d'Amara.org",
  " Napisy stworzone przez społeczność Amara.org",
  " Napisy wykonane przez społeczność Amara.org",
  " Zdjęcia i napisy stworzone przez społeczność Amara.org",
  " napisy stworzone przez społeczność Amara.org",
  " Tłumaczenie i napisy stworzone przez społeczność Amara.org",
  " Napisy stworzone przez społeczności Amara.org",
  " Tłumaczenie stworzone przez społeczność Amara.org",
  " Napisy robione przez społeczność Amara.org",
  " www.multi-moto.eu",
  " Редактор субтитров А.Синецкая Корректор А.Егорова",
  " Yorumlarınızıza abone olmayı unutmayın.",
  " Sottotitoli creati dalla comunità Amara.org",
  "字幕由Amara.org社区提供",
  "小編字幕由Amara.org社區提供",
  "ご視聴ありがとうございました",
  "Thank you for watching",
  "チャンネル登録をお願いします。",
  "📢 Share this video with your friends on social media",
  "180°C-356°F 25-30 min",
  "チョコレートの上にチョコレートを乗せます チョコレートの上にチョコレートを乗せます",
  "チョコレートの上にチョコレートを乗せます 見てくれてありがとう",
  "チョコレートの上にチョコレートを乗せます 完成です",
  "📢 Share this video",
  "You",
  "MBC 뉴스 이덕영입니다.",
];

// Helper functions for Whisper
async function transcribeWhisper(wavFilename: string): Promise<string> {
  q(`[Whisper] Starting transcription for file: ${wavFilename}`);
  try {
    const fileStream = fs.createReadStream(wavFilename);
    const res = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fileStream,
      response_format: "text",
      language: "en",
    });
    q(`[Whisper] Transcription successful for file: ${wavFilename}`);
    return res as unknown as string;
  } catch (e) {
    q(`[Whisper] Transcription failed for file: ${wavFilename}`, e);
    throw e;
  }
}

async function writeWavFile(
  audioChunks: Buffer[],
  outputFilePath: string
): Promise<void> {
  if (audioChunks.length === 0) {
    q(`[Whisper] No audio chunks to write.`);
    return;
  }
  try {
    const fullBuffer = Buffer.concat(audioChunks);
    const int16Array = new Int16Array(
      fullBuffer.buffer,
      fullBuffer.byteOffset,
      fullBuffer.byteLength / 2
    );
    const wav = new WaveFile();
    wav.fromScratch(1, 16000, "16", int16Array);
    const wavBuffer = wav.toBuffer();
    const dir = path.dirname(outputFilePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(outputFilePath, wavBuffer);
    q(
      `[Whisper] WAV file written to: ${outputFilePath} (${audioChunks.length} chunks)`
    );
  } catch (err) {
    q(`[Whisper] Error writing WAV file:`, err);
    throw err;
  }
}

const calculateVolume = (buffer: Buffer): number => {
  const samples = new Int16Array(buffer.buffer);
  let sum = 0;
  for (const sample of samples) sum += sample ** 2;
  return Math.floor(Math.sqrt(sum / samples.length));
};

const normalizeTranscript = (transcript: string): string => {
  return transcript
    .split("\n")
    .map((line) =>
      whisperHallucinations.reduce(
        (acc, hallucination) => acc.replaceAll(hallucination, ""),
        line
      )
    )
    .join("\n")
    .trim();
};

function containsPeriod(text: string): boolean {
  const t = text.toLowerCase().trim();
  return /(\b(period|full stop)\b\.?)/.test(t);
}

function removePeriodWords(text: string): string {
  return text
    .replace(/(\s*\b(period|full stop)\b\.?\s*)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Main per-connection logic
io.on("connection", (socket: Socket) => {
  q(`[Socket] Client connected: ${socket.id}`);

  const state: ConnectionState = {
    audioChunks: [],
    silenceThreshold: 50,
    j: 0,
    numSilenceChunks: 0,
    wasLastWAVFileClosedBySilence: false,
    transcriptionInProgress: false,
    isRealTimeActive: false,
    periodCounter: 0,
    lastTranscriptSent: "",
    partialTranscriptBuffer: [],
    hasProcessedWhisperAfterPeriod: false,
    googleSpeechStream: null,
    currentSentence: "",
    lastWhisperedChunkIndex: 0,
    continuousTranscript: "",
  };

  const numSilenceChunksThreshold = 5;
  const numMinChunksForWAVFile = 3;

  const sendTranscriptToClient = (
    transcript: string,
    isStop: boolean = false,
    isRealTime: boolean = false,
    source: "google" | "whisper-silence" | "whisper-keyword" = "whisper-silence"
  ) => {
    const normalizedTranscript = normalizeTranscript(transcript);
    q(
      `[Transcript] Sending to client ${socket.id} | Source: ${source} | isStop: ${isStop} | isRealTime: ${isRealTime}`
    );
    socket.emit("transcription", normalizedTranscript);
    if (source.includes("whisper")) {
      state.hasProcessedWhisperAfterPeriod = true;
    }
  };

  // Whisper processing utility
  async function processWithWhisper(
    reason: string,
    customChunks?: Buffer[]
  ): Promise<void> {
    const chunks =
      customChunks || state.audioChunks.slice(state.lastWhisperedChunkIndex);

    if (chunks.length <= numMinChunksForWAVFile) {
      q(
        `[Whisper] Skipping Whisper (${reason}) — too few new chunks:`,
        chunks.length
      );
      return;
    }

    const audioSessionId = randomString(16);
    const outputFolder = path.join(__dirname, "wavfiles");
    const wavPath = path.join(
      outputFolder,
      `${reason}-${audioSessionId}-${state.j}.wav`
    );

    try {
      await writeWavFile(chunks, wavPath);
      const transcript = await transcribeWhisper(wavPath);
      const cleaned = removePeriodWords(transcript);

      if (cleaned) {
        sendTranscriptToClient(
          cleaned,
          reason === "stop",
          false,
          reason === "hello" ? "whisper-keyword" : "whisper-silence"
        );
        q(`[Whisper] (${reason}):`, cleaned);
      }

      // Update processed chunk index only if we used the main chunk array
      if (!customChunks) {
        state.lastWhisperedChunkIndex = state.audioChunks.length;
      }

      state.j++;

      if (reason === "period") {
        state.hasProcessedWhisperAfterPeriod = true;
        state.periodCounter++;
        state.currentSentence = "";
      }

      // For keyword triggers, clear chunks to avoid double processing
      if (reason === "hello") {
        state.audioChunks = [];
        state.lastWhisperedChunkIndex = 0;
        state.partialTranscriptBuffer = [];
        state.hasProcessedWhisperAfterPeriod = true;
      }
    } catch (error) {
      q(`[Whisper] Error processing (${reason}):`, error);
    }
  }

  function resetStateAfterKeywordTrigger() {
    q(`[State] Resetting state after keyword trigger for ${socket.id}`);

    closeGoogleStream(); // Close Google if open

    state.audioChunks = [];
    state.lastWhisperedChunkIndex = 0;
    state.j = 0;
    state.numSilenceChunks = 0;
    state.wasLastWAVFileClosedBySilence = false;
    state.transcriptionInProgress = false;
    state.isRealTimeActive = false;
    state.periodCounter = 0;
    state.currentSentence = "";
    state.lastTranscriptSent = "";
    state.partialTranscriptBuffer = [];
    state.hasProcessedWhisperAfterPeriod = false;
    state.continuousTranscript = "";
  }

  // Google Speech Stream setup
  function startGoogleStream() {
    if (state.googleSpeechStream) {
      q(`[Google] Stream already active for ${socket.id}`);
      return;
    }

    q(`[Google] Starting Google Speech stream for ${socket.id}`);

    const request = {
      config: {
        encoding:
          protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding
            .LINEAR16,
        sampleRateHertz: 16000,
        languageCode: "en-US",
        enableAutomaticPunctuation: true,
      },
      interimResults: true,
    };

    state.googleSpeechStream = speechClient
      .streamingRecognize(request)
      .on("error", (err) => {
        q(`[Google] Error for ${socket.id}:`, err);
        state.isRealTimeActive = false;
        state.googleSpeechStream = null;
        socket.emit("error", "Google Speech connection error");
      })
      .on("data", async (data: any) => {
        const result = data.results?.[0];
        if (!result?.alternatives?.[0]) return;

        const transcript = result.alternatives[0].transcript;
        const isFinal = result.isFinal;

        q(
          `[Google][${socket.id}] ${
            isFinal ? "Final" : "Interim"
          }: ${transcript}`
        );

        if (transcript && transcript.trim() !== "") {
          state.partialTranscriptBuffer.push(transcript);

          // Check for hello keyword
          const lower = transcript.toLowerCase();
          const hasHelloKeyword =
            lower.includes("hello") ||
            lower.includes("hello.") ||
            lower.includes("hello?");

          q(
            `[Google][${socket.id}] Keyword 'hello' detected: ${hasHelloKeyword}`
          );

          if (isFinal) {
            state.currentSentence += " " + transcript;
            const normalized = transcript.toLowerCase().trim();

            if (hasHelloKeyword) {
              q(
                `[Google][${socket.id}] Triggering Whisper due to keyword 'hello'.`
              );

              // Trim last few chunks to exclude keyword-trigger audio from Whisper
              const keywordTriggerChunkTrim = 4;
              const trimmedChunks =
                state.audioChunks.length > keywordTriggerChunkTrim
                  ? state.audioChunks.slice(0, -keywordTriggerChunkTrim)
                  : [];

              if (trimmedChunks.length > numMinChunksForWAVFile) {
                await processWithWhisper("hello", trimmedChunks);
                q(
                  `[Google][${socket.id}] Whisper transcription complete after keyword.`
                );
                resetStateAfterKeywordTrigger();
              } else {
                q(
                  `[Google][${socket.id}] Too few chunks after keyword trim, skipping Whisper.`
                );
              }
            } else if (containsPeriod(normalized)) {
              q(
                `[Google][${socket.id}] Triggering Whisper due to period detection.`
              );
              await processWithWhisper("period");
            }
          }
        }
      });

    state.isRealTimeActive = true;
    socket.emit("audioStatus", "Recording");
  }

  function closeGoogleStream() {
    if (state.googleSpeechStream) {
      q(`[Google] Closing Google Speech stream for ${socket.id}`);
      state.googleSpeechStream.end();
      state.googleSpeechStream = null;
      state.isRealTimeActive = false;
      socket.emit("audioStatus", "Silence");
    }
  }

  // Audio buffer handler
  socket.on("audio", async (audioChunk: Buffer) => {
    try {
      const buffer = Buffer.from(audioChunk);
      const volume = calculateVolume(buffer);

      state.audioChunks.push(buffer);

      // Simple silence detection via chunk volume
      if (volume < state.silenceThreshold) {
        state.numSilenceChunks++;

        // Close Google stream on short silence
        if (state.numSilenceChunks > 6 && state.isRealTimeActive) {
          q(`[Silence] Short silence detected, closing Google Speech stream`);
          closeGoogleStream();
        }

        // Extended silence - trigger Whisper fallback
        if (
          state.numSilenceChunks > numSilenceChunksThreshold &&
          !state.transcriptionInProgress &&
          !state.wasLastWAVFileClosedBySilence
        ) {
          q(
            `[Silence] Extended silence detected. Triggering Whisper fallback.`
          );

          state.transcriptionInProgress = true;

          // Only transcribe chunks that haven't been processed yet
          const chunksToTranscribe = state.audioChunks.slice(
            state.lastWhisperedChunkIndex
          );

          if (chunksToTranscribe.length > numMinChunksForWAVFile) {
            try {
              await processWithWhisper("silence", chunksToTranscribe);
              q(`[Silence] Whisper transcription complete.`);

              // Update the last processed index
              state.lastWhisperedChunkIndex = state.audioChunks.length;
            } catch (e) {
              q(`[Silence] Whisper failed to transcribe:`, e);
            }
          } else {
            q(
              `[Silence] Skipped Whisper — too few chunks (${chunksToTranscribe.length}).`
            );
          }

          state.wasLastWAVFileClosedBySilence = true;
          state.transcriptionInProgress = false;

          // Optional: clear processed chunks
          state.audioChunks = [];
          state.lastWhisperedChunkIndex = 0;
        }

        return;
      }

      // Active speech detected
      state.numSilenceChunks = 0;
      state.wasLastWAVFileClosedBySilence = false;

      if (!state.isRealTimeActive) {
        q(`[Audio] Active speech detected, starting Google Speech stream.`);
        startGoogleStream();
      }

      // Send audio data to Google Speech
      if (state.googleSpeechStream && state.isRealTimeActive) {
        state.googleSpeechStream.write(buffer);
      } else {
        q(`[Audio] Google Speech stream not ready.`);
      }

      q(`[Audio] Chunk received. Total collected: ${state.audioChunks.length}`);
    } catch (err) {
      q(`[Audio] Error handling audio chunk:`, err);
    }
  });

  socket.on("start-stream", () => {
    q(`[Socket] Received 'start-stream' from ${socket.id}`);
    startGoogleStream();
  });

  socket.on("stop", async () => {
    q(`[Socket] Received 'stop' from ${socket.id}`);
    closeGoogleStream();

    // Only transcribe chunks that haven't been processed yet
    const chunksToTranscribe = state.audioChunks.slice(
      state.lastWhisperedChunkIndex
    );

    if (
      state.hasProcessedWhisperAfterPeriod ||
      chunksToTranscribe.length <= numMinChunksForWAVFile
    ) {
      q(
        state.hasProcessedWhisperAfterPeriod
          ? `[Stop] Skipping Whisper — already processed after period.`
          : `[Stop] Too few audio chunks (${chunksToTranscribe.length}) to process on stop.`
      );
      sendTranscriptToClient("", false, false, "whisper-keyword");
    } else {
      q(`[Stop] Processing final WAV with ${chunksToTranscribe.length} chunks`);
      try {
        await processWithWhisper("stop", chunksToTranscribe);
      } catch (e) {
        q(`[Stop] Whisper: Could not transcribe final WAV`, e);
        sendTranscriptToClient("", false, false, "whisper-silence");
      }
    }

    // Reset state for next session
    state.hasProcessedWhisperAfterPeriod = false;
    state.audioChunks = [];
    state.lastWhisperedChunkIndex = 0;
    state.j = 0;
    state.numSilenceChunks = 0;
    state.wasLastWAVFileClosedBySilence = false;
    state.transcriptionInProgress = false;
    state.currentSentence = "";
    state.partialTranscriptBuffer = [];
  });

  socket.on("resetTranscript", () => {
    q(`[Socket] Received 'resetTranscript' from ${socket.id}`);
    state.periodCounter = 0;
    state.currentSentence = "";
    state.lastTranscriptSent = "";
    state.continuousTranscript = "";
    socket.emit("transcriptReset", { success: true });
  });

  socket.on("disconnect", () => {
    q(`[Socket] Client disconnected: ${socket.id}`);
    closeGoogleStream();
    state.audioChunks = [];
    state.lastWhisperedChunkIndex = 0;
  });
});

httpServer.listen(9000, () => q(`[Server] Listening on port 9000`));
