import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { usePatient } from '../context/PatientContext.jsx';
import { useClinicalData } from '../../dashboard/context/ClinicalContext.jsx';
import {
  sendVoiceAssistantChat,
  fetchSupportedLanguages,
  SUPPORTED_LANGUAGES_MAP,
  fetchEPDSQuestionnaire,
  submitEPDSQuestionnaire,
  matchOptionIndex,
  isClarificationOrRepeatRequest,
  checkVoiceAvailability,
  LOCALIZED_Q10_CRISIS_MESSAGES,
  LOCALIZED_EPDS_VALIDATION_PROMPTS,
  TRANSLATION_PROVENANCE_INFO,
} from '../services/voiceAssistantService.js';
import { fetchPatientAiConversations, savePatientAiConversations } from '../services/patientApiService.js';
import '../styles/ai-assistant.css';

// SVG Icons matching Miora's clean refined stroke style
const Icons = {
  home: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
      <path d="M9.5 21v-7h5v7" />
    </svg>
  ),
  info: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  dots: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  ),
  paperclip: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l7.88-7.88" />
    </svg>
  ),
  mic: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  ),
  send: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none" />
    </svg>
  ),
  sparkles: (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#d93c75', fontSize: '13px', lineHeight: 1 }}>
      ✦✦
    </span>
  ),
  leaf: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  ),
  lotus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3c-1.5 3-4 6-8 7 3 2 5.5 5 8 9 2.5-4 5-7 8-9-4-1-6.5-4-8-7z" />
      <path d="M12 12c-2.5 2-4 4.5-5 7 2.5 1 5 1.5 5 1.5s2.5-.5 5-1.5c-1-2.5-2.5-5-5-7z" />
    </svg>
  ),
  calendarCheck: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  ),
  barChart: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  book: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  playCircle: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" fill="none" stroke="currentColor" />
    </svg>
  ),
  stethoscope: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 3v5a4.5 4.5 0 0 0 9 0V3" />
      <path d="M9 12.5v4a3.5 3.5 0 0 0 7 0v-2.5" />
      <circle cx="16" cy="14" r="2.5" />
      <path d="M3 3h3M12 3h3" />
    </svg>
  ),
  chatDots: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" />
      <circle cx="12" cy="11.5" r="1" fill="currentColor" />
      <circle cx="16" cy="11.5" r="1" fill="currentColor" />
    </svg>
  ),
  sparkleStar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
    </svg>
  ),
  sparkleCluster: (
    <svg width="26" height="26" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
      <path d="M12 4L14.1 10.9L21 13L14.1 15.1L12 22L9.9 15.1L3 13L9.9 10.9L12 4Z" />
      <path d="M23.5 16L24.7 19.8L28.5 21L24.7 22.2L23.5 26L22.3 22.2L18.5 21L22.3 19.8L23.5 16Z" opacity="0.82" />
      <path d="M22.5 5.5L23.2 7.8L25.5 8.5L23.2 9.2L22.5 11.5L21.8 9.2L19.5 8.5L21.8 7.8L22.5 5.5Z" opacity="0.65" />
    </svg>
  ),
  brain: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  ),
  adaptive: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  ),
  shieldCheck: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  volumeOn: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  volumeOff: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ),
  history: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  ),
};

// Initial conversation messages
const INITIAL_MESSAGES = [
  {
    id: 'msg-1',
    sender: 'bot',
    text: `Hi Amara! 💕\nI'm Miora, your AI companion. I'm here to listen, answer your questions, and support you through your postpartum journey.\n\nHow are you feeling today?`,
    timestamp: '10:24 AM',
  },
  {
    id: 'msg-2',
    sender: 'user',
    text: `I've been feeling a bit anxious and overwhelmed lately.`,
    timestamp: '10:26 AM',
    status: 'delivered',
  },
  {
    id: 'msg-3',
    sender: 'bot',
    text: `I'm really sorry you're feeling this way. It's completely understandable, especially after childbirth. 💖\n\nWould you like me to share some simple coping strategies, a calming exercise, or help you decide if it's a good time to talk to a professional?`,
    timestamp: '10:26 AM',
  },
];

