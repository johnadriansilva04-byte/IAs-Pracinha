import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechSynthesisReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);
      synthRef.current = window.speechSynthesis;

      // Carregar vozes disponíveis
      const loadVoices = () => {
        const availableVoices = synthRef.current?.getVoices() || [];
        setVoices(availableVoices);
      };

      loadVoices();
      
      // Algumas browsers carregam vozes de forma assíncrona
      if (synthRef.current.onvoiceschanged !== undefined) {
        synthRef.current.onvoiceschanged = loadVoices;
      }
    }

    return () => {
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!synthRef.current || !text) return;

    // Cancelar qualquer fala anterior
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Tentar usar uma voz feminina em português
    const portugueseVoice = voices.find(voice => 
      (voice.lang.includes('pt-BR') || voice.lang.includes('pt')) && 
      (voice.name.includes('Female') || voice.name.includes('Google Português') || voice.name.includes('Maria'))
    );
    
    // Se não encontrar voz feminina específica, usa qualquer voz em português
    const fallbackVoice = portugueseVoice || voices.find(voice => 
      voice.lang.includes('pt-BR') || voice.lang.includes('pt')
    );
    
    if (fallbackVoice) {
      utterance.voice = fallbackVoice;
    }

    utterance.lang = 'pt-BR';
    utterance.rate = 1.2; // Mais rápida (20% mais rápido)
    utterance.pitch = 1.1; // Tom levemente mais agudo (voz feminina)

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    synthRef.current.speak(utterance);
  }, [voices]);

  const stop = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    voices
  };
}