/**
 * Voice Assistant API Client Service
 *
 * Integrates the Patient AI Assistant frontend with the backend Gemini
 * multilingual voice assistant endpoint: POST /api/voice-assistant/chat.
 *
 * Adheres strictly to the Phase 2 API contract:
 * - Request: { message: string, history: [{role: string, content: string}], language?: string }
 * - Response: {
 *     status: string,
 *     text: string,
 *     message: string,
 *     language: string,
 *     language_name: string,
 *     voice_locale: string,
 *     is_emergency: boolean,
 *     safety_status: string,
 *     emergency_category: string|null,
 *     is_fallback: boolean,
 *     source: string,
 *     model: string|null
 *   }
 */

import { getAuthToken } from '../../auth/authService.js';

function getApiBase() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MIORA_API_URL) {
    return import.meta.env.VITE_MIORA_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('blob:')) {
    return window.location.origin;
  }
  return '';
}

export const SUPPORTED_LANGUAGES_MAP = {
  en: { name: 'English', native_name: 'English', locale: 'en-IN' },
  hi: { name: 'Hindi', native_name: 'हिन्दी', locale: 'hi-IN' },
  kn: { name: 'Kannada', native_name: 'ಕನ್ನಡ', locale: 'kn-IN' },
  ta: { name: 'Tamil', native_name: 'தமிழ்', locale: 'ta-IN' },
  te: { name: 'Telugu', native_name: 'తెలుగు', locale: 'te-IN' },
  ml: { name: 'Malayalam', native_name: 'മലയാളം', locale: 'ml-IN' },
  bn: { name: 'Bengali', native_name: 'বাংলা', locale: 'bn-IN' },
  mr: { name: 'Marathi', native_name: 'मराठी', locale: 'mr-IN' },
};

/**
 * Check if the user's browser speech synthesis engine has an installed voice
 * matching the target locale (e.g. 'en-IN', 'hi-IN', 'kn-IN', etc.).
 *
 * Transparently indicates voice availability so the UI never pretends
 * an unsupported speech synthesis voice is working.
 *
 * @param {string} voiceLocale
 * @returns {{ supported: boolean, available: boolean, voice: SpeechSynthesisVoice|null }}
 */
export function checkVoiceAvailability(voiceLocale) {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return { supported: false, available: false, voice: null };
  }

  try {
    const voices = window.speechSynthesis.getVoices?.() || [];
    if (!Array.isArray(voices) || voices.length === 0) {
      // Browsers often load voices asynchronously; assume supported if API exists
      return { supported: true, available: true, voice: null };
    }

    const target = (voiceLocale || 'en-IN').toLowerCase().replace('_', '-');
    const langPrefix = target.split('-')[0];

    const match = voices.find((v) => {
      const vLang = (v?.lang || '').toLowerCase().replace('_', '-');
      return vLang === target || vLang.startsWith(`${langPrefix}-`) || vLang === langPrefix;
    });

    return {
      supported: true,
      available: Boolean(match),
      voice: match || null,
    };
  } catch (err) {
    console.warn('Error checking voice availability:', err);
    return { supported: true, available: false, voice: null };
  }
}

/**
 * Verified Crisis Escalation Messages for Question 10 across all 8 supported languages.
 * Single source of safety: National Tele-MANAS (14416 / 1800-891-4416) and 112 emergency.
 */
