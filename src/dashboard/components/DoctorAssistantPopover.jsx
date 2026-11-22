import React, { useState, useRef, useEffect } from 'react';
import { DashboardIcon } from './DashboardIcon.jsx';
import { sendDoctorAssistantChat, screenDoctorAssistantPrompt } from '../services/doctorAssistantService.js';

const INITIAL_DOCTOR_MESSAGES = [
  {
    id: 'doc-msg-init',
    sender: 'assistant',
    text: (
      "Hello Doctor. I am your AANCHAL Clinical Copilot.\n\n" +
      "I can assist with clinical workspace navigation, multimodal feature workflows (e.g. cross-modal discordance), " +
      "and EPDS clinical scoring threshold references.\n\n" +
      "How may I help your workflow today?"
    ),
    timestamp: 'Just now',
    source: 'system',
  },
];

const PRESET_QUERIES = [
  'How does cross-modal discordance work?',
  'Explain EPDS cutoffs and Item 10 rule',
  'How do I complete and sign off a clinical review?',
  'Where are priority cases displayed in the dashboard?',
];

export function DoctorAssistantPopover({ onClose }) {
  const [messages, setMessages] = useState(INITIAL_DOCTOR_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (queryToSend) => {
    const text = (queryToSend || inputText).trim();
    if (!text || isLoading) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userTurn = {
      id: `doc-turn-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: now,
    };

    setMessages((prev) => [...prev, userTurn]);
    setInputText('');

    // Pre-screen for diagnostic and PHI boundaries
    const screenCheck = screenDoctorAssistantPrompt(text);
    if (!screenCheck.allowed) {
      const boundaryTurn = {
        id: `doc-turn-${Date.now() + 1}`,
        sender: 'assistant',
        text: screenCheck.reason,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'safety_filter',
        status: 'refusal',
      };
      setMessages((prev) => [...prev, boundaryTurn]);
      return;
    }

    setIsLoading(true);

    const historyPayload = messages.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      content: m.text,
    }));

    try {
      const response = await sendDoctorAssistantChat({
        message: text,
        history: historyPayload,
      });

      const assistantTurn = {
        id: `doc-turn-${Date.now() + 1}`,
        sender: 'assistant',
        text: response.text || response.message,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: response.source || 'gemini',
        status: response.status,
        model: response.model,
      };

      setMessages((prev) => [...prev, assistantTurn]);
    } catch (err) {
      const errTurn = {
        id: `doc-turn-err-${Date.now() + 1}`,
        sender: 'assistant',
        text: 'Unable to connect to the assistant service. Please check your network connection.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: 'error',
      };
      setMessages((prev) => [...prev, errTurn]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="dash-popover dash-assistant-popover"
      role="dialog"
      aria-label="Clinician AI Assistant"
      data-testid="doctor-assistant-popover"
    >
      {/* Header */}
      <div className="dash-assistant-header">
        <div className="dash-assistant-header-left">
          <div className="dash-assistant-avatar" aria-hidden="true">
            <DashboardIcon name="sparkle" size={15} strokeWidth={2.2} />
          </div>
          <div>
            <div className="dash-assistant-title-row">
              <strong className="dash-assistant-title">Miora Clinical Copilot</strong>
              <span className="dash-assistant-tag">Non-Diagnostic</span>
            </div>
            <span className="dash-assistant-sub">Dashboard &amp; Workflow Navigation</span>
          </div>
        </div>
        <button
          type="button"
          className="dash-assistant-close-btn"
          onClick={onClose}
          aria-label="Close assistant"
        >
          &times;
        </button>
      </div>

      {/* Non-Diagnostic Clinical & Privacy Disclaimer */}
      <div className="dash-assistant-disclaimer" role="note">
        <DashboardIcon name="info" size={13} strokeWidth={2} />
        <span>
          Strictly non-diagnostic workflow assistance. Does not diagnose patients, prescribe treatments,
          or process patient identifiable records (PHI).
        </span>
      </div>

      {/* Messages Stream */}
      <div className="dash-assistant-messages" role="log" aria-live="polite">
        {messages.map((m) => {
          const isAssistant = m.sender === 'assistant';
          return (
            <div
              key={m.id}
              className={`dash-assistant-msg-row ${isAssistant ? 'is-assistant' : 'is-user'}`}
            >
              <div
                className={`dash-assistant-msg-bubble ${
                  m.status === 'refusal' ? 'is-refusal' : ''
                }`}
              >
                {m.text.split('\n\n').map((para, i) => (
                  <p key={i} style={{ margin: i === 0 ? 0 : '6px 0 0 0' }}>
                    {para}
                  </p>
                ))}
              </div>
              <div className="dash-assistant-msg-meta">
                <time>{m.timestamp}</time>
                {isAssistant && m.source === 'safety_filter' && (
                  <span className="dash-assistant-tag is-safety">Boundary Filter</span>
                )}
                {isAssistant && m.source === 'gemini' && (
                  <span className="dash-assistant-tag is-gemini">
                    {m.model || 'Gemini'}
                  </span>
                )}
                {isAssistant && m.source === 'fallback' && (
                  <span className="dash-assistant-tag is-fallback">Clinical Guide</span>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="dash-assistant-msg-row is-assistant">
            <div className="dash-assistant-typing">
              <span className="dash-typing-dot" />
              <span className="dash-typing-dot" />
              <span className="dash-typing-dot" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset Suggestions */}
      <div className="dash-assistant-presets" aria-label="Suggested workflow questions">
        {PRESET_QUERIES.map((query, i) => (
          <button
            key={i}
            type="button"
            className="dash-assistant-preset-chip"
            onClick={() => handleSend(query)}
          >
            {query}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        className="dash-assistant-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask about dashboard navigation or EPDS..."
          aria-label="Message AANCHAL Clinician Copilot"
        />
        <button
          type="submit"
          className="dash-assistant-send-btn"
          disabled={!inputText.trim() || isLoading}
          aria-label="Send query"
        >
          <DashboardIcon name="arrowRight" size={14} strokeWidth={2.4} />
        </button>
      </form>
    </div>
  );
}

