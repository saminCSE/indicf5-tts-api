export interface TtsBackend {
  synthesize(text: string): Promise<Buffer>;
}

export const TTS_BACKEND = Symbol('TTS_BACKEND');