export const LOCALIZED_Q10_CRISIS_MESSAGES = {
  en: {
    title: '🚨 CRITICAL SAFETY ESCALATION NOTICE',
    body:
      'Your safety and well-being are paramount. You noted having thoughts of self-harm. ' +
      'Please know that you are not alone, and immediate compassionate support is available right now:\n\n' +
      '• Tele-MANAS (24/7 National Mental Health Helpline, India):\n' +
      '  Call 14416 or 1800-891-4416 (Toll-Free, Multilingual)\n' +
      '• Immediate Clinical Attention: Please contact your doctor, obstetrician, or a loved one immediately.\n' +
      '• If you feel in immediate danger, please reach out to local emergency services (112) or visit the nearest hospital emergency room.',
    helpline: 'Tele-MANAS: 14416 / 1800-891-4416',
  },
  hi: {
    title: '🚨 आपातकालीन सुरक्षा सूचना (Safety Escalation)',
    body:
      'आपकी सुरक्षा और भलाई सर्वोपरि है। आपने स्वयं को नुकसान पहुँचाने के विचार व्यक्त किए हैं। ' +
      'कृपया जानें कि आप अकेली नहीं हैं, और तुरंत दयालु सहायता उपलब्ध है:\n\n' +
      '• टेली-मानस (Tele-MANAS) राष्ट्रीय मानसिक स्वास्थ्य हेल्पलाइन:\n' +
      '  14416 या 1800-891-4416 पर कॉल करें (24/7 टोल-फ्री, बहुभाषी निःशुल्क सहायता)\n' +
      '• तत्काल चिकित्सीय सहायता: कृपया अपने डॉक्टर या किसी अपने से तुरंत बात करें।\n' +
      '• आपातकाल के लिए 112 डायल करें या निकटतम अस्पताल के आपातकालीन कक्ष में जाएं।',
    helpline: 'टेली-मानस: 14416 / 1800-891-4416',
  },
  kn: {
    title: '🚨 ತುರ್ತು ಸುರಕ್ಷತಾ ಪ್ರಕಟಣೆ (Safety Escalation)',
    body:
      'ನಿಮ್ಮ ಸುರಕ್ಷತೆ ಅತ್ಯಂತ ಮಹತ್ವದ್ದಾಗಿದೆ. ನೀವು ಸ್ವಯಂ-ಹಾನಿಯ ಆಲೋಚನೆಗಳನ್ನು ಹಂಚಿಕೊಂಡಿದ್ದೀರಿ. ' +
      'ದಯವಿಟ್ಟು ತಿಳಿಯಿರಿ ನೀವು ಒಬ್ಬಂಟಿಯಲ್ಲ, ತಕ್ಷಣದ ಕರುಣಾಪೂರ್ಣ ನೆರವು ಲಭ್ಯವಿದೆ:\n\n' +
      '• ಟೆಲಿ-ಮಾನಸ್ (Tele-MANAS) ರಾಷ್ಟ್ರೀಯ ಮಾನಸಿಕ ಆರೋಗ್ಯ ಸಹಾಯವಾಣಿ:\n' +
      '  14416 ಅಥವಾ 1800-891-4416 ಗೆ ಕರೆ ಮಾಡಿ (24/7 ಉಚಿತ, ಬಹುಭಾಷಾ ಬೆಂಬಲ)\n' +
      '• ತಕ್ಷಣದ ವೈದ್ಯಕೀಯ ನೆರವು: ದಯವಿಟ್ಟು ನಿಮ್ಮ ವೈದ್ಯರನ್ನು ಅಥವಾ ಆತ್ಮೀಯರನ್ನು ಸಂಪರ್ಕಿಸಿ.\n' +
      '• ತಕ್ಷಣದ ತುರ್ತು ಸೇವೆಗಳಿಗಾಗಿ 112 ಗೆ ಕರೆ ಮಾಡಿ.',
    helpline: 'ಟೆಲಿ-ಮಾನಸ್: 14416 / 1800-891-4416',
  },
  ta: {
    title: '🚨 அவசர பாதுகாப்பு அறிவிப்பு (Safety Escalation)',
    body:
      'உங்கள் பாதுகாப்பு மிக முக்கியமானது. உங்களுக்கு சுய தீங்கு விளைவிக்கும் எண்ணங்கள் தோன்றியுள்ளன. ' +
      'நீங்கள் தனியாக இல்லை என்பதை உணருங்கள், உடனடி ஆதரவு தயாராக உள்ளது:\n\n' +
      '• டெலி-மானாஸ் (Tele-MANAS) இலவச உதவி எண்:\n' +
      '  14416 அல்லது 1800-891-4416 (24/7 இலவச, பலமொழி மனநல உதவி)\n' +
      '• உடனடி மருத்துவ உதவி: உங்கள் மருத்துவரை அல்லது அன்பானவர்களை உடனடியாக அணுகவும்.\n' +
      '• அவசர உதவிக்கு 112 ஐ அழைக்கவும்.',
    helpline: 'டெலி-மானாஸ்: 14416 / 1800-891-4416',
  },
  te: {
    title: '🚨 అత్యవసర భద్రతా నోటీసు (Safety Escalation)',
    body:
      'మీ భద్రత మరియు ఆరోగ్యం ఎంతో ముఖ్యం. మీకు హాని కలిగించే ఆలోచనలు వస్తున్నాయని తెలిపారు. ' +
      'మీరు ఒంటరిగా లేరని తెలుసుకోండి, వెంటనే సహాయం అందుబాటులో ఉంది:\n\n' +
      '• టెలి-మానస్ (Tele-MANAS) జాతీయ హెల్ప్‌లైన్:\n' +
      '  14416 లేదా 1800-891-4416 కు కాల్ చేయండి (24/7 ఉచిత బహుభాషా మద్దతు)\n' +
      '• తక్షణ వైద్య సహాయం: దయచేసి వెంటనే వైద్యుడిని లేదా బంధువులను సంప్రదించండి.\n' +
      '• అత్యవసర సేవల కోసం 112 కు కాల్ చేయండి.',
    helpline: 'టెలి-మానస్: 14416 / 1800-891-4416',
  },
  ml: {
    title: '🚨 അടിയന്തര സുരക്ഷാ അറിയിപ്പ് (Safety Escalation)',
    body:
      'നിങ്ങളുടെ സുരക്ഷ പ്രധാനമാണ്. സ്വയം ഉപദ്രവിക്കാനുള്ള ചിന്തകൾ ഉള്ളതായി നിങ്ങൾ രേഖപ്പെടുത്തിയിട്ടുണ്ട്. ' +
      'നിങ്ങൾ തനിച്ചല്ലെന്ന് ഓർക്കുക, അടിയന്തര സഹായം ലഭ്യമാണ്:\n\n' +
      '• ടെലി-മാനസ് (Tele-MANAS) ടോൾ-ഫ്രീ നമ്പർ:\n' +
      '  14416 അല്ലെങ്കിൽ 1800-891-4416 (24/7 സൗജന്യ ബഹുഭാഷാ മാനസികാരോഗ്യ സഹായം)\n' +
      '• അടിയന്തര വൈദ്യസഹായം: ഡോക്ടറുമായോ പ്രിയപ്പെട്ടവരുമായോ ഉടൻ സംസാരിക്കുക.\n' +
      '• അടിയന്തര സാഹചര്യത്തിൽ 112 വിളിക്കുക.',
    helpline: 'ടെലി-മാനസ്: 14416 / 1800-891-4416',
  },
  bn: {
    title: '🚨 জরুরি নিরাপত্তা বিজ্ঞপ্তি (Safety Escalation)',
    body:
      'আপনার নিরাপত্তা ও সুস্থতা সর্বাধিক গুরুত্বপূর্ণ। আপনি নিজেকে আঘাত করার চিন্তার কথা জানিয়েছেন। ' +
      'জানবেন আপনি একা নন, এবং অবিলম্বে সহমর্মী সহায়তা প্রস্তুত রয়েছে:\n\n' +
      '• টেলি-মানস (Tele-MANAS) জাতীয় হেল্পলাইন:\n' +
      '  14416 বা 1800-891-4416 তে কল করুন (24/7 বিনামূল্যে বহুভাষিক মানসিক স্বাস্থ্য সেবা)\n' +
      '• জরুরি চিকিৎসা পরামর্শ: অনুগ্রহ করে অবিলম্বে আপনার চিকিৎসক বা স্বজনদের সাথে যোগাযোগ করুন।\n' +
      '• জরুরি সেবার জন্য 112 ডায়াল করুন।',
    helpline: 'টেলি-মানস: 14416 / 1800-891-4416',
  },
  mr: {
    title: '🚨 आणीबाणी सुरक्षा सूचना (Safety Escalation)',
    body:
      'तुमची सुरक्षितता अत्यंत महत्त्वाची आहे. तुम्हाला स्वतःला दुखावण्याचे विचार येत आहेत. ' +
      'तुम्ही एकट्या नाही आहात आणि लगेच मदत उपलब्ध आहे:\n\n' +
      '• टेली-मानस (Tele-MANAS) टोल-फ्री हेल्पलाइन:\n' +
      '  14416 किंवा 1800-891-4416 (24/7 मोफत बहुभाषिक मानसिक आरोग्य आधार)\n' +
      '• तातडीने वैद्यकीय मदत: कृपया डॉक्टरांशी किंवा जवळच्या व्यक्तींशी त्वरित संपर्क साधा.\n' +
      '• आणीबाणी सेवेसाठी 112 वर कॉल करा.',
    helpline: 'टेली-मानस: 14416 / 1800-891-4416',
  },
};

