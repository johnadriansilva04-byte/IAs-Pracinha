// Serviço para gerenciar conexão WebSocket com Gemini Live API
// Implementa Audio-to-Audio nativo com latência mínima

interface GeminiLiveConfig {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
}

interface AudioChunk {
  data: Uint8Array;
  mimeType: string;
}

export class GeminiLiveService {
  private ws: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioSource: MediaStreamAudioSourceNode | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private isRecording = false;
  private isPlaying = false;

  constructor(config: GeminiLiveConfig) {
    this.config = {
      model: 'gemini-2.5-flash', // Usando modelo padrão que funciona
      ...config
    };
  }

  async connect(): Promise<void> {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.config.apiKey}`;
    
    console.log('[GEMINI-LIVE] Conectando à API:', wsUrl.substring(0, 50) + '...');
    
    this.ws = new WebSocket(wsUrl);
    
    return new Promise((resolve, reject) => {
      if (!this.ws) return reject(new Error('WebSocket não inicializado'));

      this.ws.onopen = () => {
        console.log('[GEMINI-LIVE] WebSocket conectado');
        this.sendSetup();
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[GEMINI-LIVE] Erro WebSocket:', error);
        reject(new Error('Erro ao conectar à API Gemini Live. Verifique sua API key.'));
      };

      this.ws.onclose = () => {
        console.log('[GEMINI-LIVE] WebSocket fechado');
        this.cleanup();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    });
  }

  private sendSetup(): void {
    if (!this.ws) return;

    const setupMessage = {
      setup: {
        model: `models/${this.config.model}`,
        responseModalities: ['AUDIO'],
        systemInstruction: {
          parts: [{
            text: this.config.systemPrompt || 'You are a helpful assistant.'
          }]
        }
      }
    };

    console.log('[GEMINI-LIVE] Enviando configuração inicial');
    this.ws.send(JSON.stringify(setupMessage));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message.serverContent) {
        this.handleServerContent(message.serverContent);
      }
    } catch (error) {
      console.error('[GEMINI-LIVE] Erro ao processar mensagem:', error);
    }
  }

  private handleServerContent(content: any): void {
    if (content.realtimeOutput && content.realtimeOutput.mediaChunks) {
      // Processar áudio de saída
      content.realtimeOutput.mediaChunks.forEach((chunk: any) => {
        if (chunk.mimeType === 'audio/raw') {
          this.playAudio(chunk.data);
        }
      });
    }
  }

  async startRecording(): Promise<void> {
    if (this.isRecording) return;

    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.audioSource = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      this.audioProcessor.onaudioprocess = (event) => {
        const audioData = event.inputBuffer.getChannelData(0);
        this.sendAudioChunk(audioData);
      };

      this.audioSource.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioContext.destination);
      
      this.isRecording = true;
      console.log('[GEMINI-LIVE] Gravação iniciada');
    } catch (error) {
      console.error('[GEMINI-LIVE] Erro ao iniciar gravação:', error);
      throw error;
    }
  }

  stopRecording(): void {
    if (!this.isRecording) return;

    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }

    if (this.audioSource) {
      this.audioSource.disconnect();
      this.audioSource = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    this.isRecording = false;
    console.log('[GEMINI-LIVE] Gravação parada');
  }

  private sendAudioChunk(audioData: Float32Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // Converter Float32Array para Int16 PCM (16-bit, little-endian)
    const pcmData = new Int16Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      pcmData[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
    }

    // Converter para base64
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));

    const message = {
      realtimeInput: {
        mediaChunks: [{
          mimeType: 'audio/raw',
          data: base64Data
        }]
      }
    };

    this.ws.send(JSON.stringify(message));
  }

  private async playAudio(base64Data: string): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    try {
      const audioData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
      const audioBuffer = await this.audioContext.decodeAudioData(audioData.buffer);
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
      
      this.isPlaying = true;
      source.onended = () => {
        this.isPlaying = false;
      };
    } catch (error) {
      console.error('[GEMINI-LIVE] Erro ao reproduzir áudio:', error);
    }
  }

  disconnect(): void {
    this.stopRecording();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isRecordingActive(): boolean {
    return this.isRecording;
  }

  get isPlayingAudio(): boolean {
    return this.isPlaying;
  }
}