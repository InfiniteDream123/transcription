import React, { useState, useRef, useEffect } from 'react';
import './App.css';

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (_event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (_event: ErrorEvent) => void;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(_index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

// Type guard for checking if SpeechRecognition is available
function hasSpeechRecognition(window: Window): window is Window & { SpeechRecognition: new () => SpeechRecognition } {
  return 'SpeechRecognition' in window;
}

// Type guard for checking if webkitSpeechRecognition is available
function hasWebkitSpeechRecognition(window: Window): window is Window & { webkitSpeechRecognition: new () => SpeechRecognition } {
  return 'webkitSpeechRecognition' in window;
}

const App: React.FC = () => {
  const [inputMode, setInputMode] = useState<'mic' | 'speaker'>('mic');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [micTranscript, setMicTranscript] = useState('');
  const [speakerTranscript, setSpeakerTranscript] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const transcriptRef = useRef<HTMLDivElement>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognition = hasSpeechRecognition(window) ? window.SpeechRecognition :
                             hasWebkitSpeechRecognition(window) ? window.webkitSpeechRecognition :
                             null;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition() as SpeechRecognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = selectedLanguage;

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interimTranscript = '';
        let finalTranscript = finalTranscriptRef.current;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            finalTranscriptRef.current = finalTranscript;
          } else {
            interimTranscript += transcript;
          }
        }

        if (inputMode === 'mic') {
          const newTranscript = finalTranscript + interimTranscript;
          setMicTranscript(newTranscript);
          if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
          }
        }
      };

      recognition.onend = () => {
        if (isRecording && !isPaused && inputMode === 'mic') {
          console.log('Speech recognition ended, restarting...');
          recognition.start();
        }
      };

      recognition.onerror = (event: ErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        if (isRecording) {
          alert(`Speech recognition error: ${event.error}`);
          setIsRecording(false);
          setIsPaused(false);
        }
      };

      recognitionRef.current = recognition;
    } else {
      console.error('Speech recognition is not supported in this browser.');
      alert('Speech recognition is not supported in your browser.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopSpeakerCapture();
    };
  }, [selectedLanguage, inputMode, isRecording, isPaused]);

  useEffect(() => {
    finalTranscriptRef.current = '';
    if (inputMode === 'mic') {
      setMicTranscript('');
    } else {
      setSpeakerTranscript('');
    }
  }, [inputMode]);

  const startRecording = async () => {
    console.log('Starting recording, inputMode:', inputMode);
    if (inputMode === 'mic') {
      finalTranscriptRef.current = '';
      setMicTranscript('');
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
          recognitionRef.current.start();
          setIsRecording(true);
          setIsPaused(false);
          console.log('Microphone recording started');
        } catch (err) {
          console.error('Failed to start speech recognition:', err);
          setIsRecording(false);
          alert('Failed to start microphone. Please check permissions or browser support.');
        }
      } else {
        alert('Speech recognition is not available.');
      }
    } else {
      setSpeakerTranscript('');
      startSpeakerCapture();
      setIsRecording(true);
      setIsPaused(false);
    }
  };

  const startSpeakerCapture = async () => {
    console.log('Starting speaker capture');
    
    try {
      // 1. Check for browser support
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Screen capture not supported in this browser');
      }
  
      // 2. Create audio context
      const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error('Web Audio API not supported');
      }
      
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;
  
      // 3. Request screen capture (must include video)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true, // Required by most browsers
      });
  
      // 4. Handle case where user didn't share audio
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Please share audio when selecting a window/tab');
      }
  
      mediaStreamRef.current = stream;

      // 5. Set up speech recognition for speaker audio
      const SpeechRecognition = hasSpeechRecognition(window) ? window.SpeechRecognition :
                               hasWebkitSpeechRecognition(window) ? window.webkitSpeechRecognition :
                               null;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition() as SpeechRecognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = selectedLanguage;

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let interimTranscript = '';
          let finalTranscript = finalTranscriptRef.current;

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
              finalTranscriptRef.current = finalTranscript;
            } else {
              interimTranscript += transcript;
            }
          }

          const newTranscript = finalTranscript + interimTranscript;
          setSpeakerTranscript(newTranscript);
          if (transcriptRef.current) {
            transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
          }
        };

        recognition.onend = () => {
          if (isRecording && !isPaused) {
            console.log('Speech recognition ended, restarting...');
            recognition.start();
          }
        };

        recognition.onerror = (event: ErrorEvent) => {
          console.error('Speech recognition error:', event.error);
          if (isRecording) {
            alert(`Speech recognition error: ${event.error}`);
            setIsRecording(false);
            setIsPaused(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
      } else {
        throw new Error('Speech recognition is not supported in this browser');
      }
  
      // 6. Handle when user stops sharing
      stream.getAudioTracks()[0].onended = () => {
        if (!isPaused) {
          console.log('Speaker audio track ended');
          setIsRecording(false);
        }
      };
  
    } catch (err) {
      console.error('Error capturing speaker audio:', err);
      setIsRecording(false);
    }
  };

  const stopSpeakerCapture = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const pauseRecording = () => {
    console.log('Pausing recording, inputMode:', inputMode);
    if (inputMode === 'mic') {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsPaused(true);
      }
    } else {
      stopSpeakerCapture();
      setIsPaused(true);
    }
  };

  const resumeRecording = () => {
    console.log('Resuming recording, inputMode:', inputMode);
    if (inputMode === 'mic') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsPaused(false);
        } catch (err) {
          console.error('Failed to resume speech recognition:', err);
          alert('Failed to resume microphone. Please check permissions or try again.');
        }
      }
    } else {
      startSpeakerCapture();
      setIsPaused(false);
    }
  };

  const stopRecording = () => {
    console.log('Stopping recording, inputMode:', inputMode);
    if (inputMode === 'mic') {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current.stop();
      }
    } else {
      stopSpeakerCapture();
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const clearTranscript = () => {
    finalTranscriptRef.current = '';
    if (inputMode === 'mic') {
      setMicTranscript('');
    } else {
      setSpeakerTranscript('');
    }
  };

  return (
    <div className="app-container">
      <div className="converter-container">
        <div className="title-container">
          <h1 className="title">Saeed Transcription</h1>
        </div>

        <h2 className="converter-title">Speech to Text Converter</h2>
        <p className="instructions">Select an input source and start listening. Your audio will be converted to text in real-time.</p>

        <div className="language-selector">
          <label htmlFor="language-select" className="language-label">Language:</label>
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="language-dropdown"
          >
            <option value="en-US">English (US)</option>
            <option value="ur">Urdu (اردو)</option>
            <option value="hi-IN">Hindi (हिन्दी)</option>
            <option value="ar-SA">Arabic (العربية)</option>
            <option value="zh-CN">Chinese (中文)</option>
            <option value="es-ES">Spanish (Español)</option>
            <option value="fr-FR">French (Français)</option>
            <option value="de-DE">German (Deutsch)</option>
            <option value="ru-RU">Russian (Русский)</option>
          </select>
        </div>

        <div className="input-mode-selector">
          <button
            className={`mode-btn ${inputMode === 'mic' ? 'active' : ''}`}
            onClick={() => {
              if (isRecording) {
                stopRecording();
              }
              setInputMode('mic');
            }}
          >
            <i className="fas fa-microphone"></i> Microphone
          </button>
          <button
            className={`mode-btn ${inputMode === 'speaker' ? 'active' : ''}`}
            onClick={() => {
              if (isRecording) {
                stopRecording();
              }
              setInputMode('speaker');
            }}
          >
            <i className="fas fa-volume-up"></i> Speaker
          </button>
        </div>

        {!isRecording ? (
          <button id="start-btn" className="start-btn" onClick={startRecording}>
            {inputMode === 'mic' ? (
              <><i className="fas fa-microphone"></i> Start Microphone</>
            ) : (
              <><i className="fas fa-volume-up"></i> Start Speaker Capture</>
            )}
          </button>
        ) : (
          <div id="controls" className="controls">
            {!isPaused ? (
              <button id="pause-btn" className="control-btn pause" onClick={pauseRecording}>
                <i className="fas fa-pause"></i> Pause
              </button>
            ) : (
              <button id="resume-btn" className="control-btn resume" onClick={resumeRecording}>
                <i className="fas fa-play"></i> Resume
              </button>
            )}
            <button id="stop-btn" className="control-btn stop" onClick={stopRecording}>
              <i className="fas fa-stop"></i> Stop
            </button>
          </div>
        )}

        <div className="transcript-container">
          {inputMode === 'mic' ? (
            <div className="transcript-section">
              <div className="transcript-header">
                <h3 className="transcript-title">Microphone Input</h3>
                <button
                  className="clear-btn"
                  onClick={clearTranscript}
                  title="Clear transcript"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              <div
                ref={transcriptRef}
                className="result-text"
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => {
                  const newText = e.currentTarget.textContent || '';
                  setMicTranscript(newText);
                  finalTranscriptRef.current = newText;
                }}
              >
                {micTranscript || 'Start speaking to see the transcription here...'}
              </div>
            </div>
          ) : (
            <div className="transcript-section">
              <div className="transcript-header">
                <h3 className="transcript-title">Speaker Input</h3>
                <button
                  className="clear-btn"
                  onClick={clearTranscript}
                  title="Clear transcript"
                >
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              <div
                ref={transcriptRef}
                className="result-text"
                contentEditable
                suppressContentEditableWarning
                onInput={(e) => setSpeakerTranscript(e.currentTarget.textContent || '')}
              >
                {speakerTranscript || 'Start capturing speaker audio to see the transcription here...'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;