"use client";

import { useEffect, useRef, useState } from "react";

// Minimal shape of the Web Speech API - not in lib.dom.d.ts by default.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Wraps the browser's Web Speech API. `supported` is false in browsers
 * without it (notably Firefox) - callers should disable the mic button. */
export function useSpeechRecognition(onTranscript: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    // Intentional: feature detection needs `window`, which doesn't exist
    // during server rendering - this has to run client-side post-mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const toggle = () => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i];
        if (result.isFinal) onTranscript(result[0].transcript);
      }
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  };

  return { supported, recording, toggle };
}
