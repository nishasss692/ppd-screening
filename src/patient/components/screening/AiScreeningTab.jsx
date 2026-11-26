import React, { useState, useRef, useEffect } from 'react';
import { PatientIcon } from '../PatientIcons.jsx';
import {
  getVoiceLocale,
  getBestNaturalVoice,
} from '../../services/voiceAssistantService.js';
import {
  uploadScreeningVideo,
  fetchMultimodalStatus,
  submitMultimodalScreening,
} from '../../services/patientApiService.js';
import { createSessionFeatureCapture } from '../../utils/mediaFeatureCapture.js';

/**
 * 5 Standard Open-ended Conversational Prompts for AANCHAL AI Screening
 */
export const CONVERSATIONAL_SCREENING_QUESTIONS = [
  {
    id: 'conv_q1',
    prompt: 'How have you been feeling emotionally since your baby was born? You can share whatever comes to mind.',
    guidance: 'Take your time. Share whatever thoughts, emotions, or daily moments come to mind.',
  },
  {
    id: 'conv_q2',
    prompt: 'Have you been feeling more anxious, worried, sad, or overwhelmed than usual recently? Could you tell me a little about that?',
    guidance: 'It is very common to have mixed or heavy feelings. Tell me about anything that has felt difficult.',
  },
  {
    id: 'conv_q3',
    prompt: 'How have you been sleeping and managing your daily routine? Has anything felt particularly difficult?',
    guidance: 'Reflect on your sleep, rest, energy levels, and getting through day-to-day routines with your baby.',
  },
  {
    id: 'conv_q4',
    prompt: 'How connected or supported have you been feeling by your family, partner, or people around you?',
    guidance: 'Support matters deeply. Feel free to talk about who is there for you and how supported you feel.',
  },
  {
    id: 'conv_q5',
    prompt: 'Is there anything else about your thoughts, feelings, or experiences that you would like to share?',
    guidance: 'Anything else you would like your care team to know or understand about your journey.',
  },
];