export function AiAssistantScreen() {
  const { patient, setScreening, reloadPatientData } = usePatient();
  const clinical = useClinicalData();
  const navigate = useNavigate();

  // Chat conversation state
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeMood, setActiveMood] = useState('okay');

  // Multilingual assistant state
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [supportedLanguages, setSupportedLanguages] = useState(SUPPORTED_LANGUAGES_MAP);
  const [voiceNotice, setVoiceNotice] = useState(null);

  // Sequential EPDS Questionnaire State (Phase 4)
  const [screeningActive, setScreeningActive] = useState(false);
  const [screeningQuestions, setScreeningQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [screeningAnswers, setScreeningAnswers] = useState([]);
  const [isSubmittingScreening, setIsSubmittingScreening] = useState(false);
  const [screeningResult, setScreeningResult] = useState(null);
  const [q10CrisisAlert, setQ10CrisisAlert] = useState(false);
  const [screeningError, setScreeningError] = useState(null);

  // Load saved AI assistant conversations from PostgreSQL
  useEffect(() => {
    let mounted = true;
    fetchPatientAiConversations()
      .then((data) => {
        if (mounted && Array.isArray(data?.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        }
        if (mounted && data?.current_mood) {
          setActiveMood(data.current_mood);
        }
      })
      .catch(() => { });
    return () => {
      mounted = false;
    };
  }, []);

  // Load supported languages metadata from backend
  useEffect(() => {
    let mounted = true;
    fetchSupportedLanguages().then((data) => {
      if (mounted && data?.languages) {
        setSupportedLanguages(data.languages);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Transparently check browser voice synthesis availability when language changes
  useEffect(() => {
    if (selectedLanguage !== 'auto' && selectedLanguage !== 'en') {
      const locale = supportedLanguages[selectedLanguage]?.locale || 'en-IN';
      const check = checkVoiceAvailability(locale);
      if (check.supported && !check.available) {
        const langName = supportedLanguages[selectedLanguage]?.name || selectedLanguage;
        setVoiceNotice(`Browser speech voice for ${langName} is not installed on this system. Responses will be displayed in text.`);
      } else {
        setVoiceNotice(null);
      }
    } else {
      setVoiceNotice(null);
    }
  }, [selectedLanguage, supportedLanguages]);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const voiceWatchdogRef = useRef(null);
  const voiceTranscriptRef = useRef('');
  const voiceCancelledRef = useRef(false);
  const isSendingChatRef = useRef(false);
  const handleSendMessageRef = useRef(null);

  // Voice Interaction States (Browser-Native SpeechRecognition and SpeechSynthesis)
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Active holographic exchange state (shows the latest question & robot's live answer)
  const [activeUserPrompt, setActiveUserPrompt] = useState(null);
  const [activeBotReply, setActiveBotReply] = useState(null);
  const [activeCrisisMsg, setActiveCrisisMsg] = useState(null);
  const [revealedWordCount, setRevealedWordCount] = useState(null);

  // Smooth word-by-word reveal so the holographic robot appears to speak out her answer
  useEffect(() => {
    if (!activeBotReply?.text) {
      setRevealedWordCount(null);
      return;
    }
    const isInstant =
      (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') ||
      activeBotReply.isEmergency ||
      activeBotReply.source?.startsWith('epds');
    const words = activeBotReply.text.split(/(\s+)/);
    if (isInstant || words.length <= 4) {
      setRevealedWordCount(words.length);
      return;
    }
    setRevealedWordCount(4);
    const stepMs = Math.max(18, Math.min(42, Math.floor(1400 / Math.max(words.length / 2, 1))));
    const timer = setInterval(() => {
      setRevealedWordCount((prev) => {
        const next = (prev || 0) + 2;
        if (next >= words.length) {
          clearInterval(timer);
          return words.length;
        }
        return next;
      });
    }, stepMs);
    return () => clearInterval(timer);
  }, [activeBotReply?.id, activeBotReply?.text, activeBotReply?.isEmergency, activeBotReply?.source]);

  // Cleanup voice operations on unmount or navigation
  useEffect(() => {
    return () => {
      if (voiceWatchdogRef.current) {
        clearTimeout(voiceWatchdogRef.current);
        voiceWatchdogRef.current = null;
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch { }
      }
    };
  }, []);

  // Voice output: Speak assistant response aloud
  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingMsgId(null);
  };

  const speakText = (text, msgId, voiceLocale, { silentOnMissing = false } = {}) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      if (!silentOnMissing) {
        setSpeechError('Speech synthesis is not supported in this browser.');
      }
      return;
    }

    if (isSpeaking && speakingMsgId === msgId) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    const cleanText = text
      .replace(/[*_~`#]/g, '')
      .replace(/[✨🌸♥✦•💕💖🚨📋]/g, '')
      .replace(/\n+/g, ' ');

    try {
      const targetLocale =
        voiceLocale ||
        (selectedLanguage !== 'auto' && supportedLanguages[selectedLanguage]?.locale) ||
        'en-IN';

      // Check voice availability before attempting speech
      const check = checkVoiceAvailability(targetLocale);
      if (check.supported && !check.available) {
        if (!silentOnMissing) {
          const langName =
            (selectedLanguage !== 'auto' && supportedLanguages[selectedLanguage]?.name) || targetLocale;
          setSpeechError(
            `Browser speech voice for ${langName} is not installed on this system. Responses are displayed in text.`
          );
        }
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.94;
      utterance.pitch = 1.04;
      utterance.lang = targetLocale;
      if (check.voice) {
        utterance.voice = check.voice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingMsgId(msgId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setSpeakingMsgId(null);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
      setIsSpeaking(false);
      setSpeakingMsgId(null);
    }
  };

  // Voice input: SpeechRecognition (auto-sends spoken question to the robot when finished)
  const handleToggleVoice = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      if (voiceWatchdogRef.current) {
        clearTimeout(voiceWatchdogRef.current);
        voiceWatchdogRef.current = null;
      }
      try {
        recognitionRef.current?.stop();
      } catch { }
      setIsListening(false);
      return;
    }

    try {
      stopSpeaking();
      setSpeechError(null);
      voiceTranscriptRef.current = '';
      voiceCancelledRef.current = false;
      if (voiceWatchdogRef.current) {
        clearTimeout(voiceWatchdogRef.current);
        voiceWatchdogRef.current = null;
      }
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      const targetLocale =
        selectedLanguage !== 'auto'
          ? (supportedLanguages[selectedLanguage]?.locale || 'en-IN')
          : 'en-IN';
      recognition.lang = targetLocale;

      recognition.onstart = () => {
        setIsListening(true);
        // 15-second safety watchdog timer to prevent stuck listening state
        voiceWatchdogRef.current = setTimeout(() => {
          voiceCancelledRef.current = true;
          if (recognitionRef.current) {
            try {
              recognitionRef.current.abort();
            } catch { }
            recognitionRef.current = null;
          }
          setIsListening(false);
          setSpeechError('Listening timed out. Please click the microphone to try again.');
        }, 15000);
      };

      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((r) => r[0].transcript)
          .join('');
        voiceTranscriptRef.current = transcript;
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        voiceCancelledRef.current = true;
        if (voiceWatchdogRef.current) {
          clearTimeout(voiceWatchdogRef.current);
          voiceWatchdogRef.current = null;
        }
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access in browser settings.');
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          setSpeechError('Could not recognize voice. Please try speaking again.');
        }
      };

      recognition.onend = () => {
        if (voiceWatchdogRef.current) {
          clearTimeout(voiceWatchdogRef.current);
          voiceWatchdogRef.current = null;
        }
        setIsListening(false);
        const spoken = voiceTranscriptRef.current.trim();
        voiceTranscriptRef.current = '';
        if (spoken && !voiceCancelledRef.current && handleSendMessageRef.current) {
          handleSendMessageRef.current(spoken);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      if (voiceWatchdogRef.current) {
        clearTimeout(voiceWatchdogRef.current);
        voiceWatchdogRef.current = null;
      }
      setIsListening(false);
      setSpeechError('Unable to start speech recognition.');
    }
  };

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (showHistoryDrawer && (messages.length > INITIAL_MESSAGES.length || isTyping)) {
      scrollToBottom();
    }
  }, [messages, isTyping, showHistoryDrawer]);

  // Display reply directly from the holographic robot & speak aloud when Auto-Speak is on
  const presentBotReply = (botMsg, { shouldSpeak = true } = {}) => {
    setActiveBotReply(botMsg);
    if (shouldSpeak && autoSpeak && botMsg?.text) {
      speakText(botMsg.text, botMsg.id, botMsg.voiceLocale, { silentOnMissing: true });
    }
  };

  // ============================================================================
  // Sequential EPDS Question-and-Answer Flow (Phase 4)
  // Single Source of Truth: Canonical instrument retrieved via GET /api/questionnaire/epds
  // ============================================================================

  /**
   * Start sequential EPDS screening.
   * Introduces screening (7-day reference period) and retrieves canonical questions.
   */
  const startEPDSScreening = async () => {
    stopSpeaking();
    setScreeningError(null);
    setScreeningResult(null);
    setQ10CrisisAlert(false);
    setActiveCrisisMsg(null);
    setScreeningAnswers([]);
    setCurrentQuestionIdx(0);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Step 1: Assistant introduces the screening and explains feelings over the past 7 days
    const introMsg = {
      id: `msg-epds-intro-${Date.now()}`,
      sender: 'bot',
      text:
        "Welcome to the Edinburgh Postnatal Depression Scale (EPDS) screening. 💕\n\n" +
        "As you are pregnant or have recently had a baby, we would like to know how you are feeling. " +
        "Please select the answer that comes closest to how you have felt in the past 7 days, not just how you feel today.\n\n" +
        "There are exactly 10 questions. We will go through them one by one. You can click your answer or reply using your voice or keyboard.",
      timestamp: now,
      source: 'epds_intro',
    };

    setMessages((prev) => [...prev, introMsg]);
    setIsTyping(true);

    try {
      // Step 2: Retrieve the canonical EPDS questions from the backend
      const data = await fetchEPDSQuestionnaire();
      const questions = data?.questions || [];
      if (!Array.isArray(questions) || questions.length !== 10) {
        throw new Error('Unable to retrieve all 10 canonical EPDS questions from backend.');
      }

      setScreeningQuestions(questions);
      setScreeningActive(true);
      setCurrentQuestionIdx(0);

      // Present Question 1
      const q1 = questions[0];
      const q1Msg = {
        id: `msg-epds-q1-${Date.now() + 1}`,
        sender: 'bot',
        text:
          `Question 1 of 10:\n"${q1.question}"\n\n` +
          q1.response_options.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'epds_question',
        question: q1,
      };

      setMessages((prev) => [...prev, q1Msg]);
      presentBotReply(q1Msg);
    } catch (err) {
      console.error('Failed to start EPDS questionnaire:', err);
      const errMsg = {
        id: `msg-epds-err-${Date.now() + 1}`,
        sender: 'bot',
        text: 'I am unable to load the canonical screening questions right now. Please ensure the backend is running and try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: true,
      };
      setMessages((prev) => [...prev, errMsg]);
      presentBotReply(errMsg);
      setScreeningActive(false);
    } finally {
      setIsTyping(false);
    }
  };

  /**
   * Handle mother answering current EPDS question.
   * Validates option, records answer, checks Q10 safety escalation, and advances strictly by 1.
   */
  const handleAnswerQuestion = async (selectedIndex) => {
    if (!screeningActive || isSubmittingScreening || currentQuestionIdx >= screeningQuestions.length) return;

    stopSpeaking();
    const currentQ = screeningQuestions[currentQuestionIdx];
    const selectedOption = currentQ.response_options?.[selectedIndex];
    if (!selectedOption) return;

    const answerItem = {
      question_id: currentQ.id,
      selected_index: selectedIndex,
      label: selectedOption.label,
      score: selectedOption.score,
    };

    const newAnswers = [...screeningAnswers, answerItem];
    setScreeningAnswers(newAnswers);

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Add user's selection to chat
    const userMsg = {
      id: `msg-user-ans-${Date.now()}`,
      sender: 'user',
      text: `${selectedOption.label}`,
      timestamp: now,
      status: 'delivered',
    };
    setMessages((prev) => [...prev, userMsg]);
    setActiveUserPrompt(userMsg);

    // Question 10 Safety Escalation Check:
    // EPDS_Q10 ("The thought of harming myself has occurred to me") reverse-scored:
    // Index 0: "Yes, quite often" (score 3)
    // Index 1: "Sometimes" (score 2)
    // Index 2: "Hardly ever" (score 1)
    // Index 3: "Never" (score 0)
    let triggeredCrisis = q10CrisisAlert;
    if (currentQ.id === 'EPDS_Q10' || currentQ.safety_critical) {
      if (selectedIndex !== 3) {
        triggeredCrisis = true;
        setQ10CrisisAlert(true);

        const langKey = selectedLanguage !== 'auto' ? selectedLanguage : 'en';
        const localizedCrisis = LOCALIZED_Q10_CRISIS_MESSAGES[langKey] || LOCALIZED_Q10_CRISIS_MESSAGES.en;

        const crisisMsg = {
          id: `msg-crisis-alert-${Date.now() + 1}`,
          sender: 'bot',
          text: `${localizedCrisis.title}\n\n${localizedCrisis.body}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEmergency: true,
          safetyStatus: 'URGENT_SAFETY_ASSESSMENT',
          source: 'safety_guard',
        };
        setMessages((prev) => [...prev, crisisMsg]);
        setActiveCrisisMsg(crisisMsg);
        presentBotReply(crisisMsg);
      }
    }

    const nextIdx = currentQuestionIdx + 1;
    if (nextIdx < 10) {
      // Advance to next question strictly in sequential order
      setCurrentQuestionIdx(nextIdx);
      const nextQ = screeningQuestions[nextIdx];
      const nextMsg = {
        id: `msg-epds-q-${nextIdx + 1}-${Date.now() + 2}`,
        sender: 'bot',
        text:
          `Question ${nextQ.question_number} of 10:\n"${nextQ.question}"\n\n` +
          nextQ.response_options.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'epds_question',
        question: nextQ,
      };
      setMessages((prev) => [...prev, nextMsg]);
      presentBotReply(nextMsg);
    } else {
      // All 10 questions answered! Submit to backend for score calculation
      setCurrentQuestionIdx(10);
      setIsSubmittingScreening(true);

      const finalMsg = {
        id: `msg-epds-finalizing-${Date.now() + 2}`,
        sender: 'bot',
        text: 'Thank you for completing all 10 questions. Submitting your responses to the clinical screening engine...',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, finalMsg]);
      presentBotReply(finalMsg, { shouldSpeak: false });

      try {
        const submissionPayload = newAnswers.map((ans) => ({
          question_id: ans.question_id,
          selected_index: ans.selected_index,
        }));

        const result = await submitEPDSQuestionnaire(submissionPayload);
        setScreeningResult(result);
        setScreeningActive(false);

        // Update PatientContext screening record for patient views (/patient/reports, etc.)
        if (typeof setScreening === 'function') {
          const riskPct = Math.round((result.total_score / (result.maximum_score || 30)) * 100);
          setScreening((prev) => ({
            ...prev,
            date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            completedDateTime: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            latestDate: `${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            riskScore: riskPct,
            riskLabel: `${result.classification} (EPDS ${result.total_score}/${result.maximum_score || 30})`,
            summary: result.clinical_significance,
            recommendationText: result.recommended_action,
            epdsResult: result,
          }));
        }

        // Trigger persistent sync to reload database-backed patient reports
        if (typeof reloadPatientData === 'function') {
          reloadPatientData().catch(() => { });
        }

        // Cross-record screening in doctor dashboard for clinician visibility
        if (typeof clinical?.recordScreening === 'function') {
          const clinicalRisk = result.total_score >= 13 ? 'High' : result.total_score >= 10 ? 'Moderate' : 'Low';
          const targetMotherId = patient?.id === 'P-101' ? 'M-104' : (patient?.id || 'M-104');
          clinical.recordScreening({
            motherId: targetMotherId,
            risk: clinicalRisk,
            modality: 'EPDS Clinical Questionnaire (Sequential Voice & Text)',
            summary: `EPDS score: ${result.total_score}/30 (${result.classification}). ${result.clinical_significance}. Item 10 safety: ${result.safety_alert?.triggered ? 'Triggered (Acute Crisis)' : 'Negative'}.`,
            epdsEquivalent: result.total_score,
            discordanceDetected: false,
            durationSeconds: 180,
            preliminaryScore: Number((result.total_score / 30).toFixed(2)),
            indicators: [
              `EPDS Total Score: ${result.total_score}/30`,
              `Clinical Classification: ${result.classification}`,
              `Recommended Action: ${result.recommended_action}`,
            ],
          });
        }

        const scoreMsg = {
          id: `msg-epds-result-${Date.now() + 3}`,
          sender: 'bot',
          text:
            `EPDS Screening Assessment Complete:\n\n` +
            `• Total Score: ${result.total_score} / ${result.maximum_score || 30}\n` +
            `• Classification: ${result.classification}\n` +
            `• Clinical Significance: ${result.clinical_significance}\n` +
            `• Recommended Action: ${result.recommended_action}\n\n` +
            `Clinical Disclaimer: ${result.screening_disclaimer}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isEmergency: Boolean(result.safety_alert?.triggered || triggeredCrisis),
          screeningResult: result,
          source: 'epds_result',
        };
        setMessages((prev) => [...prev, scoreMsg]);
        presentBotReply(scoreMsg);
      } catch (err) {
        console.error('Failed to submit EPDS questionnaire:', err);
        const errSubmissionMsg = {
          id: `msg-epds-submit-err-${Date.now() + 3}`,
          sender: 'bot',
          text: 'There was a problem submitting your completed screening. Please check your connection and try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isFallback: true,
        };
        setMessages((prev) => [...prev, errSubmissionMsg]);
        presentBotReply(errSubmissionMsg);
      } finally {
        setIsSubmittingScreening(false);
      }
    }
  };

  /**
   * Cancel or pause ongoing EPDS screening.
   */
  const cancelScreening = () => {
    setScreeningActive(false);
    setCurrentQuestionIdx(0);
    setScreeningAnswers([]);
    const cancelMsg = {
      id: `msg-cancel-${Date.now()}`,
      sender: 'bot',
      text: "Screening paused. You can restart the 10-item EPDS screening anytime by clicking 'EPDS Screening' or asking me.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
    presentBotReply(cancelMsg);
  };

  // ============================================================================
  // Backend Gemini Voice Assistant Integration & Chat Dispatch
  // Connects to POST /api/voice-assistant/chat with multi-turn history & safety
  // ============================================================================
  const handleSendMessage = async (textToSend) => {
    const text = (textToSend || inputText).trim();
    if (!text || isTyping || isSubmittingScreening) return; // Prevent duplicate requests from repeated clicks

    // Stop active speech playback when user asks a new question
    stopSpeaking();

    // Stop voice listening if currently dictating
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch { }
      setIsListening(false);
    }

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // If screening is currently active, route through sequential questionnaire validation
    if (screeningActive && currentQuestionIdx < screeningQuestions.length) {
      const currentQ = screeningQuestions[currentQuestionIdx];

      // Check if user is asking to repeat, clarify, or explain
      if (isClarificationOrRepeatRequest(text)) {
        const userMsg = {
          id: `msg-${Date.now()}`,
          sender: 'user',
          text,
          timestamp: timeString,
          status: 'delivered',
        };
        setMessages((prev) => [...prev, userMsg]);
    setActiveUserPrompt(userMsg);
        setInputText('');

        const repeatMsg = {
          id: `msg-clarify-${Date.now() + 1}`,
          sender: 'bot',
          text:
            `Certainly! Here is Question ${currentQ.question_number} of 10 again:\n\n` +
            `"${currentQ.question}"\n\n` +
            `Reflecting on how you felt over the past 7 days, please select one of the following 4 options:\n` +
            currentQ.response_options.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          source: 'epds_clarification',
          question: currentQ,
        };
        setMessages((prev) => [...prev, repeatMsg]);
        presentBotReply(repeatMsg);
        return;
      }

      // Check if user's input matches one of the 4 options
      const matchedIdx = matchOptionIndex(text, currentQ.response_options);
      if (matchedIdx !== -1) {
        setInputText('');
        handleAnswerQuestion(matchedIdx);
        return;
      }

      // If response does not match any valid option:
      const userMsg = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: timeString,
        status: 'delivered',
      };
      setMessages((prev) => [...prev, userMsg]);
      setActiveUserPrompt(userMsg);
      setInputText('');

      const langKey = selectedLanguage !== 'auto' ? selectedLanguage : 'en';
      const promptTemplate = LOCALIZED_EPDS_VALIDATION_PROMPTS[langKey] || LOCALIZED_EPDS_VALIDATION_PROMPTS.en;
      const localizedPrompt = promptTemplate.replace('{n}', currentQ.question_number);

      const invalidMsg = {
        id: `msg-invalid-option-${Date.now() + 1}`,
        sender: 'bot',
        text:
          `${localizedPrompt}\n\n` +
          `"${currentQ.question}"\n\n` +
          currentQ.response_options.map((opt, i) => `${i + 1}. ${opt.label}`).join('\n') +
          `\n\nYou can click one of the option buttons below or reply with the option number (1 to 4).`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'epds_validation',
        question: currentQ,
      };
      setMessages((prev) => [...prev, invalidMsg]);
      presentBotReply(invalidMsg);
      return;
    }

    // Check if user is asking to start EPDS screening in conversational mode
    const isScreeningIntent = (t) => {
      const lower = t.toLowerCase();
      return (
        lower.includes('epds') ||
        lower.includes('screening') ||
        lower.includes('questionnaire') ||
        lower.includes('depression test') ||
        lower.includes('start assessment') ||
        lower.includes('take screening')
      );
    };

    if (!screeningActive && isScreeningIntent(text)) {
      const userMsg = {
        id: `msg-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: timeString,
        status: 'delivered',
      };
      setMessages((prev) => [...prev, userMsg]);
      setActiveUserPrompt(userMsg);
      setInputText('');
      await startEPDSScreening();
      return;
    }

    // Prevent duplicate simultaneous AI requests
    if (isSendingChatRef.current) return;

    // Standard Gemini Voice Assistant conversation
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: timeString,
      status: 'delivered',
    };

    setMessages((prev) => [...prev, newMsg]);
    setActiveUserPrompt(newMsg);
    setInputText('');

    // Handle simple greetings locally without unnecessary network requests
    const isGreeting = /^(hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening|namaste|namaskar|vanakkam|salaam)[\s!,?.]*$/i.test(text.trim());
    if (isGreeting) {
      const gLang = selectedLanguage !== 'auto' ? selectedLanguage : 'en';
      const GREETING_RESPONSES = {
        en: 'Hello! Welcome to MIORA. How are you and your baby feeling today?',
        hi: 'नमस्ते! मियोरा (MIORA) में आपका स्वागत है। आज आप और आपका शिशु कैसा महसूस कर रहे हैं?',
        kn: 'ನಮಸ್ಕಾರ! ಮಿಯೋರಾ (MIORA) ಗೆ ಸುಸ್ವಾಗತ. ಇಂದು ನೀವು ಮತ್ತು ನಿಮ್ಮ ಮಗು ಹೇಗೆ ಭಾವಿಸುತ್ತಿದ್ದೀರಿ?',
        ta: 'வணக்கம்! மியோராவுக்கு (MIORA) வரவேற்கிறோம். இன்று நீங்கள் எப்படி உணர்கிறீர்கள்?',
        te: 'నమస్కారం! మియోరా (MIORA) కు స్వాగతం. ఈ రోజు మీరు ఎలా ఉన్నారు?',
        ml: 'നമസ്കാരം! മിയോറയിലേക്ക് (MIORA) സ്വാഗതം. ഇന്ന് നിങ്ങൾക്ക് എങ്ങനെ തോന്നുന്നു?',
        bn: 'নমস্কার! মিওরাতে (MIORA) আপনাকে স্বাগতম। আজ আপনি কেমন অনুভব করছেন?',
        mr: 'नमस्कार! मियोरा (MIORA) मध्ये आपले स्वागत आहे. आज आपल्याला कसे वाटत आहे?',
      };
      const botReply = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text: GREETING_RESPONSES[gLang] || GREETING_RESPONSES.en,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: false,
        safetyStatus: 'safe',
        isFallback: false,
        source: 'local_deterministic',
        model: 'miora-fast',
        voiceLocale: supportedLanguages[gLang]?.locale || 'en-IN',
        language: gLang,
      };
      setMessages((prev) => {
        const updated = [...prev, botReply];
        savePatientAiConversations(updated, activeMood).catch(() => { });
        return updated;
      });
      presentBotReply(botReply);
      return;
    }

    isSendingChatRef.current = true;
    setIsTyping(true);

    // Format concise conversation history (recent 6 turns) to reduce payload size and latency
    const historyPayload = messages.slice(-6).map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      content: m.text,
    }));

    try {
      const response = await sendVoiceAssistantChat({
        message: text,
        history: historyPayload,
        language: selectedLanguage !== 'auto' ? selectedLanguage : undefined,
      });

      const botReply = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text: response.text || response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: Boolean(response.is_emergency),
        safetyStatus: response.safety_status,
        emergencyCategory: response.emergency_category,
        isFallback: Boolean(response.is_fallback),
        source: response.source || 'gemini',
        model: response.model,
        voiceLocale: response.voice_locale,
        language: response.language,
      };

      setMessages((prev) => {
        const updated = [...prev, botReply];
        savePatientAiConversations(updated, activeMood).catch(() => { });
        return updated;
      });
      presentBotReply(botReply);
    } catch (err) {
      console.warn('Voice assistant backend communication failed, providing fallback:', err);
      const fallbackReply = {
        id: `msg-${Date.now() + 1}`,
        sender: 'bot',
        text:
          "I am having a brief connection issue right now, but please know you are not alone " +
          "and you are doing a wonderful job. Take a slow, gentle breath, and please try talking with me again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isEmergency: false,
        safetyStatus: 'safe',
        isFallback: true,
        source: 'fallback',
        model: null,
        voiceLocale: 'en-IN',
        language: 'en',
      };
      setMessages((prev) => {
        const updated = [...prev, fallbackReply];
        savePatientAiConversations(updated, activeMood).catch(() => { });
        return updated;
      });
      presentBotReply(fallbackReply);
    } finally {
      setIsTyping(false);
      isSendingChatRef.current = false;
    }
  };

  handleSendMessageRef.current = handleSendMessage;

  const handlePromptClick = (promptQuery) => {
    handleSendMessage(promptQuery);
  };

  // Compute smoothly revealed text for the robot's live answer bubble
  const displayedReplyText = (() => {
    if (!activeBotReply?.text) return '';
    if (revealedWordCount == null) return activeBotReply.text;
    const words = activeBotReply.text.split(/(\s+)/);
    return words.slice(0, revealedWordCount).join('');
  })();

  const isRevealingReply = Boolean(
    activeBotReply?.text &&
    revealedWordCount != null &&
    revealedWordCount < activeBotReply.text.split(/(\s+)/).length
  );

  const robotStateClass = isListening
    ? 'is-listening'
    : isTyping
      ? 'is-thinking'
      : isSpeaking || isRevealingReply
        ? 'is-speaking'
        : '';

  const welcomeSpeakText =
    "Hello! I'm Miora, your AI Assistant. How can I help support you today?";

  return (
    <div className="companion-page-content companion-holo-page">
      {/* Compact Top Bar: Breadcrumb + Title */}
      <div className="companion-holo-page-header">
        <div className="companion-breadcrumb-bar">
          <NavLink to="/patient/reports" className="companion-breadcrumb-link">
            {Icons.home}
            <span>Home</span>
          </NavLink>
          <span className="companion-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
          <span className="companion-breadcrumb-current">AI Assistant</span>
        </div>
        <h1 className="sr-only">Your AI Companion</h1>
      </div>

      {/* Full-Screen Holographic AI Assistant Experience */}
      <section
        className={`companion-holo-fullscreen ${robotStateClass}`}
        aria-label="Miora AI Assistant Hologram"
      >
        <div className="companion-holo-wrapper">
          {/* Full-Width Translucent Rose-Blush Hologram Frame */}
          <div className="companion-holo-frame">
            <div className="companion-holo-ambient-glow" aria-hidden="true" />
            <div className="companion-holo-light-rays" aria-hidden="true" />

            {/* Top Bar inside Hologram Frame */}
            <div className="companion-holo-top-row">
              <div className="companion-holo-brand-group">
                <div className="companion-holo-badge">
                  <span className="companion-holo-badge-star" aria-hidden="true">
                    {Icons.sparkleStar}
                  </span>
                  <span className="companion-holo-badge-label">AI ASSISTANT</span>
                </div>
                <span className="companion-holo-sub-badge">Miora AI • Maternal Companion</span>
              </div>

              <div className="companion-holo-controls">
                <select
                  className="companion-language-select"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  aria-label="Select conversation language"
                  title="Select conversation language"
                >
                  <option value="auto">🌐 Auto Language</option>
                  {Object.entries(supportedLanguages).map(([code, info]) => (
                    <option key={code} value={code}>
                      {info.native_name} ({info.name})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className={`companion-holo-ctrl-btn ${autoSpeak ? 'is-active' : ''}`}
                  onClick={() => {
                    if (autoSpeak && isSpeaking) stopSpeaking();
                    setAutoSpeak((prev) => !prev);
                  }}
                  aria-pressed={autoSpeak}
                  title={autoSpeak ? 'Voice replies enabled (click to mute)' : 'Voice replies muted (click to enable)'}
                >
                  {autoSpeak ? Icons.volumeOn : Icons.volumeOff}
                  <span>{autoSpeak ? 'Voice On' : 'Muted'}</span>
                </button>

                {isSpeaking && (
                  <button
                    type="button"
                    className="companion-stop-speech-pill"
                    onClick={stopSpeaking}
                    aria-label="Stop reading response"
                    title="Stop assistant speech"
                  >
                    <span className="companion-audio-wave" aria-hidden="true" />
                    <span>Stop</span>
                  </button>
                )}

                <span className={`companion-status-indicator ${robotStateClass}`}>
                  <span className="companion-online-dot" />
                  {isListening
                    ? 'Listening...'
                    : isTyping
                      ? 'Thinking...'
                      : isSpeaking
                        ? 'Speaking...'
                        : 'Online • Ready'}
                </span>

                <button
                  type="button"
                  className="companion-holo-ctrl-btn"
                  onClick={() => setShowHistoryDrawer(true)}
                  aria-label="View conversation history"
                  title="View past conversation"
                >
                  {Icons.history}
                  <span>History</span>
                </button>
              </div>
            </div>

            {/* Optional Notices & Crisis Safety Guardrail */}
            {voiceNotice && (
              <div className="companion-holo-inline-banner companion-voice-notice-banner" role="status" aria-live="polite">
                <span className="companion-voice-notice-icon" aria-hidden="true">ℹ️</span>
                <span className="companion-voice-notice-text">{voiceNotice}</span>
                <button
                  type="button"
                  className="companion-dismiss-error-btn"
                  onClick={() => setVoiceNotice(null)}
                  aria-label="Dismiss voice notice"
                >
                  ✕
                </button>
              </div>
            )}

            {Boolean(q10CrisisAlert || screeningResult?.safety_alert?.triggered) && (
              <div className="companion-holo-inline-banner companion-crisis-sticky-banner" role="alert" aria-label="Crisis Safety Helpline">
                <div className="companion-crisis-sticky-content">
                  <div className="companion-crisis-sticky-title">
                    <span>🚨</span>
                    <strong>{activeCrisisMsg ? activeCrisisMsg.text.split('\n\n')[0] : 'Immediate Crisis Support Available'}</strong>
                  </div>
                  {activeCrisisMsg && (
                    <div style={{ margin: '2px 0 4px', whiteSpace: 'pre-line' }}>
                      {activeCrisisMsg.text.split('\n\n').slice(1).join('\n\n')}
                    </div>
                  )}
                  <div>
                    Tele-MANAS 24/7 Helpline:{' '}
                    <a href="tel:14416" className="companion-crisis-sticky-phone">14416</a>{' '}
                    or{' '}
                    <a href="tel:18008914416" className="companion-crisis-sticky-phone">1800-891-4416</a>{' '}
                    (Toll-Free, Multilingual)
                  </div>
                </div>
                <button
                  type="button"
                  className="companion-crisis-sticky-btn"
                  onClick={() => navigate('/patient/connect-doctor')}
                >
                  Connect Care Team
                </button>
              </div>
            )}

            {/* Center 3-Zone Spatial Stage: User Prompt (Left) · Holographic Robot (Center) · Robot's Answer (Right) */}
            <div className="companion-holo-center-stage">
              {/* LEFT ZONE: Sparkle Bubble + Live Spoken/Typed User Question */}
              <div className="companion-holo-left-zone">
                <div className="companion-holo-sparkle-bubble" aria-hidden="true">
                  {Icons.sparkleCluster}
                </div>

                {(isListening || activeUserPrompt) && (
                  <div className={`companion-holo-user-bubble ${isListening ? 'is-live' : ''}`} role="status" aria-live="polite">
                    <div className="companion-holo-user-label">
                      <span className="companion-holo-user-dot" aria-hidden="true" />
                      <span>{isListening ? 'Listening to you...' : 'You asked'}</span>
                    </div>
                    <p className="companion-holo-user-text">
                      {isListening
                        ? (inputText.trim() || 'Speak naturally — I am listening...')
                        : activeUserPrompt?.text}
                    </p>
                  </div>
                )}
              </div>

              {/* CENTER ZONE: Holographic 3D AI Assistant Avatar + Live Voice/Listening Visualizers */}
              <div className="companion-holo-center-zone">
                <div className="companion-holo-avatar-wrap">
                  {/* Expanding sonar rings while listening or speaking */}
                  <div className="companion-holo-sonar-ring ring-1" aria-hidden="true" />
                  <div className="companion-holo-sonar-ring ring-2" aria-hidden="true" />

                  <img
                    src="/assets/miora-ai-holo-avatar.jpg"
                    alt="Miora AI Assistant"
                    className="companion-holo-avatar-img"
                  />

                  {/* Animated Voice Equalizer Waveform when Robot is Speaking or Revealing Answer */}
                  {(isSpeaking || isRevealingReply || isTyping) && (
                    <div
                      className={`companion-holo-voice-wave ${isTyping ? 'is-thinking' : 'is-talking'}`}
                      aria-hidden="true"
                    >
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT ZONE: Robot's Live Answer Speech Bubble */}
              <div className="companion-holo-right-zone">
                <div
                  className={`companion-holo-speech-bubble ${activeBotReply?.isEmergency ? 'is-emergency' : ''} ${activeBotReply ? 'has-reply' : ''}`}
                  role="log"
                  aria-live="polite"
                >
                  {isTyping ? (
                    <div className="companion-holo-thinking-state">
                      <div className="companion-holo-reply-head">
                        <span className="companion-holo-reply-speaker">Miora AI</span>
                        <span className="companion-holo-reply-state-pill">Thinking</span>
                      </div>
                      <div className="companion-holo-typing-dots" aria-label="Miora is typing">
                        <span className="companion-typing-dot" />
                        <span className="companion-typing-dot" />
                        <span className="companion-typing-dot" />
                      </div>
                      <p className="companion-holo-bubble-sub">
                        Listening with care and preparing your response...
                      </p>
                    </div>
                  ) : activeBotReply ? (
                    <div className="companion-holo-live-reply">
                      {activeBotReply.isEmergency && (
                        <div className="companion-emergency-alert-banner">
                          <span>🚨 Urgent Crisis Support Helpline</span>
                        </div>
                      )}

                      <div className="companion-holo-reply-head">
                        <span className="companion-holo-reply-speaker">Miora AI</span>
                        {isSpeaking && (
                          <span className="companion-holo-reply-state-pill is-speaking">
                            Speaking...
                          </span>
                        )}
                      </div>

                      <div className="companion-holo-reply-body">
                        {displayedReplyText.split('\n\n').map((para, i) => (
                          <p key={i} className="companion-holo-reply-para">
                            {para}
                          </p>
                        ))}

                        {/* Active Sequential EPDS Options right inside Robot's Answer Bubble */}
                        {screeningActive && currentQuestionIdx < screeningQuestions.length && (
                          <div className="companion-holo-epds-inline" data-testid="active-screening-box">
                            <div className="companion-screening-top">
                              <span className="companion-screening-badge">📋 EPDS Screening</span>
                              <span className="companion-screening-counter">
                                Question {currentQuestionIdx + 1} of 10
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--patient-subtle)' }}>
                              Edinburgh Postnatal Depression Scale (EPDS) screening — select how you have felt in the past 7 days.
                            </p>
                            {selectedLanguage !== 'auto' && selectedLanguage !== 'en' && (
                              <div className="companion-screening-translation-notice" data-testid="translation-provenance-notice">
                                <span className="companion-provenance-pill">
                                  Validated English Instrument • Conversational assistance in {supportedLanguages[selectedLanguage]?.name || selectedLanguage}
                                </span>
                              </div>
                            )}
                            <div className="companion-screening-progress-track">
                              <div
                                className="companion-screening-progress-fill"
                                style={{ width: `${((currentQuestionIdx + 1) / 10) * 100}%` }}
                              />
                            </div>
                            <p className="companion-screening-question-text">
                              &quot;{screeningQuestions[currentQuestionIdx].question}&quot;
                            </p>
                            <div className="companion-screening-options-list" role="group" aria-label="EPDS response options">
                              {screeningQuestions[currentQuestionIdx].response_options.map((opt, optIdx) => (
                                <button
                                  key={optIdx}
                                  type="button"
                                  className="companion-screening-opt-btn"
                                  data-testid={`epds-option-${optIdx}`}
                                  onClick={() => handleAnswerQuestion(optIdx)}
                                >
                                  <span className="companion-screening-opt-index">{optIdx + 1}</span>
                                  <span className="companion-screening-opt-label">{opt.label}</span>
                                </button>
                              ))}
                            </div>
                            <div className="companion-screening-footer-actions">
                              <button
                                type="button"
                                className="companion-screening-clarify-btn"
                                onClick={() => handleSendMessage('Could you explain or repeat this question?')}
                              >
                                Repeat question
                              </button>
                              <button
                                type="button"
                                className="companion-screening-cancel-btn"
                                onClick={cancelScreening}
                              >
                                Pause screening
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Structured EPDS Result Card */}
                        {activeBotReply.screeningResult && (
                          <div className="companion-result-card" data-testid="epds-result-card">
                            <div className="companion-result-header">
                              <span className="companion-result-score-tag">
                                Score: {activeBotReply.screeningResult.total_score} / {activeBotReply.screeningResult.maximum_score || 30}
                              </span>
                              <span
                                className={`companion-result-tier ${activeBotReply.screeningResult.total_score >= 13
                                  ? 'is-probable'
                                  : activeBotReply.screeningResult.total_score >= 10
                                    ? 'is-possible'
                                    : 'is-low'
                                  }`}
                              >
                                {activeBotReply.screeningResult.classification}
                              </span>
                            </div>
                            <p style={{ margin: '4px 0', fontSize: '12px', color: '#4a353f' }}>
                              <strong>Recommended Action:</strong> {activeBotReply.screeningResult.recommended_action}
                            </p>
                            {activeBotReply.screeningResult.screening_disclaimer && (
                              <small style={{ color: '#8c747f', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                                {activeBotReply.screeningResult.screening_disclaimer}
                              </small>
                            )}
                            <div className="companion-result-actions-row">
                              <button
                                type="button"
                                className="companion-result-action-btn"
                                onClick={() => navigate('/patient/connect-doctor')}
                              >
                                Connect with Care Team
                              </button>
                              <button
                                type="button"
                                className="companion-result-secondary-btn"
                                onClick={() => startEPDSScreening()}
                              >
                                Retake Screening
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Reply Footer: Replay / Listen + Model / Safety Tag */}
                      <div className="companion-holo-reply-footer">
                        <button
                          type="button"
                          className={`companion-msg-listen-btn ${speakingMsgId === activeBotReply.id ? 'is-active' : ''}`}
                          onClick={() => speakText(activeBotReply.text, activeBotReply.id, activeBotReply.voiceLocale)}
                          aria-label={speakingMsgId === activeBotReply.id ? 'Stop speaking' : 'Read response aloud'}
                        >
                          {speakingMsgId === activeBotReply.id ? (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                              <rect x="6" y="6" width="12" height="12" rx="1.5" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                          )}
                          <span>{speakingMsgId === activeBotReply.id ? 'Stop' : 'Listen'}</span>
                        </button>

                        <div className="companion-holo-reply-tags">
                          {activeBotReply.source === 'safety_guard' && (
                            <span className="companion-msg-source-tag is-safety">Safety Guard</span>
                          )}
                          {activeBotReply.source?.startsWith('epds') && (
                            <span className="companion-msg-source-tag is-epds">EPDS Screening</span>
                          )}
                          {activeBotReply.source === 'gemini' && !activeBotReply.isFallback && (
                            <span className="companion-msg-source-tag is-gemini">
                              {activeBotReply.model || 'Gemini'}
                            </span>
                          )}
                          {activeBotReply.isFallback && (
                            <span className="companion-msg-source-tag is-fallback">Support Notice</span>
                          )}
                          <time className="companion-holo-reply-time">{activeBotReply.timestamp}</time>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Initial Warm Welcome Greeting from the Robot */
                    <div className="companion-holo-welcome">
                      <p className="companion-holo-bubble-line">Hello! I&apos;m your</p>
                      <p className="companion-holo-bubble-accent">AI Assistant.</p>
                      <p className="companion-holo-bubble-sub">
                        How can I help support you today? Tap the mic to speak or type your question below.
                      </p>
                      <div className="companion-holo-reply-footer">
                        <button
                          type="button"
                          className={`companion-msg-listen-btn ${speakingMsgId === 'welcome-greeting' ? 'is-active' : ''}`}
                          onClick={() => speakText(welcomeSpeakText, 'welcome-greeting', 'en-IN')}
                          aria-label={speakingMsgId === 'welcome-greeting' ? 'Stop speaking' : 'Read response aloud'}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                          </svg>
                          <span>{speakingMsgId === 'welcome-greeting' ? 'Stop' : 'Listen'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom 3 Feature Pills (SMART · ADAPTIVE · SECURE) */}
            <div className="companion-holo-pills" aria-label="AI Assistant capabilities">
              <div className="companion-holo-pill">
                <span className="companion-holo-pill-icon" aria-hidden="true">{Icons.brain}</span>
                <span>SMART</span>
              </div>
              <div className="companion-holo-pill">
                <span className="companion-holo-pill-icon" aria-hidden="true">{Icons.adaptive}</span>
                <span>ADAPTIVE</span>
              </div>
              <div className="companion-holo-pill">
                <span className="companion-holo-pill-icon" aria-hidden="true">{Icons.shieldCheck}</span>
                <span>SECURE</span>
              </div>
            </div>
          </div>

          {/* Circular Concentric Holographic Projector Pedestal */}
          <div className="companion-holo-pedestal" aria-hidden="true">
            <div className="companion-holo-beam-cone" />
            <div className="companion-holo-pedestal-base">
              <div className="companion-holo-ring companion-holo-ring-outer" />
              <div className="companion-holo-ring companion-holo-ring-mid" />
              <div className="companion-holo-ring companion-holo-ring-inner" />
              <div className="companion-holo-core-glow" />
            </div>
          </div>

          {/* Interactive Speak-or-Type Dock right beneath the Hologram Pedestal */}
          <div className="companion-holo-input-dock">
            {/* Suggested Quick Question Pills */}
            <div className="companion-holo-prompt-chips" aria-label="Suggested Prompts">
              <button
                type="button"
                className="companion-prompt-chip"
                onClick={() => handlePromptClick('Could you share some simple coping strategies?')}
              >
                <span className="companion-chip-icon">{Icons.leaf}</span>
                <span>Coping Strategies</span>
              </button>

              <button
                type="button"
                className="companion-prompt-chip"
                onClick={() => handlePromptClick('Can you guide me through a calming breathing exercise?')}
              >
                <span className="companion-chip-icon">{Icons.lotus}</span>
                <span>Breathing Exercise</span>
              </button>

              <button
                type="button"
                className="companion-prompt-chip"
                onClick={() => handlePromptClick('Should I see a doctor about how I am feeling?')}
              >
                <span className="companion-chip-icon">{Icons.calendarCheck}</span>
                <span>Should I See a Doctor?</span>
              </button>

              <button
                type="button"
                className="companion-prompt-chip is-epds-chip"
                onClick={() => startEPDSScreening()}
              >
                <span>📋 Take EPDS Screening</span>
              </button>
            </div>

            {speechError && (
              <div className="companion-holo-error-pill" role="alert">
                <span>{speechError}</span>
                <button
                  type="button"
                  className="companion-dismiss-error-btn"
                  onClick={() => setSpeechError(null)}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Main Speak or Type Capsule */}
            <form
              className={`companion-holo-ask-bar ${isListening ? 'is-listening' : ''}`}
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <button
                type="button"
                className={`companion-holo-mic-cta ${isListening ? 'is-listening' : ''}`}
                onClick={handleToggleVoice}
                aria-label={isListening ? 'Stop listening' : 'Start voice dictation'}
                title={isListening ? 'Listening... click to stop' : 'Tap to speak your question'}
              >
                {Icons.mic}
                <span>{isListening ? 'Listening...' : 'Speak'}</span>
              </button>

              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    handleSendMessage(`[Attached: ${e.target.files[0].name}]`);
                  }
                }}
              />
              <button
                type="button"
                className="companion-attach-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach document or note"
              >
                {Icons.paperclip}
              </button>

              <input
                type="text"
                className="companion-holo-ask-input"
                placeholder="Ask me anything about your maternal well-being..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                aria-label="Message Miora AI"
              />

              <button
                type="submit"
                className="companion-holo-send-btn"
                aria-label="Send message"
                disabled={!inputText.trim() || isTyping}
              >
                {Icons.send}
                <span>Ask</span>
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Optional Slide-Over Conversation History Drawer (on-demand only) */}
      {showHistoryDrawer && (
        <div
          className="companion-history-backdrop"
          onClick={() => setShowHistoryDrawer(false)}
          role="dialog"
          aria-label="Conversation History"
        >
          <div className="companion-history-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="companion-history-head">
              <div>
                <h2 className="companion-history-title">Conversation History</h2>
                <span className="companion-history-sub">Saved privately with Miora AI</span>
              </div>
              <button
                type="button"
                className="companion-history-close"
                onClick={() => setShowHistoryDrawer(false)}
                aria-label="Close history"
              >
                ✕
              </button>
            </div>
            <div className="companion-history-list">
              {messages.map((msg) => {
                const isBot = msg.sender === 'bot';
                return (
                  <div key={msg.id} className={`companion-msg-row ${isBot ? 'is-bot' : 'is-user'}`}>
                    {isBot && (
                      <div className="companion-msg-avatar" aria-hidden="true">
                        <span className="companion-msg-avatar-char">M</span>
                      </div>
                    )}
                    <div className="companion-msg-col">
                      <div className={`companion-msg-bubble ${msg.isEmergency ? 'is-emergency' : ''}`}>
                        {msg.text.split('\n\n').map((para, i) => (
                          <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0 0' }}>{para}</p>
                        ))}
                      </div>
                      <div className="companion-msg-meta">
                        <time>{msg.timestamp}</time>
                        {isBot && (
                          <button
                            type="button"
                            className="companion-msg-listen-btn"
                            onClick={() => speakText(msg.text, msg.id, msg.voiceLocale)}
                          >
                            {speakingMsgId === msg.id ? 'Stop' : 'Listen'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiAssistantScreen;