/**
 * Localized EPDS validation prompts when input is unclear or invalid.
 */
export const LOCALIZED_EPDS_VALIDATION_PROMPTS = {
  en: 'I want to make sure your screening is scored accurately. Please choose one of the 4 verified response options for Question {n}:',
  hi: 'आपकी स्क्रीनिंग का सही मूल्यांकन सुनिश्चित करने के लिए, कृपया प्रश्न {n} के लिए दिए गए 4 विकल्पों में से एक चुनें:',
  kn: 'ನಿಮ್ಮ ಸ್ಕ್ರೀನಿಂಗ್ ನಿಖರವಾಗಿರಲು, ದಯವಿಟ್ಟು ಪ್ರಶ್ನೆ {n} ಕ್ಕೆ ನೀಡಲಾದ 4 ಆಯ್ಕೆಗಳಲ್ಲಿ ಒಂದನ್ನು ಆಯ್ಕೆಮಾಡಿ:',
  ta: 'உங்கள் மதிப்பீடு துல்லியமாக இருப்பதை உறுதிசெய்ய, தயவுசெய்து கேள்வி {n} க்கான 4 தேர்வுகளில் ஒன்றை தேர்வு செய்யவும்:',
  te: 'మీ స్క్రీనింగ్ ఖచ్చితంగా ఉండటానికి, దయచేసి ప్రశ్న {n} కొరకు ఇవ్వబడిన 4 ఎంపికలలో ఒకదాన్ని ఎంచుకోండి:',
  ml: 'സ്ക്രീനിംഗ് കൃത്യമായിരിക്കാൻ, ദയവായി ചോദ്യം {n} നുള്ള 4 ഓപ്ഷനുകളിൽ ഒന്ന് തിരഞ്ഞെടുക്കുക:',
  bn: 'আপনার স্ক্রীনিং নির্ভুলভাবে মূল্যায়নের জন্য, দয়া করে প্রশ্ন {n} এর ৪টি বিকল্পের মধ্যে একটি বেছে নিন:',
  mr: 'तुमच्या तपासणीचे अचूक मूल्यांकन होण्यासाठी, कृपया प्रश्न {n} साठी दिलेल्या ४ पर्यायांपैकी एक निवडा:',
};

/**
 * Clinical translation provenance statement.
 * Never invent translations for canonical clinical items (Cox et al. 1987).
 */
export const TRANSLATION_PROVENANCE_INFO = {
  canonical_instrument: 'Edinburgh Postnatal Depression Scale (EPDS) 10-Item',
  canonical_language: 'en',
  reference_file: 'data/questions.json',
  notice: 'Validated English questionnaire presented for clinical scoring integrity. Conversational guidance and voice interaction provided in selected regional language.',
};

/**
 * Fetch supported maternal languages metadata from GET /api/voice-assistant/languages.
 */
