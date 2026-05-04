import { useCallback, useEffect, useRef, useState } from "react";

type UseAudioRecorderOptions = {
  onRecorded: (file: File) => void;
};

// Ordered by quality/compatibility preference
const CANDIDATE_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
];

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return CANDIDATE_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function mimeToExt(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4")) return "m4a";
  return "webm";
}

export function useAudioRecorder({ onRecorded }: UseAudioRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    releaseStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setSeconds(0);
  }, [clearTimer, releaseStream]);

  const startRecording = useCallback(async () => {
    if (isRecording) return;
    setMicError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });
        const ext = mimeToExt(mimeType);
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: mimeType || "audio/webm",
        });
        onRecorded(file);
        reset();
      };

      recorder.start();
      setIsRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(
        () => setSeconds((s) => s + 1),
        1000,
      );
    } catch (err) {
      reset();
      setMicError(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission denied"
          : "Could not access microphone",
      );
    }
  }, [isRecording, onRecorded, reset]);

  const stopRecording = useCallback(() => {
    clearTimer();
    recorderRef.current?.stop();
    // reset() is called inside recorder.onstop
  }, [clearTimer]);

  const cancelRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.onstop = null; // prevent onRecorded from firing
      recorderRef.current.stop();
    }
    reset();
  }, [reset]);

  // Cleanup on unmount
  useEffect(() => () => { reset(); }, [reset]);

  return {
    isRecording,
    seconds,
    micError,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
