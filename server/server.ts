import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import { WaveFile } from "wavefile";
import { randomString } from "./tools";

const bcCfg = require("./bc-backend.json");
const q = console.log;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "http://localhost:3000" },
});

const openai = new OpenAI({
  apiKey: bcCfg.openAIKey,
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

async function transcribeWhisper(wavFilename: string): Promise<string> {
  try {
    const fileStream = fs.createReadStream(wavFilename);
    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: fileStream,
      response_format: "text",
    });

    return response as unknown as string;
  } catch (e) {
    throw e;
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
    .join("\n");
};

io.on("connection", async (socket: Socket) => {
  let silenceThreshold = 50; // [JS] please adapt this to your microphone silence volume

  let audioChunks: Buffer[] = [];
  async function writeWavFile(
    audioChunks: Buffer[],
    outputFilePath: string
  ): Promise<void> {
    try {
      if (audioChunks.length === 0) {
        q(`Whisper: No audio chunks to write.`);
        return;
      }

      //@ts-ignore [JS] not sure how to handle this without ts-ignoring it
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

      // q('', `✅ WAV file written: ${outputFilePath}`);
    } catch (err) {
      q(`Whisper: ❌ Could not write WAV file: ${err}`);
    }
  }

  const sendTranscriptToClient = (
    transcript: string,
    isStop: boolean = false
  ) => {
    const normalizedTranscript = normalizeTranscript(transcript);
    socket.emit(
      isStop ? `stopTranscription` : `transcription`,
      normalizedTranscript
    );
  };

  let j = 0;
  const silenceThresholdFactor = 6.5;
  const numSilenceChunksThreshold = 5;
  const numMinChunksForWAVFile = 3;

  let numSilenceChunks = 0;
  let wasLastWAVFileClosedBySilence = false;
  let transcriptionInProgress = false;

  socket.on("audio", async (audioChunk: Buffer) => {
    try {
      const audioSessionId = randomString(16);
      //@ts-ignore
      const buffer = Buffer.from(audioChunk);
      const volume = calculateVolume(buffer);

      if (volume < silenceThreshold) {
        numSilenceChunks++;

        if (
          numSilenceChunks > numSilenceChunksThreshold &&
          !transcriptionInProgress &&
          !wasLastWAVFileClosedBySilence
        ) {
          q(`Detected silence, stopping transcription.`);
          transcriptionInProgress = true;

          if (audioChunks.length > numMinChunksForWAVFile) {
            const outputFolder = path.join(__dirname, "wavfiles");
            const pathWAVFile = path.join(
              outputFolder,
              `temp-${audioSessionId}-${j}.wav`
            );
            q(`Saving WAV with ${audioChunks.length} chunks to ${pathWAVFile}`);

            try {
              await writeWavFile(audioChunks, pathWAVFile);
              const transcript = await transcribeWhisper(pathWAVFile);
              sendTranscriptToClient(transcript);
            } catch (e) {
              q(`Whisper: Could not transcribe WAV file: ${e}`);
            }
          } else {
            q(`Too few chunks (${audioChunks.length}), skipping WAV.`);
          }

          wasLastWAVFileClosedBySilence = true;
          transcriptionInProgress = false;
          j++;
          audioChunks = [];
        }

        return;
      }

      numSilenceChunks = 0;
      wasLastWAVFileClosedBySilence = false;
      audioChunks.push(buffer);

      q(
        `Non-silent audio chunk added, total size: ${audioChunks.length} chunks`
      );
    } catch (err) {
      q(`Whisper: Could not handle audio chunk: ${err}`);
    }
  });

  socket.on("stop", async () => {
    q(`Received stop command`);

    if (audioChunks.length > numMinChunksForWAVFile) {
      const audioSessionId = randomString(16);
      const outputFolder = path.join(__dirname, "wavfiles");
      const pathWAVFile = path.join(
        outputFolder,
        `temp-${audioSessionId}-${j}.wav`
      );
      q(`Saving WAV with ${audioChunks.length} chunks to ${pathWAVFile}`);

      try {
        await writeWavFile(audioChunks, pathWAVFile);
        const transcript = await transcribeWhisper(pathWAVFile);
        sendTranscriptToClient(transcript, true);
      } catch (e) {
        q(`Whisper: Could not transcribe WAV file: ${e}`);
        sendTranscriptToClient("", true);
      }
    } else {
      q(
        `Too few chunks (${audioChunks.length}) left for stop-transcription, skipping WAV.`
      );
    }

    audioChunks = [];
  });

  socket.on("disconnect", () => {
    q(`client disconnected, stream closed.`);
  });
});

httpServer.listen(9000, () => {
  q(`streaming server started at http://localhost:9000`);
});