export async function fetchSupportedLanguages(fetchImpl = window.fetch) {
  const apiBase = getApiBase();
  const url = `${apiBase.replace(/\/$/, '')}/api/voice-assistant/languages`;
  try {
    const response = await fetchImpl(url);
    if (!response.ok) {
      return { status: 'fallback', languages: SUPPORTED_LANGUAGES_MAP };
    }
    const data = await response.json();
    return data;
  } catch (err) {
    console.warn('Failed to fetch supported languages from backend, using verified fallback map:', err);
    return { status: 'fallback', languages: SUPPORTED_LANGUAGES_MAP };
  }
}

/**
 * Send user query and multi-turn history to POST /api/voice-assistant/chat.
 *
 * @param {Object} params
 * @param {string} params.message - Current user query or speech transcript
 * @param {Array<{role: string, content: string}>} [params.history] - Conversation history
 * @param {string} [params.language] - Optional ISO 639-1 language code (e.g. 'en', 'hi', 'kn')
 * @param {Function} [fetchImpl] - Optional custom fetch implementation (useful for tests)
 * @returns {Promise<Object>} Backend response matching VoiceAssistantChatResponse contract
 */
export async function sendVoiceAssistantChat({ message, history = [], language }, fetchImpl = window.fetch) {
  if (!message || !message.trim()) {
    throw new Error('Message cannot be empty or whitespace.');
  }

  const apiBase = getApiBase();
  const url = `${apiBase.replace(/\/$/, '')}/api/voice-assistant/chat`;

  // Format history payload into backend schema [{role: 'user'|'model', content: string}]
  const formattedHistory = Array.isArray(history)
    ? history
        .filter((turn) => turn && (turn.content || turn.text))
        .map((turn) => ({
          role: turn.role || (turn.sender === 'user' ? 'user' : 'model'),
          content: (turn.content || turn.text || '').trim(),
        }))
        .filter((turn) => turn.content.length > 0)
    : [];

  const payload = {
    message: message.trim(),
    history: formattedHistory.length > 0 ? formattedHistory : undefined,
    language: language && language !== 'auto' ? language : undefined,
  };

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errorDetail = 'Voice assistant service error';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    const error = new Error(errorDetail);
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  return result;
}

/**
 * Resolve BCP-47 speech recognition or TTS voice locale for a given language code.
 */
export function getVoiceLocale(langCode) {
  const norm = (langCode || 'en').toLowerCase().trim();
  return SUPPORTED_LANGUAGES_MAP[norm]?.locale || 'en-IN';
}

/**
 * ============================================================================
 * Canonical EPDS Questionnaire API Client & Validation (Phase 4)
 * ============================================================================
 */

/**
 * Fetch the canonical 10-item EPDS question bank from GET /api/questionnaire/epds.
 * Single source of truth: backend serving data/questions.json.
 */
export async function fetchEPDSQuestionnaire(fetchImpl = window.fetch) {
  const apiBase = getApiBase();
  const url = `${apiBase.replace(/\/$/, '')}/api/questionnaire/epds`;

  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    let errorDetail = 'Failed to fetch canonical EPDS questionnaire';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    const error = new Error(errorDetail);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  return data;
}

/**
 * Submit completed 10-item EPDS questionnaire responses to POST /api/questionnaire/epds/submit.
 *
 * @param {Array<{question_id: string, selected_index: number}>} answers - Exactly 10 items
 * @param {Function} [fetchImpl]
 * @returns {Promise<Object>} Backend EPDSSubmissionResponse with scoring and Q10 safety
 */
export async function submitEPDSQuestionnaire(answers, fetchImpl = window.fetch) {
  if (!Array.isArray(answers) || answers.length !== 10) {
    throw new Error('EPDS submission requires exactly 10 answered items.');
  }

  // Validate each item format
  const sanitizedAnswers = answers.map((ans, idx) => {
    const qId = ans?.question_id || `EPDS_Q${String(idx + 1).padStart(2, '0')}`;
    const sIdx = Number.isInteger(ans?.selected_index) ? ans.selected_index : parseInt(ans?.selected_index, 10);
    if (isNaN(sIdx) || sIdx < 0 || sIdx > 3) {
      throw new Error(`Invalid response index for question ${qId}: must be between 0 and 3.`);
    }
    return {
      question_id: qId,
      selected_index: sIdx,
    };
  });

  const apiBase = getApiBase();
  const url = `${apiBase.replace(/\/$/, '')}/api/questionnaire/epds/submit`;

  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetchImpl(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ answers: sanitizedAnswers }),
  });

  if (!response.ok) {
    let errorDetail = 'Failed to submit EPDS questionnaire';
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    }
    const error = new Error(errorDetail);
    error.status = response.status;
    throw error;
  }

  const result = await response.json();
  return result;
}

/**
 * Check if user input is requesting question repetition or clarification.
 * Supports all 8 maternal languages (English, Hindi, Kannada, Tamil, Telugu, Malayalam, Bengali, Marathi).
 */