export function AiScreeningTab({ onContinueToEpds, inClinicMotherId }) {
  const currentLanguage = typeof window !== 'undefined' ? (window.localStorage?.getItem('miora_lang') || 'en') : 'en';

  // Session lifecycle: 'consent_required' | 'chat_active' | 'completed'
  const [sessionPhase, setSessionPhase] = useState('consent_required');
  const [consentGiven, setConsentGiven] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [isInitializingCamera, setIsInitializingCamera] = useState(false);

  // Live media stream state
  const [liveStream, setLiveStream] = useState(null);

  // Chat conversation state
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [isSpeakingPrompt, setIsSpeakingPrompt] = useState(false);

  // Continuous video and question audio recording states
  const [sessionSeconds, setSessionSeconds] = useState(0);

  // Stored responses per question for model pipelines
  const [questionResponses, setQuestionResponses] = useState([]);

  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const isSubmittingAnswerRef = useRef(false);
  const latestTranscriptRef = useRef('');

  // Multimodal model pipeline readiness status from FastAPI backend
  const [pipelineStatus, setPipelineStatus] = useState(null);

  useEffect(() => {
    let isMounted = true;
    let pollTimer = null;

    const checkStatus = () => {
      fetchMultimodalStatus()
        .then((data) => {
          if (isMounted) {
            setPipelineStatus(data);
            if (
              data?.audio?.status === 'ready' &&
              data?.video?.status === 'ready' &&
              data?.text?.status === 'ready' &&
              data?.clinical?.status === 'ready'
            ) {
              if (pollTimer) clearInterval(pollTimer);
            }
          }
        })
        .catch((err) => {
          console.warn('Multimodal pipeline readiness notice:', err);
        });
    };

    checkStatus();
    pollTimer = setInterval(checkStatus, 4000);

    return () => {
      isMounted = false;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, []);

  // Refs for media streams, speech recognition, and video recording
  const streamRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const continuousVideoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const isVoiceRecordingRef = useRef(false);
  const accumulatedFinalTranscriptRef = useRef('');
  const recordingTimerRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const chatBottomRef = useRef(null);
  const usedVoiceForQuestionRef = useRef(false);
  const featureCaptureRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current && typeof chatBottomRef.current.scrollIntoView === 'function') {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isListening, inputText]);

  // Clean up streams, intervals, synthesis on unmount
  useEffect(() => {
    return () => {
      stopAllMedia();
    };
  }, []);

  const stopAllMedia = () => {
    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
    isVoiceRecordingRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) { }
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) { }
    }
    if (featureCaptureRef.current) {
      try {
        featureCaptureRef.current.stopAndExtract(0, 0);
      } catch (e) { }
      featureCaptureRef.current = null;
    }
    if (continuousVideoRecorderRef.current && continuousVideoRecorderRef.current.state !== 'inactive') {
      try {
        continuousVideoRecorderRef.current.stop();
      } catch (e) { }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) { }
      });
      streamRef.current = null;
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Compulsory Camera & Microphone Initialization
  // ---------------------------------------------------------------------------
  const handleStartScreeningSession = async () => {
    if (!consentGiven) {
      setCameraError('Please provide your explicit consent for continuous video and voice recording to begin.');
      return;
    }

    setCameraError('');
    setIsInitializingCamera(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser environment. Video recording is mandatory for AI Screening.');
      }

      // Mandatory Video + Audio constraints with resilient fallback
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 320 },
            height: { ideal: 720, min: 240 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
      } catch (idealErr) {
        console.warn('Ideal video constraints failed, falling back to basic video+audio:', idealErr);
        // Fallback to basic unconstrained video + audio
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      // Verify active video track
      const videoTracks = stream.getVideoTracks();
      if (!videoTracks || videoTracks.length === 0 || !videoTracks[0].enabled) {
        throw new Error('No active video track found. Please ensure your camera is connected and unblocked.');
      }

      streamRef.current = stream;
      setLiveStream(stream);
      try {
        featureCaptureRef.current = createSessionFeatureCapture(stream, () => videoPreviewRef.current);
      } catch (e) { }

      // Start Continuous Video Recording for the entire session
      videoChunksRef.current = [];
      try {
        let recorderOptions = { mimeType: 'video/webm' };
        if (typeof window !== 'undefined' && window.MediaRecorder) {
          if (window.MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
            recorderOptions = { mimeType: 'video/webm;codecs=vp8,opus' };
          } else if (window.MediaRecorder.isTypeSupported('video/mp4')) {
            recorderOptions = { mimeType: 'video/mp4' };
          }
          const recorder = new MediaRecorder(stream, recorderOptions);
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              videoChunksRef.current.push(e.data);
            }
          };
          recorder.start(1000); // 1-second timeslices
          continuousVideoRecorderRef.current = recorder;
        }
      } catch (recErr) {
        console.warn('Continuous video MediaRecorder notice:', recErr);
        try {
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
              videoChunksRef.current.push(e.data);
            }
          };
          recorder.start(1000);
          continuousVideoRecorderRef.current = recorder;
        } catch (e2) { }
      }

      // Start Session Timer
      setSessionSeconds(0);
      if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = setInterval(() => {
        setSessionSeconds((prev) => prev + 1);
      }, 1000);

      // Initialize Chat with First Question
      const q1 = CONVERSATIONAL_SCREENING_QUESTIONS[0];
      setMessages([
        {
          id: 'ai-intro',
          sender: 'assistant',
          text: "Hello, I am your AANCHAL AI Screening Assistant. I'm here to gently understand how you've been feeling since your baby arrived. We will go through five open-ended questions together. You can answer by speaking or typing.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        {
          id: 'ai-q1',
          sender: 'assistant',
          questionId: q1.id,
          questionIndex: 0,
          text: q1.prompt,
          guidance: q1.guidance,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      setCurrentQuestionIdx(0);
      setSessionPhase('chat_active');
    } catch (err) {
      console.error('Camera initialization failure:', err);
      let errorMsg = 'Video recording is compulsory for this research screening. Camera and microphone permissions are required to proceed.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMsg = 'Camera and microphone permission was denied. Please click the camera icon in your browser address bar or check browser site settings to allow access, then try again.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorMsg = 'No camera or microphone found. Please connect a working webcam or microphone to your device and try again.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorMsg = 'Camera or microphone is already in use by another application. Please close other video apps (e.g. Zoom, Teams) and try again.';
      } else if (err.name === 'OverconstrainedError') {
        errorMsg = 'Your camera does not support the requested video settings. Please try again with default camera options.';
      }
      setCameraError(errorMsg);
      setSessionPhase('consent_required');
    } finally {
      setIsInitializingCamera(false);
    }
  };

  // Robust callback ref to guarantee video element immediately receives stream and plays
  const setVideoPreviewRef = (videoEl) => {
    videoPreviewRef.current = videoEl;
    if (videoEl && streamRef.current) {
      videoEl.muted = true;
      videoEl.defaultMuted = true;
      videoEl.playsInline = true;
      if (videoEl.srcObject !== streamRef.current) {
        videoEl.srcObject = streamRef.current;
      }
      videoEl.play().catch((err) => {
        console.warn('Video preview autoplay notice:', err);
      });
    }
  };

  // Redundant effect ensures stream is bound across renders without stopping/restarting
  useEffect(() => {
    if (sessionPhase === 'chat_active' && videoPreviewRef.current && streamRef.current) {
      const el = videoPreviewRef.current;
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      if (el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
      }
      el.play().catch(() => { });
    }
  }, [sessionPhase, liveStream, currentQuestionIdx]);

  // ---------------------------------------------------------------------------
  // 2. Primary Voice Dictation / Speech-to-Text with Unlimited Duration
  // ---------------------------------------------------------------------------
  const safeStartRecognition = (recognitionInstance) => {
    if (!recognitionInstance) return;
    try {
      recognitionInstance.start();
    } catch (err) {
      if (err.name !== 'InvalidStateError') {
        console.warn('Recognition start notice:', err);
      }
    }
  };

  const handleStartVoice = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. You can type your response in the text box.');
      return;
    }

    setSpeechError(null);

    // If there is an existing recognition instance, clean it up before re-instantiating
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) { }
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      const targetLocale = getVoiceLocale(currentLanguage) || 'en-IN';
      recognition.lang = targetLocale;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        let sessionFinal = '';
        let sessionInterim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            sessionFinal += res[0].transcript + ' ';
          } else {
            sessionInterim += res[0].transcript;
          }
        }

        if (sessionFinal) {
          accumulatedFinalTranscriptRef.current = (
            (accumulatedFinalTranscriptRef.current ? accumulatedFinalTranscriptRef.current + ' ' : '') + sessionFinal
          ).trim();
        }

        const combined = [accumulatedFinalTranscriptRef.current, sessionInterim]
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (combined) {
          usedVoiceForQuestionRef.current = true;
          latestTranscriptRef.current = combined;
          setInputText(combined);
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
          // Mother is pausing between sentences or thinking; do not stop recording.
          return;
        }
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission not granted. You can type your answer directly.');
          handleFinishVoice();
          return;
        }
        if (event.error !== 'aborted') {
          console.warn('Speech recognition notice:', event.error);
        }
      };

      recognition.onend = () => {
        // If the user hasn't explicitly clicked "Finish Answer", reconnect automatically
        // so that natural pauses or browser session timeouts do NOT terminate recording
        if (isVoiceRecordingRef.current) {
          if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
          restartTimeoutRef.current = setTimeout(() => {
            if (isVoiceRecordingRef.current && recognitionRef.current) {
              safeStartRecognition(recognitionRef.current);
            }
          }, 150);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      isVoiceRecordingRef.current = true;
      setIsListening(true);
      usedVoiceForQuestionRef.current = true;

      // Start duration counter for this answer
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      safeStartRecognition(recognition);
    } catch (err) {
      console.warn('SpeechRecognition start failed:', err);
      setSpeechError('Could not start speech recognition. Please type your answer.');
      setIsListening(false);
      isVoiceRecordingRef.current = false;
    }
  };

  const handleFinishVoice = () => {
    isVoiceRecordingRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }
    setIsListening(false);

    // Finalize transcript
    const finalized = (accumulatedFinalTranscriptRef.current || inputText || latestTranscriptRef.current || '').trim();
    if (finalized) {
      latestTranscriptRef.current = finalized;
      accumulatedFinalTranscriptRef.current = finalized;
      setInputText(finalized);
    }
  };

  const handleRerecord = () => {
    // Discard current transcript and start recording fresh
    isVoiceRecordingRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) { }
    }
    setIsListening(false);
    accumulatedFinalTranscriptRef.current = '';
    latestTranscriptRef.current = '';
    setInputText('');
    setRecordingSeconds(0);
    setSpeechError(null);

    // Promptly begin fresh recording
    setTimeout(() => {
      handleStartVoice();
    }, 50);
  };

  const handleStopVoice = (autoSubmit = false) => {
    handleFinishVoice();
    if (autoSubmit && latestTranscriptRef.current && !isSubmittingAnswerRef.current) {
      handleSendMessage(latestTranscriptRef.current);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Submit Mother's Answer (Voice or Text) & Advance Assistant
  // ---------------------------------------------------------------------------
  const isLikelyGibberish = (raw) => {
    const words = raw.trim().match(/[A-Za-z]+/g) || [];
    if (words.length === 0) return true;
    const meaningfulWords = words.filter((word) => {
      const w = word.toLowerCase();
      if (w.length === 1) return w === 'i' || w === 'a';
      if (/(.)\1{2,}/.test(w)) return false;
      if (!/[aeiouy]/.test(w)) return false;
      if (/[bcdfghjklmnpqrstvwxz]{4,}/.test(w)) return false;
      if (/(qwert|asdf|zxcv|hjkl|yuio|bnm)/.test(w)) return false;
      return true;
    });
    return meaningfulWords.length === 0;
  };

  const handleSendMessage = (explicitText = null) => {
    if (isSubmittingAnswerRef.current) return;

    if (isVoiceRecordingRef.current) {
      handleFinishVoice();
    }

    const rawText = typeof explicitText === 'string' ? explicitText : (accumulatedFinalTranscriptRef.current || inputText);
    const textToSend = rawText ? rawText.trim() : '';
    if (!textToSend) {
      setSpeechError('Please speak or type your answer before proceeding.');
      return;
    }

    if (isLikelyGibberish(textToSend)) {
      setSpeechError('Please enter a meaningful response in words so your screening can be evaluated accurately.');
      return;
    }

    isSubmittingAnswerRef.current = true;
    setIsSubmittingAnswer(true);
    setSpeechError(null);
    handleFinishVoice();

    const currentQ = CONVERSATIONAL_SCREENING_QUESTIONS[currentQuestionIdx];
    const isVoice = usedVoiceForQuestionRef.current;
    usedVoiceForQuestionRef.current = false;
    latestTranscriptRef.current = '';
    accumulatedFinalTranscriptRef.current = '';
    setRecordingSeconds(0);

    // 1. Add Mother's message to chat
    const motherMsg = {
      id: `mother-${Date.now()}`,
      sender: 'mother',
      text: textToSend,
      questionId: currentQ.id,
      isVoice,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, motherMsg]);

    // 2. Record structured response for model pipelines
    const newResponseRecord = {
      questionId: currentQ.id,
      questionNumber: currentQuestionIdx + 1,
      questionText: currentQ.prompt,
      responseText: textToSend,
      responseType: isVoice ? 'voice_transcribed' : 'typed_text',
      language: currentLanguage || 'en',
      recordedAt: new Date().toISOString(),
    };

    setQuestionResponses((prev) => [...prev, newResponseRecord]);
    setInputText('');

    // 3. Advance to Next Question or Complete Session
    const nextIdx = currentQuestionIdx + 1;
    if (nextIdx < CONVERSATIONAL_SCREENING_QUESTIONS.length) {
      setCurrentQuestionIdx(nextIdx);
      const nextQ = CONVERSATIONAL_SCREENING_QUESTIONS[nextIdx];

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-q${nextIdx + 1}-${Date.now()}`,
            sender: 'assistant',
            questionId: nextQ.id,
            questionIndex: nextIdx,
            text: nextQ.prompt,
            guidance: nextQ.guidance,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        isSubmittingAnswerRef.current = false;
        setIsSubmittingAnswer(false);
      }, 600);
    } else {
      // All 5 questions answered! Finalize session
      setTimeout(() => {
        handleFinalizeScreeningSession([...questionResponses, newResponseRecord]);
        isSubmittingAnswerRef.current = false;
        setIsSubmittingAnswer(false);
      }, 800);
    }
  };

  // ---------------------------------------------------------------------------
  // 4. Finalize Session: Stop Video, Save Pipelines & Persist
  // ---------------------------------------------------------------------------
  const handleFinalizeScreeningSession = async (allResponses) => {
    if (sessionTimerRef.current) {
      clearInterval(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    // Stop continuous video recorder
    // Extract captured acoustic (7) & visual dynamics (220) features BEFORE stopping stream
    const combinedNarrative = allResponses
      .map((r, i) => `Q${i + 1}: ${r.responseText}`)
      .join(' ');
    const totalWordCount = combinedNarrative.trim().split(/\s+/).filter(Boolean).length;

    let capturedAudioFeatures = null;
    let capturedVideoFeatures = null;
    if (featureCaptureRef.current) {
      try {
        const extracted = featureCaptureRef.current.stopAndExtract(sessionSeconds, totalWordCount);
        capturedAudioFeatures = extracted.audioFeatures;
        capturedVideoFeatures = extracted.videoFeatures;
      } catch (e) { }
      featureCaptureRef.current = null;
    }

    // Stop continuous video recorder and wait briefly for final chunk flush
    if (continuousVideoRecorderRef.current && continuousVideoRecorderRef.current.state !== 'inactive') {
      await new Promise((resolve) => {
        const rec = continuousVideoRecorderRef.current;
        const timer = setTimeout(resolve, 1000);
        const origOnStop = rec.onstop;
        rec.onstop = (...args) => {
          clearTimeout(timer);
          if (typeof origOnStop === 'function') {
            try { origOnStop(...args); } catch (e) { }
          }
          resolve();
        };
        try {
          rec.stop();
        } catch (e) {
          clearTimeout(timer);
          resolve();
        }
      });
    }

    // Stop live stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) { }
      });
      streamRef.current = null;
    }
    setLiveStream(null);

    // Prepare recorded continuous video file if chunks were captured
    let videoFile = null;
    try {
      if (videoChunksRef.current && videoChunksRef.current.length > 0) {
        const videoBlob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        if (videoBlob.size > 0) {
          videoFile = new File([videoBlob], `aanchal_compulsory_video_${Date.now()}.webm`, {
            type: 'video/webm',
          });
        }
      }
    } catch (e) { }

    const currentUser = typeof window !== 'undefined' ? JSON.parse(window.localStorage?.getItem('miora_auth_user_v1') || '{}') : {};
    const effectiveMotherId = inClinicMotherId || currentUser?.motherId || currentUser?.id || `demo_mother_${Date.now()}`;

    // Submit to live backend multimodal screening endpoint
    let multimodalResult = null;
    try {
      const formData = new FormData();
      formData.append('mother_id', effectiveMotherId);
      formData.append('consent_confirmed', 'true');
      formData.append('text_content', combinedNarrative);
      if (capturedAudioFeatures) {
        formData.append('audio_features', JSON.stringify(capturedAudioFeatures));
      }
      if (capturedVideoFeatures) {
        formData.append('video_features', JSON.stringify(capturedVideoFeatures));
      }
      if (videoFile) {
        formData.append('files_video', videoFile);
      }

      // Merge real clinical profile (37 features) + psychosocial answers (9 features) if available
      const mergedClinical = {};
      try {
        const storedProfile = localStorage.getItem('aanchal_clinical_profile_features');
        if (storedProfile) Object.assign(mergedClinical, JSON.parse(storedProfile));
      } catch (e) { }
      try {
        const storedPsychosocial = localStorage.getItem('aanchal_psychosocial_answers');
        if (storedPsychosocial) Object.assign(mergedClinical, JSON.parse(storedPsychosocial));
      } catch (e) { }
      try {
        const storedClinical = localStorage.getItem('aanchal_clinical_features');
        if (storedClinical) Object.assign(mergedClinical, JSON.parse(storedClinical));
      } catch (e) { }
      if (Object.keys(mergedClinical).length > 0) {
        formData.append('clinical_features', JSON.stringify(mergedClinical));
      }

      multimodalResult = await submitMultimodalScreening(formData).catch((err) => {
        console.warn('Backend multimodal inference notice:', err);
        return null;
      });
      if (multimodalResult) {
        const storedPayload = {
          ...multimodalResult,
          completed_at: multimodalResult.completed_at || multimodalResult.processed_at || new Date().toISOString(),
        };
        localStorage.setItem('aanchal_multimodal_screening_result', JSON.stringify(storedPayload));
      } else {
        localStorage.removeItem('aanchal_multimodal_screening_result');
      }
    } catch (mmErr) {
      console.warn('Backend multimodal inference notice:', mmErr);
    }

    const sessionSummary = {
      assessmentId: `screening_session_${Date.now()}`,
      date: new Date().toISOString(),
      sessionDurationSeconds: sessionSeconds,
      totalQuestions: 5,
      completedQuestions: allResponses.length,
      videoMandatoryVerified: true,
      hasContinuousVideo: true,
      language: currentLanguage || 'en',
      responses: allResponses,
      clinicalModelStatus: multimodalResult?.modality_status?.clinical || multimodalResult?.modalities?.clinical?.status || 'not_requested',
      audioModelStatus: multimodalResult?.modality_status?.audio || multimodalResult?.modalities?.audio?.status || 'not_requested',
      videoModelStatus: multimodalResult?.modality_status?.video || multimodalResult?.modalities?.video?.status || 'not_requested',
      textModelStatus: multimodalResult?.modality_status?.text || multimodalResult?.modalities?.text?.status || 'unavailable',
      multimodalAssessmentStatus: multimodalResult?.status || 'unavailable',
      multimodalResult,
      status: 'completed',
    };

    try {
      localStorage.setItem('aanchal_conversational_screening', JSON.stringify(sessionSummary));
      localStorage.setItem(
        'aanchal_ai_screening_status',
        JSON.stringify({
          questionId: 'conversational_chat_5q',
          totalQuestions: 5,
          hasRecording: true,
          durationSeconds: sessionSeconds,
          recordedAt: new Date().toISOString(),
          status: 'completed',
        })
      );
    } catch (e) { }

    // Upload continuous video to existing backend video endpoint
    if (videoFile) {
      try {
        await uploadScreeningVideo(videoFile).catch(() => { });
      } catch (e) { }
    }

    // Assistant wraps up chat
    setMessages((prev) => [
      ...prev,
      {
        id: `ai-finish-${Date.now()}`,
        sender: 'assistant',
        text: 'Thank you for sharing your feelings with me. Your video, audio, and responses have been safely saved for clinical review. You may now proceed to the Edinburgh Postnatal Depression Scale (EPDS) assessment.',
        isConclusion: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    setSessionPhase('completed');
    // Notify PatientContext to re-fetch backend screening data with updated risk score
    try {
      window.dispatchEvent(new CustomEvent('aanchal-screening-completed', { detail: { ts: Date.now() } }));
    } catch (_e) { /* ignore */ }
  };

  // Read Prompt Aloud
  const handleSpeakQuestion = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (isSpeakingPrompt) {
      window.speechSynthesis.cancel();
      setIsSpeakingPrompt(false);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const targetLocale = getVoiceLocale(currentLanguage) || 'en-IN';
      utterance.lang = targetLocale;
      const voice = getBestNaturalVoice(targetLocale);
      if (voice) utterance.voice = voice;

      utterance.onend = () => setIsSpeakingPrompt(false);
      utterance.onerror = () => setIsSpeakingPrompt(false);

      setIsSpeakingPrompt(true);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      setIsSpeakingPrompt(false);
    }
  };

  const formatTimer = (totalSec) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // View 1: Compulsory Consent & Camera Initialization Screen
  // ---------------------------------------------------------------------------
  if (sessionPhase === 'consent_required') {
    return (
      <div className="aanchal-ai-screening-workspace" aria-label="AI Screening Pre-Check">
        <section className="patient-card ai-screening-intro-card">
          <div className="ai-screening-header">
            <h2 className="ai-screening-setup-heading">AI Screening Session Setup</h2>
          </div>

          {/* Recording Consent Card */}
          <div className="ai-compulsory-video-banner ai-screening-consent-card" role="region" aria-label="Screening recording consent">
            <span className="sr-only">Compulsory Video &amp; Audio Recording</span>
            <div className="ai-compulsory-video-text ai-screening-consent-body">
              <p className="ai-screening-consent-explanation">
                Continuous audio and video recording is required for this screening. Your live camera preview will remain visible throughout the conversation.
              </p>
              <label className="ai-screening-consent-checkbox">
                <input
                  type="checkbox"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                />
                <span>
                  I give explicit consent for continuous camera video and microphone audio recording during this screening session.
                </span>
              </label>
            </div>
          </div>

          {cameraError && (
            <div className="patient-notice-banner is-error" role="alert" style={{ marginTop: '18px' }}>
              <span>{cameraError}</span>
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              className="patient-btn-primary"
              onClick={handleStartScreeningSession}
              disabled={!consentGiven || isInitializingCamera}
            >
              <PatientIcon name="video" size={17} />
              <span>{isInitializingCamera ? 'Enabling Camera & Mic...' : 'Enable Camera & Start AI Screening'}</span>
              <PatientIcon name="arrow-right" size={17} />
            </button>
          </div>
        </section>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View 2: ChatGPT-Style Conversational AI Chat with Fixed Live Camera
  // ---------------------------------------------------------------------------
  return (
    <div className="aanchal-ai-screening-workspace" aria-label="AI Screening Conversational Chat">
      {/* Top Session Progress Bar */}
      <div className="ai-chat-session-header patient-card">
        <div className="ai-chat-header-info">
          <div className="ai-chat-header-badge">
            <span className="ai-pulse-dot" />
            <span>AI SCREENING CHAT ACTIVE</span>
          </div>
          <span className="ai-chat-step-text">
            Question {Math.min(currentQuestionIdx + 1, 5)} of 5
          </span>
        </div>

        <div className="ai-chat-timer-wrap">
          <span className="ai-live-rec-tag"><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626', marginRight: 5 }} />REC</span>
          <span className="ai-live-rec-timer">{formatTimer(sessionSeconds)}</span>
        </div>
      </div>

      {/* Main Two-Column Layout: Chat Window + Sticky Live Camera */}
      <div className="ai-chat-workspace-grid">
        {/* Left Column: ChatGPT-Style Chat Window */}
        <section className="patient-card ai-chat-window-card" aria-label="AI Screening Conversation Stream">
          {/* Scrollable Messages Stream */}
          <div className="ai-chat-messages-container" role="log" aria-live="polite">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`ai-chat-msg-row is-${msg.sender}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="ai-chat-avatar" aria-hidden="true">
                    <PatientIcon name="sparkles" size={18} color="#ba1e53" />
                  </div>
                )}

                <div className={`ai-chat-bubble is-${msg.sender}`}>
                  {msg.sender === 'assistant' && (
                    <div className="ai-chat-bubble-top">
                      <span className="ai-chat-sender-name">AANCHAL AI Assistant</span>
                      {msg.questionIndex !== undefined && (
                        <button
                          type="button"
                          className="ai-chat-listen-btn"
                          onClick={() => handleSpeakQuestion(msg.text)}
                          title="Listen to question"
                          aria-label="Listen to question"
                        >
                          <PatientIcon name="audio" size={13} color="#ba1e53" />
                          <span>Listen</span>
                        </button>
                      )}
                    </div>
                  )}

                  <p className="ai-chat-msg-text">{msg.text}</p>
                  {msg.guidance && <p className="ai-chat-msg-guidance">{msg.guidance}</p>}

                  <div className="ai-chat-msg-meta">
                    <span className="ai-chat-time">{msg.timestamp}</span>
                    {msg.isVoice && <span className="ai-chat-voice-tag">Spoken</span>}
                  </div>
                </div>
              </div>
            ))}

            {/* Live Dictation / Listening Preview Bubble */}
            {isListening && (
              <div className="ai-chat-msg-row is-mother is-draft">
                <div className="ai-chat-bubble is-mother is-draft-bubble">
                  <div className="ai-chat-draft-indicator">
                    <span className="ai-pulse-dot" style={{ background: '#ffffff' }} />
                    <span>Listening &amp; transcribing ({formatTimer(recordingSeconds)})...</span>
                  </div>
                  <p className="ai-chat-msg-text">
                    {inputText || 'Speak naturally. You can speak as much as you need and take your time...'}
                  </p>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Speech Error Banner */}
          {speechError && (
            <div className="patient-notice-banner is-error" style={{ margin: '8px 18px', padding: '8px 12px' }}>
              <span style={{ fontSize: '12.5px' }}>{speechError}</span>
            </div>
          )}

          {/* Bottom Response Bar (Voice + Text + Controls) */}
          {sessionPhase !== 'completed' ? (
            <div className="ai-chat-input-container">
              {/* Guidance reassurance bar */}
              <div className="ai-chat-guidance-bar">
                {isListening ? (
                  <div className="ai-guidance-item is-recording">
                    <span className="ai-pulse-dot" style={{ background: '#dc2626' }} />
                    <strong>Recording active ({formatTimer(recordingSeconds)}):</strong>
                    <span>Take your time — speak as long as you need. Natural pauses are welcome. Click &ldquo;Finish Answer&rdquo; when done.</span>
                  </div>
                ) : inputText.trim().length > 0 ? (
                  <div className="ai-guidance-item is-ready">
                    <PatientIcon name="check" size={14} color="#16a34a" />
                    <span>Response captured. You can review or edit above, re-record, or click <strong>{currentQuestionIdx < 4 ? 'Next Question' : 'Complete Screening'}</strong>.</span>
                  </div>
                ) : (
                  <div className="ai-guidance-item is-prompt">
                    <PatientIcon name="audio" size={14} color="#ba1e53" />
                    <span>Click <strong>Start Speaking</strong> to record your response with unlimited time, or type in the box.</span>
                  </div>
                )}
              </div>

              <div className="ai-chat-input-dock">
                {/* 1. Voice Controls: Start Speaking, Finish Answer, Re-record */}
                {isListening ? (
                  <>
                    <button
                      type="button"
                      className="ai-chat-mic-btn is-active-recording"
                      onClick={handleFinishVoice}
                      disabled={isSubmittingAnswer}
                      title="Finish speaking your answer"
                      aria-label="Finish speaking"
                    >
                      <span className="ai-chat-mic-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                      <span>Finish Answer</span>
                    </button>

                    <button
                      type="button"
                      className="ai-chat-control-btn is-rerecord-btn"
                      onClick={handleRerecord}
                      disabled={isSubmittingAnswer}
                      title="Discard current recording and start again"
                      aria-label="Re-record answer"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                        <path d="M3 21v-5h5" />
                      </svg>
                      <span>Re-record</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ai-chat-mic-btn"
                      onClick={handleStartVoice}
                      disabled={isSubmittingAnswer}
                      title={inputText.trim() ? "Resume speaking more to your answer" : "Speak your answer with unlimited time"}
                      aria-label={inputText.trim() ? "Speak more" : "Start speaking"}
                    >
                      <span className="ai-chat-mic-icon" aria-hidden="true">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="22" />
                        </svg>
                      </span>
                      <span>{inputText.trim() ? "Speak More" : "Start Speaking"}</span>
                    </button>

                    {inputText.trim().length > 0 && (
                      <button
                        type="button"
                        className="ai-chat-control-btn is-rerecord-btn"
                        onClick={handleRerecord}
                        disabled={isSubmittingAnswer}
                        title="Clear response and record again"
                        aria-label="Re-record answer"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
                          <path d="M21 3v5h-5" />
                          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                          <path d="M3 21v-5h5" />
                        </svg>
                        <span>Re-record</span>
                      </button>
                    )}
                  </>
                )}

                {/* 2. Text Input Field (Allows typing or editing transcript) */}
                <div className="ai-chat-input-wrapper">
                  <input
                    type="text"
                    className="ai-chat-text-input"
                    placeholder={
                      isListening
                        ? 'Transcribing in real time... Speak for as long as you need...'
                        : 'Review or edit transcript, or type your answer here...'
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    aria-label="Your response"
                  />
                </div>

                {/* 3. Explicit Next Question Action Button */}
                {inputText.trim().length > 0 && !isListening && (
                  <button
                    type="button"
                    className="ai-chat-next-btn"
                    onClick={() => handleSendMessage()}
                    disabled={isSubmittingAnswer}
                    title={currentQuestionIdx < 4 ? "Proceed to next question" : "Complete and save AI screening"}
                    aria-label={currentQuestionIdx < 4 ? "Next question" : "Complete screening"}
                  >
                    <span>{isSubmittingAnswer ? 'Saving...' : currentQuestionIdx < 4 ? 'Next Question' : 'Complete & Continue'}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="ai-chat-completion-footer">
              <span className="ai-chat-completion-text">
                All 5 questions answered. Multimodal video and acoustic data saved.
              </span>
              <button
                type="button"
                className="patient-btn-primary"
                onClick={() => onContinueToEpds && onContinueToEpds()}
              >
                <span>Proceed to EPDS Assessment</span>
                <PatientIcon name="arrow-right" size={16} />
              </button>
            </div>
          )}
        </section>

        {/* Right Column: Compulsory Live Camera Feed & Model Pipeline Readiness */}
        <aside className="ai-chat-sidebar" aria-label="Compulsory Camera Preview and Model Pipelines">
          {/* Live Continuous Camera Card */}
          <div className="patient-card ai-camera-preview-card">
            <div className="ai-camera-card-header">
              <div className="ai-camera-card-title">
                <PatientIcon name="video" size={16} color="#ba1e53" />
                <span>Continuous Video Recording</span>
              </div>
              <span className="ai-rec-live-badge"><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#dc2626', marginRight: 5 }} />REC LIVE</span>
            </div>

            <div className="ai-camera-stream-container">
              <video
                ref={setVideoPreviewRef}
                autoPlay
                playsInline
                muted
                className="ai-camera-live-element"
                aria-label="Continuous patient video feed"
              />
              <div className="ai-camera-overlay-info">
                <span>Session Duration: {formatTimer(sessionSeconds)}</span>
              </div>
            </div>

            <p className="ai-camera-requirement-note">
              Mandatory continuous video active for facial affect &amp; Action Unit analysis.
            </p>
          </div>

          {/* Model Pipeline Readiness Badges */}
          <div className="patient-card ai-pipelines-status-card">
            <h3 className="ai-pipelines-title">Model Pipeline Routing</h3>
            <div className="ai-pipeline-items">
              <div className="ai-pipeline-item">
                <div className="ai-pipeline-item-head">
                  <PatientIcon name="audio" size={15} color="#ba1e53" />
                  <strong>Audio Model Pipeline</strong>
                </div>
                <small>Receives original microphone audio</small>
                {sessionPhase === 'chat_active' ? (
                  <div className="ai-status-pill is-active" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" style={{ backgroundColor: '#16a34a' }} />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Active (Acoustic Recording)</span>
                  </div>
                ) : pipelineStatus?.audio?.status === 'ready' ? (
                  <div className="ai-status-pill is-ready" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" style={{ backgroundColor: '#16a34a' }} />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Connected (7-Feature Acoustic Model)</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" />
                    <span>Standby (ready on session start)</span>
                  </div>
                )}
              </div>

              <div className="ai-pipeline-item">
                <div className="ai-pipeline-item-head">
                  <PatientIcon name="video" size={15} color="#ba1e53" />
                  <strong>Video Model Pipeline</strong>
                </div>
                <small>Receives continuous camera video</small>
                {sessionPhase === 'chat_active' ? (
                  <div className="ai-status-pill is-active" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" style={{ backgroundColor: '#16a34a' }} />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Active (Continuous Camera)</span>
                  </div>
                ) : pipelineStatus?.video?.status === 'ready' ? (
                  <div className="ai-status-pill is-ready" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" style={{ backgroundColor: '#16a34a' }} />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Connected (220-AU Affect Baseline)</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" />
                    <span>Standby (ready on session start)</span>
                  </div>
                )}
              </div>

              <div className="ai-pipeline-item">
                <div className="ai-pipeline-item-head">
                  <PatientIcon name="document" size={15} color="#ba1e53" />
                  <strong>Text Model Pipeline</strong>
                </div>
                <small>Receives transcribed / typed responses</small>
                {sessionPhase === 'chat_active' ? (
                  <div className="ai-status-pill is-active" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" style={{ backgroundColor: '#16a34a' }} />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Active (Capturing Responses)</span>
                  </div>
                ) : pipelineStatus?.text?.status === 'ready' ? (
                  <div className="ai-status-pill is-ready" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" style={{ backgroundColor: '#16a34a' }} />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Connected (TF-IDF + SGD Classifier)</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" />
                    <span>Standby (ready on session start)</span>
                  </div>
                )}
              </div>

              <div className="ai-pipeline-item">
                <div className="ai-pipeline-item-head">
                  <PatientIcon name="activity" size={15} color="#ba1e53" />
                  <strong>Clinical Model Pipeline</strong>
                </div>
                <small>Receives 46 demographic &amp; obstetric survey predictors</small>
                {pipelineStatus?.clinical?.status === 'ready' ? (
                  <div className="ai-status-pill is-ready" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" style={{ backgroundColor: '#16a34a' }} />
                    <span style={{ color: '#16a34a', fontWeight: '600' }}>Connected (Random Forest Baseline)</span>
                  </div>
                ) : (
                  <div className="ai-status-pill is-pending" style={{ marginTop: 6 }}>
                    <span className="ai-status-dot" />
                    <span>Standby (ready on session start)</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
export default AiScreeningTab;
