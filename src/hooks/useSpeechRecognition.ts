import { useState, useEffect, useCallback } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  startListening: () => void;
  stopListening: () => void;
  isSupported: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        setIsSupported(true);
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'pt-BR';

        recognitionInstance.onresult = (event: any) => {
          let finalTranscript = '';
          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          setTranscript(finalTranscript || interimTranscript);
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Erro no reconhecimento de voz:', event.error);
          setIsListening(false);
        };

        recognitionInstance.onend = () => {
          setIsListening(false);
        };

        setRecognition(recognitionInstance);
      }
    }

    return () => {
      if (recognition) {
        recognition.abort();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    console.log('[SPEECH-RECOGNITION] Tentando iniciar reconhecimento');
    console.log('[SPEECH-RECOGNITION] recognition existe:', !!recognition);
    console.log('[SPEECH-RECOGNITION] isListening:', isListening);
    
    if (recognition && !isListening) {
      try {
        recognition.start();
        setIsListening(true);
        console.log('[SPEECH-RECOGNITION] Reconhecimento iniciado com sucesso');
      } catch (error) {
        console.error('[SPEECH-RECOGNITION] Erro ao iniciar:', error);
        // Se já estiver iniciado, apenas seta o estado
        setIsListening(true);
      }
    } else {
      console.warn('[SPEECH-RECOGNITION] Não foi possível iniciar:', {
        hasRecognition: !!recognition,
        isListening
      });
    }
  }, [recognition, isListening]);

  const stopListening = useCallback(() => {
    console.log('[SPEECH-RECOGNITION] Parando reconhecimento');
    if (recognition && isListening) {
      recognition.stop();
      setIsListening(false);
      console.log('[SPEECH-RECOGNITION] Reconhecimento parado');
    }
  }, [recognition, isListening]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported
  };
}