export function isClarificationOrRepeatRequest(input) {
  if (!input || typeof input !== 'string') return false;
  const text = input.trim().toLowerCase();

  // English & Transliterated keywords
  const englishPatterns = [
    /\b(repeat|say\s+again|once\s+more|pardon|can\s+you\s+repeat|read\s+again)\b/i,
    /\b(clarify|clarification|explain|what\s+does\s+(this|that)\s+mean|what\s+do\s+you\s+mean)\b/i,
    /\b(help\s+me\s+understand|don't\s+understand|do\s+not\s+understand|confused|confusing)\b/i,
    /\b(translate|arth|samjhao|phir\s+se|dubara)\b/i,
  ];

  if (englishPatterns.some((p) => p.test(text))) {
    return true;
  }

  // Multilingual Indic script patterns across verified maternal languages
  const indicClarificationKeywords = [
    // Hindi (hi)
    'फिर से बताओ', 'दोबारा बताओ', 'फिर से कहो', 'दोबारा कहो', 'समझ नहीं आया', 'समझाओ', 'मतलब क्या है', 'फिर बोलो', 'समझाइए', 'दोबारा',
    // Kannada (kn)
    'ಮತ್ತೆ ಹೇಳಿ', 'ಇನ್ನೊಮ್ಮೆ ಹೇಳಿ', 'ಅರ್ಥವಾಗಲಿಲ್ಲ', 'ವಿವರಿಸಿ', 'ಮತ್ತೆ ಓದಿ', 'ತಿಳಿಸಿ', 'ಪುನಃ ಹೇಳಿ', 'ಅರ್ಥವಾಗಿಲ್ಲ',
    // Tamil (ta)
    'மீண்டும் சொல்லுங்கள்', 'மறுபடியும் சொல்லுங்க', 'புரியவில்லை', 'விளக்குங்கள்', 'மீண்டும்', 'மறுபடி', 'விளக்கம்',
    // Telugu (te)
    'మళ్ళీ చెప్పండి', 'మరోసారి చెప్పండి', 'అర్థం కాలేదు', 'వివరించండి', 'మళ్ళీ', 'స్పష్టపరచండి',
    // Malayalam (ml)
    'വീണ്ടും പറയൂ', 'ഒന്നുകൂടി പറയൂ', 'മനസ്സിലായില്ല', 'വിശദീകരിക്കൂ', 'വീണ്ടും', 'വ്യക്തമാക്കൂ',
    // Bengali (bn)
    'আবার বলুন', 'আরেকবার বলুন', 'বুঝতে পারছি না', 'বুঝিয়ে বলুন', 'আবার', 'পুনরায় বলুন',
    // Marathi (mr)
    'पुन्हा सांगा', 'परत सांगा', 'समजले नाही', 'समजावून सांगा', 'काय अर्थ आहे', 'पुन्हा', 'स्पष्ट करा',
  ];

  return indicClarificationKeywords.some((kw) => text.includes(kw.toLowerCase()));
}

/**
 * Match a raw user response (text or speech) against canonical 4 options (0-indexed).
 * Supports all 8 maternal languages, Indic script digits, and common localized expressions.
 * Returns matching index (0, 1, 2, or 3) or -1 if no valid match found.
 *
 * @param {string|number} input
 * @param {Array<{label: string, score: number}>} options
 * @returns {number} 0-3 index or -1
 */
export function matchOptionIndex(input, options = []) {
  if (input === null || input === undefined) return -1;

  // Direct integer check
  if (typeof input === 'number' && Number.isInteger(input)) {
    if (input >= 0 && input <= 3) return input;
    if (input >= 1 && input <= 4) return input - 1; // 1-based to 0-based
    return -1;
  }

  const raw = String(input).trim().toLowerCase();
  if (!raw) return -1;

  // 1. Direct Indic script digit match (Devanagari, Bengali, Kannada, Tamil, Telugu, Malayalam)
  if (/^[०0]$/.test(raw)) return 0;
  if (/^[१১೧௧౧൧1]$/.test(raw)) return 0;
  if (/^[२২೨௨౨൨2]$/.test(raw)) return 1;
  if (/^[३৩೩௩౩൩3]$/.test(raw)) return 2;
  if (/^[४৪೪௪౪൪4]$/.test(raw)) return 3;

  // 2. English ordinal / cardinal phrases
  if (/^(1|option\s*1|choice\s*1|first(\s+option)?|number\s*1)$/i.test(raw)) return 0;
  if (/^(2|option\s*2|choice\s*2|second(\s+option)?|number\s*2)$/i.test(raw)) return 1;
  if (/^(3|option\s*3|choice\s*3|third(\s+option)?|number\s*3)$/i.test(raw)) return 2;
  if (/^(4|option\s*4|choice\s*4|fourth(\s+option)?|number\s*4)$/i.test(raw)) return 3;

  // 3. Spoken localized ordinal & option names across the 8 maternal languages
  const localizedOptionNames = [
    // Index 0 (First option / 1)
    {
      index: 0,
      phrases: [
        // Hindi
        'पहला', 'पहला विकल्प', 'विकल्प एक', 'विकल्प 1', 'विकल्प १', 'एक', 'नंबर एक',
        // Kannada
        'ಮೊದಲನೆಯದು', 'ಮೊದಲು', 'ಆಯ್ಕೆ 1', 'ಆಯ್ಕೆ ೧', 'ಆಯ್ಕೆ ಒಂದು', 'ಒಂದು',
        // Tamil
        'முதல்', 'முதல் தேர்வு', 'தேர்வு 1', 'தேர்வு ௧', 'தேர்வு ஒன்று', 'ஒன்று',
        // Telugu
        'మొదటిది', 'మొదటి', 'ఎంపిక 1', 'ఎంపిక ౧', 'ఎంపిక ఒకటి', 'ఒకటి',
        // Malayalam
        'ഒന്നാമത്', 'ആദ്യത്തെ', 'ഓപ്ഷൻ 1', 'ഓപ്ഷൻ ൧', 'ഓപ്ഷൻ ഒന്ന്', 'ഒന്ന്',
        // Bengali
        'প্রথম', 'প্রথম বিকল্প', 'বিকল্প ১', 'বিকল্প এক', 'নম্বর এক', 'এক',
        // Marathi
        'पहिला', 'पहिले', 'पर्याय 1', 'पर्याय १', 'पर्याय एक', 'नंबर एक',
      ],
    },
    // Index 1 (Second option / 2)
    {
      index: 1,
      phrases: [
        // Hindi
        'दूसरा', 'दूसरा विकल्प', 'विकल्प दो', 'विकल्प 2', 'विकल्प २', 'दो', 'नंबर दो',
        // Kannada
        'ಎರಡನೆಯದು', 'ಎರಡನೇ', 'ಆಯ್ಕೆ 2', 'ಆಯ್ಕೆ ೨', 'ಆಯ್ಕೆ ಎರಡು', 'ಎರಡು',
        // Tamil
        'இரண்டாவது', 'இரண்டாம்', 'தேர்வு 2', 'தேர்வு ௨', 'தேர்வு இரண்டு', 'இரண்டு',
        // Telugu
        'రెండవది', 'రెండవ', 'ఎంపిక 2', 'ఎంపిక ౨', 'ఎంపిక రెండు', 'రెండు',
        // Malayalam
        'രണ്ടാമത്', 'രണ്ടാം', 'ഓപ്ഷൻ 2', 'ഓപ്ഷൻ ൨', 'ഓപ്ഷൻ രണ്ട്', 'രണ്ട്',
        // Bengali
        'দ্বিতীয়', 'দ্বিতীয় বিকল্প', 'বিকল্প ২', 'বিকল্প দুই', 'নম্বর দুই', 'দুই',
        // Marathi
        'दुसरा', 'दुसरे', 'पर्याय 2', 'पर्याय २', 'पर्याय दोन', 'नंबर दोन', 'दोन',
      ],
    },
    // Index 2 (Third option / 3)
    {
      index: 2,
      phrases: [
        // Hindi
        'तीसरा', 'तीसरा विकल्प', 'विकल्प तीन', 'विकल्प 3', 'विकल्प ३', 'तीन', 'नंबर तीन',
        // Kannada
        'ಮೂರನೆಯದು', 'ಮೂರನೇ', 'ಆಯ್ಕೆ 3', 'ಆಯ್ಕೆ ೩', 'ಆಯ್ಕೆ ಮೂರು', 'ಮೂರು',
        // Tamil
        'மூன்றாவது', 'மூன்றாம்', 'தேர்வு 3', 'தேர்வு ௩', 'தேர்வு மூன்று', 'மூன்று',
        // Telugu
        'మూడవది', 'మూడవ', 'ఎంపిక 3', 'ఎంపిక ౩', 'ఎంపిక మూడు', 'మూడు',
        // Malayalam
        'മൂന്നാമത്', 'മൂന്നാം', 'ഓപ്ഷൻ 3', 'ഓപ്ഷൻ ൩', 'ഓപ്ഷൻ മൂന്ന്', 'മൂന്ന്',
        // Bengali
        'তৃতীয়', 'তৃতীয় বিকল্প', 'বিকল্প ৩', 'বিকল্প তিন', 'নম্বর তিন', 'তিন',
        // Marathi
        'तिसरा', 'तिसरे', 'पर्याय 3', 'पर्याय ३', 'पर्याय तीन', 'नंबर तीन', 'तीन',
      ],
    },
    // Index 3 (Fourth option / 4)
    {
      index: 3,
      phrases: [
        // Hindi
        'चौथा', 'चौथा विकल्प', 'विकल्प चार', 'विकल्प 4', 'विकल्प ४', 'चार', 'नंबर चार',
        // Kannada
        'ನಾಲ್ಕನೆಯದು', 'ನಾಲ್ಕನೇ', 'ಆಯ್ಕೆ 4', 'ಆಯ್ಕೆ ೪', 'ಆಯ್ಕೆ ನಾಲ್ಕು', 'ನಾಲ್ಕು',
        // Tamil
        'நான்காவது', 'நான்காம்', 'தேர்வு 4', 'தேர்வு ௪', 'தேர்வு நான்கு', 'நான்கு',
        // Telugu
        'నాల్గవది', 'నాల్గవ', 'ఎంపిక 4', 'ఎంపిక ౪', 'ఎంపిక నాలుగు', 'నాలుగు',
        // Malayalam
        'നാലാമത്', 'നാലാം', 'ഓപ്ഷൻ 4', 'ഓപ്ഷൻ ൪', 'ഓപ്ഷൻ നാല്', 'നാല്',
        // Bengali
        'চতুর্থ', 'চতুর্থ বিকল্প', 'বিকল্প ৪', 'বিকল্প চার', 'নম্বর চার', 'চার',
        // Marathi
        'चौथा', 'चौथे', 'पर्याय 4', 'पर्याय ४', 'पर्याय चार', 'नंबर चार', 'चार',
      ],
    },
  ];

  const rawWords = raw.split(/\s+/).map((w) => w.trim()).filter(Boolean);
  for (const group of localizedOptionNames) {
    if (
      group.phrases.some((p) => {
        const lp = p.toLowerCase();
        return raw === lp || rawWords.includes(lp) || (lp.length >= 4 && raw.includes(lp));
      })
    ) {
      return group.index;
    }
  }

  if (!Array.isArray(options) || options.length !== 4) return -1;

  // 4. Exact or normalized English label match against canonical response options
  const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const cleanedInput = clean(raw);

  if (cleanedInput.length >= 3) {
    for (let i = 0; i < options.length; i++) {
      const label = clean(options[i]?.label);
      if (label && (cleanedInput === label || cleanedInput.includes(label) || label.includes(cleanedInput))) {
        return i;
      }
    }
  }

  // 5. Semantic phrases mapped to standard EPDS options (English + 7 regional languages)
  const semanticArchetypes = [
    // "Not at all" / "Never"
    {
      semantic: 'never',
      keywords: [
        'not at all', 'no not at all', 'never', 'no never', 'never at all', 'not ever',
        // Hindi
        'कभी नहीं', 'बिल्कुल नहीं', 'कभी भी नहीं',
        // Kannada
        'ಎಂದಿಗೂ ಇಲ್ಲ', 'ಖಂಡಿತ ಇಲ್ಲ', 'ಇಲ್ಲವೇ ಇಲ್ಲ', 'ಎಂದೂ ಇಲ್ಲ',
        // Tamil
        'எப்போதும் இல்லை', 'இல்லவே இல்லை', 'ஒருபோதும் இல்லை',
        // Telugu
        'ఎప్పుడూ లేదు', 'అస్సలు లేదు', 'ఎన్నడూ లేదు',
        // Malayalam
        'ഒരിക്കലുമില്ല', 'ഇല്ലവേ ഇല്ല', 'ഒരിക്കലും ഇല്ല',
        // Bengali
        'কখনোই না', 'একদম না', 'কখনও না',
        // Marathi
        'कधीच नाही', 'मुळीच नाही', 'कधीही नाही',
      ],
    },
    // "Yes, quite often" / "Most of the time" / "Always"
    {
      semantic: 'frequent',
      keywords: [
        'yes quite often', 'quite often', 'yes most of the time', 'most of the time', 'yes all the time', 'always',
        // Hindi
        'हाँ अक्सर', 'अक्सर', 'ज्यादातर', 'हमेशा', 'बहुत बार',
        // Kannada
        'ಹೌದು ಹೆಚ್ಚಾಗಿ', 'ಹೆಚ್ಚಾಗಿ', 'ಹೆಚ್ಚಿನ ಸಮಯ', 'ಯಾವಾಗಲೂ',
        // Tamil
        'ஆம் அடிக்கடி', 'அடிக்கடி', 'பெரும்பாலும்', 'எப்பொழுதும்',
        // Telugu
        'అవును తరచుగా', 'తరచుగా', 'చాలా సమయం', 'ఎల్లప్పుడూ',
        // Malayalam
        'അതെ മിക്കപ്പോഴും', 'മിക്കപ്പോഴും', 'പലപ്പോഴും', 'എപ്പോഴും',
        // Bengali
        'হ্যাঁ প্রায়ই', 'প্রায়ই', 'বেশিরভাগ সময়', 'সবসময়',
        // Marathi
        'हो नेहमी', 'नेहमी', 'बहुतेक वेळा', 'फार वेळा',
      ],
    },
    // "Sometimes" / "Some of the time"
    {
      semantic: 'sometimes',
      keywords: [
        'sometimes', 'yes some of the time', 'some of the time',
        // Hindi
        'कभी कभी', 'कभी-कभी', 'कुछ समय',
        // Kannada
        'ಕೆಲವೊಮ್ಮೆ', 'ಕೆಲವು ವೇಳೆ',
        // Tamil
        'சில நேரங்களில்', 'எப்போதாவது',
        // Telugu
        'కొన్నిసార్లు', 'అప్పుడప్పుడు',
        // Malayalam
        'ചിലപ്പോൾ', 'ഇടയ്ക്കിടെ',
        // Bengali
        'কখনও কখনও', 'মাঝে মাঝে',
        // Marathi
        'कधीकधी', 'कधी कधी', 'काही वेळा',
      ],
    },
    // "Hardly ever" / "Only occasionally"
    {
      semantic: 'hardly',
      keywords: [
        'hardly ever', 'hardly at all', 'only occasionally', 'not very often', 'rather less',
        // Hindi
        'शायद ही कभी', 'बहुत कम',
        // Kannada
        'ಅಪರೂಪವಾಗಿ', 'ತುಂಬಾ ಕಡಿಮೆ',
        // Tamil
        'அரிதாக', 'மிகக் குறைவாக',
        // Telugu
        'అరుదుగా', 'చాలా తక్కువ',
        // Malayalam
        'വളരെ വിരളമായി', 'വളരെ കുറവ്',
        // Bengali
        'কদাচিৎ', 'খুব কম',
        // Marathi
        'क्वचितच', 'फार क्वचित',
      ],
    },
    // "As much as always" / "Enough" / "Laughing enough" / "As much as ever" (Q1/Q2 positive)
    {
      semantic: 'as_much_as_always',
      keywords: [
        'laughing enough', 'laughing as usual', 'laughing fine', 'laughing a lot',
        'able to laugh', 'can laugh', 'laugh a lot', 'laughing well', 'as much as i always could',
        'as much as always', 'as much as ever', 'as much as usual', 'as always', 'as usual',
        'plenty', 'very well', 'well enough', 'doing fine', 'looking forward with enjoyment',
        'looking forward', 'enjoying things', 'enjoying', 'i can laugh', 'yes i have',
        'हंस पाती हूँ', 'भरपूर', 'हमेशा की तरह',
      ],
    },
    // "Not quite so much" / "A bit less" (Q1/Q2 slightly reduced)
    {
      semantic: 'less_now',
      keywords: [
        'not quite so much', 'not quite as much', 'rather less', 'a bit less', 'a little less',
        'slightly less', 'somewhat less', 'less now', 'less lately', 'less than i used to', 'not so much now',
        'कम', 'थोड़ा कम',
      ],
    },
    // "Definitely not so much" / "Much less" (Q1/Q2 moderately-to-severely reduced)
    {
      semantic: 'definitely_less',
      keywords: [
        'definitely not so much', 'definitely less', 'much less', 'far less', 'a lot less', 'very little now',
        'definitely not', 'काफी कम',
      ],
    },
    // "Coping as well as ever" / "Managing fine" (Q6 positive)
    {
      semantic: 'coping_well',
      keywords: [
        'coping as well as ever', 'coping well', 'coping fine', 'handling fine', 'handling it well',
        'managing fine', 'no problem coping', 'doing fine', 'as well as ever',
      ],
    },
    // "Sleeping fine" / "No difficulty sleeping" (Q7 healthy)
    {
      semantic: 'sleeping_well',
      keywords: [
        'sleeping fine', 'sleeping well', 'no trouble sleeping', 'no difficulty sleeping', 'sleep good', 'sleep well', 'sleep fine',
      ],
    },
    // "Not sad" / "Feeling happy" / "Fine" (Q8 healthy)
    {
      semantic: 'not_sad',
      keywords: [
        'not sad', 'feeling happy', 'not miserable', 'happy', 'feeling good',
      ],
    },
    // "Not crying" / "Haven't cried" (Q9 healthy)
    {
      semantic: 'not_crying',
      keywords: [
        'not crying', 'no crying', "haven't cried", 'no tears', "haven't been crying",
      ],
    },
  ];

  for (const item of semanticArchetypes) {
    const matchedKeyword = item.keywords.some((kw) => {
      const lowerKw = kw.toLowerCase();
      return raw.includes(lowerKw) || cleanedInput.includes(lowerKw);
    });

    if (matchedKeyword) {
      // Find the option label that semantically corresponds
      for (let i = 0; i < options.length; i++) {
        const targetLabel = clean(options[i]?.label);
        if (item.semantic === 'never' && (targetLabel.includes('never') || targetLabel.includes('not at all'))) {
          return i;
        }
        if (item.semantic === 'frequent' && (targetLabel.includes('often') || targetLabel.includes('most') || targetLabel.includes('always'))) {
          return i;
        }
        if (item.semantic === 'sometimes' && (targetLabel.includes('sometimes') || targetLabel.includes('some of the time'))) {
          return i;
        }
        if (item.semantic === 'hardly' && (targetLabel.includes('hardly') || targetLabel.includes('not very often') || targetLabel.includes('less than'))) {
          return i;
        }
        if (item.semantic === 'as_much_as_always' && (targetLabel.includes('as much as') || targetLabel.includes('always could') || targetLabel.includes('ever did'))) {
          return i;
        }
        if (item.semantic === 'less_now' && (targetLabel.includes('not quite') || targetLabel.includes('rather less') || targetLabel.includes('less than'))) {
          return i;
        }
        if (item.semantic === 'definitely_less' && targetLabel.includes('definitely')) {
          return i;
        }
        if (item.semantic === 'coping_well' && (targetLabel.includes('coping as well') || targetLabel.includes('well as ever'))) {
          return i;
        }
        if (item.semantic === 'sleeping_well' && (targetLabel.includes('not at all') || targetLabel.startsWith('no'))) {
          return i;
        }
        if (item.semantic === 'not_sad' && (targetLabel.includes('not at all') || targetLabel.startsWith('no'))) {
          return i;
        }
        if (item.semantic === 'not_crying' && (targetLabel.includes('not at all') || targetLabel.startsWith('no'))) {
          return i;
        }
      }
    }
  }

  // 6. Natural standalone "no" / negative response
  if (/^(no|nope|nah|not really|not at all)$/i.test(cleanedInput)) {
    // For positive questions Q1/Q2 ("as much as I could"), "no" indicates Option 3 ("Not at all" / "Hardly at all")
    if (options.some((o) => clean(o.label).includes('as much as'))) {
      return 3;
    }
    // For distressed questions, "no" indicates the healthy zero/none option
    for (let i = 0; i < options.length; i++) {
      const lbl = clean(options[i]?.label);
      if (lbl.startsWith('no') || lbl === 'never') {
        return i;
      }
    }
  }

  // 7. Natural standalone "yes" / affirmative response
  if (/^(yes|yeah|yep|definitely|sure|yes i have|i have)$/i.test(cleanedInput)) {
    // For positive questions Q1/Q2, "yes" indicates Option 0 ("As much as I always could")
    for (let i = 0; i < options.length; i++) {
      const lbl = clean(options[i]?.label);
      if (lbl.includes('as much as') || lbl.includes('always could') || lbl.includes('ever did')) {
        return i;
      }
    }
  }

  return -1;
}

