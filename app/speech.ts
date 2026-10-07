let voiceName = "";
let voiceStyle = "natural";
let finishActive: ((finished: boolean) => void) | undefined;

export function selectSpeechVoice(name: string, style = "natural") { voiceName = name; voiceStyle = style; }

export function cancelSpeech() {
  finishActive?.(false);
  finishActive = undefined;
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

// Completion controls autoplay. Safari's cancel() does not always emit an
// event, so cancellation settles the promise explicitly.
export function speakText(text: string, rate = 1, language = "en-US"): Promise<boolean> {
  cancelSpeech();
  if (typeof window === "undefined" || !window.speechSynthesis || !text.trim()) return Promise.resolve(false);
  return new Promise(resolve => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = rate;
    utterance.pitch = voiceStyle === "male" ? 0.84 : voiceStyle === "female" ? 1.10 : 1;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = (language.startsWith("en") ? voices.find(voice => voice.name === voiceName) : undefined) ?? voices.find(voice => voice.lang === language && voice.localService) ?? voices.find(voice => voice.lang === language) ?? null;
    const finish = (completed: boolean) => {
      if (finishActive === finish) finishActive = undefined;
      resolve(completed);
    };
    finishActive = finish;
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    try { window.speechSynthesis.speak(utterance); } catch { finish(false); }
  });
}
