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
  documentHeart: (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </svg>
  ),
};

// 5 Mood face SVGs precisely matching reference
const MoodFaces = [
  {
    id: 'distressed',
    label: 'Distressed',
    render: (size = 22) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="8" y1="9" x2="10" y2="9.5" />
        <line x1="16" y1="9" x2="14" y2="9.5" />
        <path d="M8 16c1-1.5 2-2 4-2s3 .5 4 2" />
      </svg>
    ),
  },
  {
    id: 'down',
    label: 'Down',
    render: (size = 22) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="9" cy="9.5" r="1" fill="currentColor" />
        <circle cx="15" cy="9.5" r="1" fill="currentColor" />
        <path d="M9 16c1-1.2 2-1.8 3-1.8s2 .6 3 1.8" />
      </svg>
    ),
  },
  {
    id: 'neutral',
    label: 'Neutral',
    render: (size = 22) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="9" cy="9.5" r="1" fill="currentColor" />
        <circle cx="15" cy="9.5" r="1" fill="currentColor" />
        <line x1="9" y1="15.5" x2="15" y2="15.5" />
      </svg>
    ),
  },
  {
    id: 'okay',
    label: 'Okay',
    render: (size = 22) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="9" cy="9.5" r="1" fill="currentColor" />
        <circle cx="15" cy="9.5" r="1" fill="currentColor" />
        <path d="M9 14.5c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" />
      </svg>
    ),
  },
  {
    id: 'happy',
    label: 'Happy',
    render: (size = 22) => (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="9" cy="9.5" r="1" fill="currentColor" />
        <circle cx="15" cy="9.5" r="1" fill="currentColor" />
        <path d="M8 13.5c1 2.2 2.5 3 4 3s3-.8 4-3" />
      </svg>
    ),
  },
];

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
  const { patient, selectedMood, setPatientMood, setScreening, reloadPatientData } = usePatient();
  const clinical = useClinicalData();
  const navigate = useNavigate();

  // Chat conversation state
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeMood, setActiveMood] = useState('okay');

  // Resource Modal state
  const [activeModal, setActiveModal] = useState(null); // 'audio' | 'meditation' | 'tips' | null

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
  const isSendingChatRef = useRef(false);

  // Voice Interaction States (Browser-Native SpeechRecognition and SpeechSynthesis)
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);

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

  const speakText = (text, msgId, voiceLocale) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      alert('Speech synthesis is not supported in this browser.');
      return;
    }

    if (isSpeaking && speakingMsgId === msgId) {
      stopSpeaking();
      return;
    }

    stopSpeaking();

    const cleanText = text
      .replace(/[*_~`#]/g, '')
      .replace(/[✨🌸♥✦•]/g, '')
      .replace(/\n+/g, ' ');

    try {
      const targetLocale =
        voiceLocale ||
        (selectedLanguage !== 'auto' && supportedLanguages[selectedLanguage]?.locale) ||
        'en-IN';

      // Check voice availability before attempting speech
      const check = checkVoiceAvailability(targetLocale);
      if (check.supported && !check.available) {
        const langName =
          (selectedLanguage !== 'auto' && supportedLanguages[selectedLanguage]?.name) || targetLocale;
        setSpeechError(
          `Browser speech voice for ${langName} is not installed on this system. Responses are displayed in text.`
        );
        return;
      }

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 0.92;
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

  // Voice input: SpeechRecognition
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
      setSpeechError(null);
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
        setInputText(transcript);
      };

      recognition.onerror = (event) => {
        if (voiceWatchdogRef.current) {
          clearTimeout(voiceWatchdogRef.current);
          voiceWatchdogRef.current = null;
        }
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access in browser settings.');
        } else {
          setSpeechError('Could not recognize voice. Please try speaking again.');
        }
      };

      recognition.onend = () => {
        if (voiceWatchdogRef.current) {
          clearTimeout(voiceWatchdogRef.current);
          voiceWatchdogRef.current = null;
        }
        setIsListening(false);
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

  // Sync initial mood with context
  useEffect(() => {
    if (selectedMood) {
      const found = MoodFaces.find(
        (m) => m.id === selectedMood.toLowerCase() || m.label.toLowerCase() === selectedMood.toLowerCase()
      );
      if (found) {
        setActiveMood(found.id);
      }
    }
  }, [selectedMood]);

  const scrollToBottom = () => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (messages.length > INITIAL_MESSAGES.length || isTyping) {
      scrollToBottom();
    }
  }, [messages, isTyping]);

  const handleSelectMood = (mood) => {
    setActiveMood(mood.id);
    setPatientMood?.(mood.label);
    savePatientAiConversations(messages, mood.id).catch(() => { });
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
      text: "Screening paused. You can restart the 10-item EPDS screening anytime by clicking 'Take EPDS Screening' or asking me.",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, cancelMsg]);
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
    } finally {
      setIsTyping(false);
      isSendingChatRef.current = false;
    }
  };

  const handlePromptClick = (promptQuery) => {
    handleSendMessage(promptQuery);
  };

  return (
    <div className="companion-page-content">
      {/* Breadcrumb Bar */}
      <div className="companion-breadcrumb-bar">
        <NavLink to="/patient/reports" className="companion-breadcrumb-link">
          {Icons.home}
          <span>Home</span>
        </NavLink>
        <span className="companion-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
        <span className="companion-breadcrumb-current">AI Assistant</span>
      </div>

      {/* Hero Header Banner */}
      <div className="patient-card companion-hero-banner">
        <div className="companion-hero-text">
          <h1 className="patient-page-heading companion-title">Your AI Companion</h1>
          <p className="patient-page-subheading companion-sub">
            A safe, confidential space to talk, reflect, and receive compassionate guidance through your postpartum journey.
          </p>
        </div>

        <div className="companion-hero-illu-wrap" aria-hidden="true">
          <img
            src="/assets/companion-mother-baby-smooth.png"
            alt=""
            className="companion-hero-illustration"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="companion-columns-layout">
        {/* Left Column – Conversational Chat Card */}
        <section className="patient-card companion-chat-card" aria-label="Miora AI Chat Interface">
          {/* Header */}
          <div className="companion-chat-header">
            <div className="companion-chat-header-left">
              <div className="companion-bot-avatar-badge" aria-hidden="true">
                <span className="companion-bot-badge-char">M</span>
              </div>
              <div>
                <h2 className="companion-chat-title">Miora AI</h2>
                <span className="companion-assistant-tag">Your Maternal Emotional Companion</span>
              </div>
            </div>

            <div className="companion-chat-header-actions">
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

              {isSpeaking && (
                <button
                  type="button"
                  className="companion-stop-speech-pill"
                  onClick={stopSpeaking}
                  aria-label="Stop reading response"
                  title="Stop assistant speech"
                >
                  <span className="companion-audio-wave" aria-hidden="true" />
                  <span>Stop Speaking</span>
                </button>
              )}
              <span className={`companion-status-indicator ${isListening ? 'is-listening' : isSpeaking ? 'is-speaking' : ''}`}>
                <span className="companion-online-dot" />
                {isListening ? 'Listening...' : isSpeaking ? 'Speaking...' : 'Online • Ready'}
              </span>
            </div>
          </div>

          {/* Voice Engine Fallback Notice Banner */}
          {voiceNotice && (
            <div className="companion-voice-notice-banner" role="status" aria-live="polite">
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

          {/* Sticky Crisis Helpline Banner (triggered by Q10 or backend safety alert) */}
          {Boolean(q10CrisisAlert || screeningResult?.safety_alert?.triggered) && (
            <div className="companion-crisis-sticky-banner" role="alert" aria-label="Crisis Safety Helpline">
              <div className="companion-crisis-sticky-content">
                <div className="companion-crisis-sticky-title">
                  <span>🚨</span>
                  <strong>Immediate Crisis Support Available</strong>
                </div>
                <div>
                  Tele-MANAS 24/7 Helpline:{' '}
                  <a href="tel:14416" className="companion-crisis-sticky-phone">
                    14416
                  </a>{' '}
                  or{' '}
                  <a href="tel:18008914416" className="companion-crisis-sticky-phone">
                    1800-891-4416
                  </a>{' '}
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

          {/* Messages Stream */}
          <div className="companion-chat-messages" role="log" aria-live="polite">
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
                      {msg.isEmergency && (
                        <div className="companion-emergency-alert-banner">
                          <span>🚨 Urgent Crisis Support Helpline</span>
                        </div>
                      )}
                      {msg.text.split('\n\n').map((para, i) => (
                        <p key={i} style={{ margin: i === 0 ? 0 : '8px 0 0 0' }}>{para}</p>
                      ))}

                      {/* Structured EPDS Result Card */}
                      {msg.screeningResult && (
                        <div className="companion-result-card" data-testid="epds-result-card">
                          <div className="companion-result-header">
                            <span className="companion-result-score-tag">
                              Score: {msg.screeningResult.total_score} / {msg.screeningResult.maximum_score || 30}
                            </span>
                            <span
                              className={`companion-result-tier ${msg.screeningResult.total_score >= 13
                                ? 'is-probable'
                                : msg.screeningResult.total_score >= 10
                                  ? 'is-possible'
                                  : 'is-low'
                                }`}
                            >
                              {msg.screeningResult.classification}
                            </span>
                          </div>
                          <p style={{ margin: '4px 0', fontSize: '12.5px', color: '#4a353f' }}>
                            <strong>Clinical Significance:</strong> {msg.screeningResult.clinical_significance}
                          </p>
                          <p style={{ margin: '4px 0', fontSize: '12.5px', color: '#4a353f' }}>
                            <strong>Recommended Action:</strong> {msg.screeningResult.recommended_action}
                          </p>
                          <small style={{ color: '#8c747f', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                            {msg.screeningResult.screening_disclaimer}
                          </small>
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
                    <div className="companion-msg-meta">
                      <time>{msg.timestamp}</time>
                      {isBot && (
                        <>
                          <button
                            type="button"
                            className={`companion-msg-listen-btn ${speakingMsgId === msg.id ? 'is-active' : ''}`}
                            onClick={() => speakText(msg.text, msg.id, msg.voiceLocale)}
                            aria-label={speakingMsgId === msg.id ? 'Stop speaking' : 'Read response aloud'}
                            title={speakingMsgId === msg.id ? 'Stop reading' : 'Listen to response'}
                          >
                            {speakingMsgId === msg.id ? (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="6" width="12" height="12" rx="1.5" />
                              </svg>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                              </svg>
                            )}
                            <span>{speakingMsgId === msg.id ? 'Stop' : 'Listen'}</span>
                          </button>
                          {msg.source === 'safety_guard' && (
                            <span className="companion-msg-source-tag is-safety" title="Immediate deterministic safety escalation">
                              Safety Guard
                            </span>
                          )}
                          {msg.source?.startsWith('epds') && (
                            <span className="companion-msg-source-tag is-epds" title="Validated EPDS Clinical Instrument">
                              EPDS Screening
                            </span>
                          )}
                          {msg.source === 'gemini' && !msg.isFallback && (
                            <span className="companion-msg-source-tag is-gemini" title={`Powered by ${msg.model || 'Gemini 2.5 Flash'}`}>
                              {msg.model || 'Gemini'}
                            </span>
                          )}
                          {msg.isFallback && (
                            <span className="companion-msg-source-tag is-fallback" title="Compassionate offline support notice">
                              Support Notice
                            </span>
                          )}
                        </>
                      )}
                      {!isBot && msg.status && (
                        <span className="companion-check-icon" aria-label="Delivered">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="companion-msg-row is-bot">
                <div className="companion-msg-avatar" aria-hidden="true">
                  <span className="companion-msg-avatar-char">M</span>
                </div>
                <div className="companion-typing-row" aria-label="Miora is typing">
                  <span className="companion-typing-dot" />
                  <span className="companion-typing-dot" />
                  <span className="companion-typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Active Sequential EPDS Questionnaire UI */}
          {screeningActive && currentQuestionIdx < screeningQuestions.length && (
            <div className="companion-screening-box" data-testid="active-screening-box">
              <div className="companion-screening-top">
                <span className="companion-screening-badge">
                  <span>📋</span> EPDS Clinical Screening
                </span>
                <span className="companion-screening-counter">
                  Question {currentQuestionIdx + 1} of 10
                </span>
              </div>

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
                "{screeningQuestions[currentQuestionIdx].question}"
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
                  Need clarification or repetition?
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

          {/* Suggested Prompt Chips */}
          <div className="companion-chips-row" aria-label="Suggested Prompts">
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
          </div>

          {/* Voice Listening & Feedback Banner */}
          {isListening && (
            <div className="companion-listening-banner" role="status">
              <span className="companion-listening-pulse" aria-hidden="true" />
              <span className="companion-listening-text">Listening... speak naturally. Your words will appear below.</span>
              <button
                type="button"
                className="companion-stop-mic-btn"
                onClick={handleToggleVoice}
              >
                Stop
              </button>
            </div>
          )}
          {speechError && (
            <div className="companion-speech-error-banner" role="alert">
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

          {/* Message Input Bar */}
          <form
            className="companion-input-capsule"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
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
              className="companion-text-input"
              placeholder="Ask me anything about your maternal well-being..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              aria-label="Message Miora AI"
            />

            <button
              type="button"
              className={`companion-mic-btn ${isListening ? 'is-listening' : ''}`}
              onClick={handleToggleVoice}
              aria-label={isListening ? 'Stop listening' : 'Start voice dictation'}
              title={isListening ? 'Listening... click to stop' : 'Voice input'}
            >
              {Icons.mic}
            </button>

            <button
              type="submit"
              className="companion-send-btn"
              aria-label="Send message"
              disabled={!inputText.trim() || isTyping}
            >
              {Icons.send}
            </button>
          </form>
        </section>

        {/* Right Column – Information & Resource Panels */}
        <aside className="companion-info-panels" aria-label="Companion Guidance & Resources">
          {/* Panel 1: Mood Today */}
          <section className="patient-card companion-info-card" aria-labelledby="mood-card-title">
            <div className="companion-card-header">
              <span className="companion-help-icon" style={{ color: '#d93c75' }} aria-hidden="true">
                {Icons.barChart}
              </span>
              <h3 id="mood-card-title" className="companion-card-title">Your Mood Today</h3>
            </div>

            <p className="companion-card-desc">How are you feeling right now?</p>

            <div className="companion-mood-row" role="radiogroup" aria-label="Select your mood today">
              {MoodFaces.map((face) => {
                const isActive = activeMood === face.id;
                return (
                  <button
                    key={face.id}
                    type="button"
                    className={`companion-mood-btn ${isActive ? 'is-active' : ''}`}
                    onClick={() => handleSelectMood(face)}
                    role="radio"
                    aria-checked={isActive}
                    aria-label={face.label}
                  >
                    {face.render(22)}
                  </button>
                );
              })}
            </div>

            <div className="companion-mood-label-row">
              <span className="companion-mood-pill">
                Current: {MoodFaces.find((m) => m.id === activeMood)?.label || 'Okay'}
              </span>
            </div>
          </section>

          {/* Panel 2: How I Can Help */}
          <section className="patient-card companion-info-card" aria-labelledby="help-card-title">
            <div className="companion-card-header">
              <span className="companion-sparkle-icon" aria-hidden="true">{Icons.sparkles}</span>
              <h3 id="help-card-title" className="companion-card-title">How I Can Help</h3>
            </div>
            <ul className="companion-help-list">
              <li
                className="companion-help-item"
                onClick={() => handlePromptClick("I'd like to talk about how I've been feeling.")}
              >
                <span className="companion-help-icon">{Icons.chatDots}</span>
                <span>Talk about your feelings</span>
              </li>
              <li
                className="companion-help-item"
                onClick={() => handlePromptClick("Can you suggest some gentle self-care activities for today?")}
              >
                <span className="companion-help-icon">{Icons.lotus}</span>
                <span>Suggest self-care activities</span>
              </li>
              <li
                className="companion-help-item"
                onClick={() => handlePromptClick("I have questions about postpartum recovery and maternal feelings.")}
              >
                <span className="companion-help-icon">{Icons.book}</span>
                <span>Answer postpartum questions</span>
              </li>
              <li
                className="companion-help-item"
                onClick={() => navigate('/patient/connect-doctor')}
              >
                <span className="companion-help-icon">{Icons.stethoscope}</span>
                <span>Connect with your care team</span>
              </li>
            </ul>
          </section>

          {/* Panel 3: Quick Resources */}
          <section className="patient-card companion-info-card" aria-labelledby="resources-card-title">
            <div className="companion-card-header">
              <span className="companion-help-icon" style={{ color: '#d93c75' }} aria-hidden="true">
                {Icons.book}
              </span>
              <h3 id="resources-card-title" className="companion-card-title">Quick Resources</h3>
            </div>

            <div className="companion-resources-grid">
              <div
                className="companion-resource-card"
                onClick={() => setActiveModal('audio')}
                role="button"
                tabIndex={0}
                aria-label="Open Relaxation Audio"
              >
                <span className="companion-resource-icon">{Icons.playCircle}</span>
                <span className="companion-resource-title">
                  Relaxation<br />Audio
                </span>
              </div>

              <div
                className="companion-resource-card"
                onClick={() => setActiveModal('meditation')}
                role="button"
                tabIndex={0}
                aria-label="Open Guided Meditation"
              >
                <span className="companion-resource-icon">{Icons.lotus}</span>
                <span className="companion-resource-title">
                  Guided<br />Meditation
                </span>
              </div>

              <div
                className="companion-resource-card"
                onClick={() => setActiveModal('tips')}
                role="button"
                tabIndex={0}
                aria-label="Open Postpartum Tips"
              >
                <span className="companion-resource-icon">{Icons.documentHeart}</span>
                <span className="companion-resource-title">
                  Postpartum<br />Tips
                </span>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {/* Interactive Resource Modals */}
      {activeModal && (
        <div className="companion-modal-backdrop" onClick={() => setActiveModal(null)} role="dialog">
          <div className="patient-card companion-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="companion-modal-head">
              <h4 className="companion-modal-title">
                {activeModal === 'audio' && 'Relaxation Audio'}
                {activeModal === 'meditation' && 'Guided Meditation'}
                {activeModal === 'tips' && 'Postpartum Recovery Tips'}
              </h4>
              <button
                type="button"
                className="companion-modal-close-btn"
                onClick={() => setActiveModal(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <div className="companion-modal-body">
              {activeModal === 'audio' && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <p style={{ fontSize: '13px', color: '#5b4750', marginBottom: '16px' }}>
                    Soothing ocean swell and gentle ambient soundscape designed to calm postpartum nervous system arousal.
                  </p>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--patient-blush-soft)', border: '1px solid var(--patient-blush-border)', borderRadius: '30px', color: '#d93c75', fontWeight: 600, fontSize: '13px' }}>
                    <span>▶ Playing: Gentle Ocean Waves (04:12)</span>
                  </div>
                </div>
              )}

              {activeModal === 'meditation' && (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <p style={{ fontSize: '13px', color: '#5b4750', marginBottom: '16px' }}>
                    A 3-minute mindful pause for mothers: softening body tension and embracing self-compassion.
                  </p>
                  <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: 'var(--patient-blush-pill)', border: '3px solid #ea3b75', margin: '0 auto 12px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d93c75', fontSize: '14px', fontWeight: 700 }}>
                    Inhale
                  </div>
                  <small style={{ color: '#8c747f' }}>Breathe softly with the gentle pulsing rhythm</small>
                </div>
              )}

              {activeModal === 'tips' && (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#4a353f', lineHeight: 1.6 }}>
                  <li><strong>Rest when possible:</strong> Even 15 minutes of quiet resting restores neurological energy.</li>
                  <li><strong>Hydration &amp; Warm Nourishment:</strong> Soups, warm teas, and iron-rich foods aid healing.</li>
                  <li><strong>Ask for specific help:</strong> Let family or friends hold household tasks so you can bond and recover.</li>
                  <li><strong>Be gentle with yourself:</strong> Baby blues and mood fluctuations are natural hormonal transitions.</li>
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AiAssistantScreen;
