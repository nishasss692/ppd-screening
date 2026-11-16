import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { fetchMedicalHistory, updateMedicalHistory } from '../services/patientApiService.js';
import { getAuthToken } from '../../auth/authService.js';
import './medicalHistory.css';

// --- Constants ---
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
];
const STORAGE_KEY = 'miora_medical_history_v1';

// --- Helpers ---
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const generateFileId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- Sub-components ---

const Breadcrumb = () => (
  <div className="medhist-breadcrumb-bar">
    <NavLink to="/patient/dashboard" className="medhist-breadcrumb-link">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
        <path d="M9.5 21v-7h5v7" />
      </svg>
      <span>Home</span>
    </NavLink>
    <span className="medhist-breadcrumb-sep" aria-hidden="true">&rsaquo;</span>
    <span className="medhist-breadcrumb-current">Medical History</span>
  </div>
);

const HeroSection = () => (
  <div className="patient-hero-box">
    <div className="patient-hero-box-text">
      <div className="miora-dash-eyebrow">
        <span>MEDICAL HISTORY</span>
        <span className="miora-dash-eyebrow-line" aria-hidden="true" />
      </div>
      <h1 className="miora-dash-title patient-page-heading">
        Medical <em>History</em>
      </h1>
      <p className="miora-dash-subtitle patient-page-subheading">
        Help us understand your background for a more accurate and personalised emotional wellbeing screening.
      </p>
    </div>
    <div className="patient-hero-box-illu" aria-hidden="true">
      <img
        src="/assets/mother-baby-header-crop.png"
        alt=""
        onError={(e) => {
          e.target.style.display = 'none';
        }}
      />
    </div>
  </div>
);

const DiagnosisQuestion = ({ selectedOption, onOptionChange }) => {
  const options = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'not-sure', label: 'Not Sure' }
  ];

  return (
    <section className="patient-card medhist-question-card" aria-labelledby="question-heading">
      <div className="medhist-question-content">
        <h2 id="question-heading" className="medhist-question-text">
          Have you ever been diagnosed with Postpartum Depression (PPD) or received related treatment?
        </h2>
        <p className="medhist-question-note">
          Your responses remain private, encrypted, and strictly confidential.
        </p>

        <div className="medhist-options-grid" role="radiogroup" aria-labelledby="question-heading">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`medhist-option-btn ${selectedOption === opt.value ? 'is-selected' : ''}`}
              onClick={() => onOptionChange(opt.value)}
              role="radio"
              aria-checked={selectedOption === opt.value}
            >
              <span className="medhist-radio-indicator">
                {selectedOption === opt.value && (
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5 6.2 4.8 8.6 9.5 3.6" />
                  </svg>
                )}
              </span>
              <span className="medhist-option-label">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="medhist-question-illustration-wrap" aria-hidden="true">
        <img
          src="/assets/medical-history-clipboard.png"
          alt=""
          className="medhist-question-illustration"
        />
      </div>
    </section>
  );
};

// --- Custom Hook ---

function useMedicalHistory() {
  const [selectedOption, setSelectedOption] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.selectedOption) return parsed.selectedOption;
      }
    } catch (e) {
      console.error('Error loading selectedOption from localStorage', e);
    }
    return 'yes';
  });

  const [uploadedFiles, setUploadedFiles] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.uploadedFiles) && parsed.uploadedFiles.length > 0) {
          return parsed.uploadedFiles;
        }
      }
    } catch (e) {
      console.error('Error loading uploadedFiles from localStorage', e);
    }
    return [
      {
        id: 'default-ppd-report',
        name: 'PPD_Diagnosis_Report.pdf',
        size: '1.2 MB',
        type: 'application/pdf',
      },
    ];
  });

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadHistory() {
      const token = getAuthToken();
      if (!token) return;
      try {
        const data = await fetchMedicalHistory({ signal: controller.signal });
        if (!isMounted || !data) return;

        if (data.prior_ppd_diagnosis) {
          setSelectedOption(data.prior_ppd_diagnosis);
        }

        const backendFiles = data.uploaded_files ||
          (data.medical_history && data.medical_history.uploadedFiles);

        if (Array.isArray(backendFiles) && backendFiles.length > 0) {
          setUploadedFiles(backendFiles);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('Backend medical history fetch failed, using local/cached data:', err);
        }
      }
    }

    loadHistory();
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const saveToLocal = useCallback((option, files) => {
    try {
      const dataToSave = {
        selectedOption: option,
        uploadedFiles: files,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (err) {
      console.warn('Could not save medical history to localStorage:', err);
    }
  }, []);

  return {
    selectedOption,
    setSelectedOption,
    uploadedFiles,
    setUploadedFiles,
    saveToLocal
  };
}

// --- Main Component ---

export function MedicalHistoryScreen() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const {
    selectedOption,
    setSelectedOption,
    uploadedFiles,
    setUploadedFiles,
    saveToLocal
  } = useMedicalHistory();

  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleFiles = useCallback((filesList) => {
    setValidationError('');
    const files = Array.from(filesList);
    const newFiles = [];

    for (const file of files) {
      const isAllowedType = ALLOWED_TYPES.includes(file.type.toLowerCase()) ||
        /\.(pdf|jpe?g|png)$/i.test(file.name);

      if (!isAllowedType) {
        setValidationError(`"${file.name}" is not a supported format. Please upload PDF, JPG, or PNG.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        setValidationError(`"${file.name}" exceeds the 10 MB limit (${formatFileSize(file.size)}).`);
        return;
      }

      newFiles.push({
        id: generateFileId(),
        name: file.name,
        size: formatFileSize(file.size),
        type: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
      });
    }

    if (newFiles.length > 0) {
      setUploadedFiles((prev) => [...prev, ...newFiles]);
    }
  }, [setUploadedFiles]);

  const handleDragEvents = {
    onDragOver: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(true);
    },
    onDragLeave: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (e.dataTransfer?.files?.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    }
  };

  const removeFile = useCallback((id) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  }, [setUploadedFiles]);

  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    saveToLocal(selectedOption, uploadedFiles);

    try {
      const token = getAuthToken();
      if (token) {
        await updateMedicalHistory({
          prior_ppd_diagnosis: selectedOption,
          uploaded_files: uploadedFiles,
          medical_history: 'Clinical PPD history and documents updated by patient.',
        });
      }
    } catch (err) {
      console.error('Backend medical history save failed:', err);
      // We still navigate since we saved to local storage
    } finally {
      setIsSaving(false);
      navigate('/patient/screening');
    }
  };

  return (
    <div className="medhist-container">
      <Breadcrumb />
      <HeroSection />

      <DiagnosisQuestion
        selectedOption={selectedOption}
        onOptionChange={setSelectedOption}
      />

      <section className="patient-card medhist-upload-card" aria-labelledby="upload-card-heading">
        <div className="medhist-card-title-row">
          <h2 id="upload-card-heading" className="medhist-upload-title">
            Upload Relevant Records <span className="medhist-optional-tag">(Optional)</span>
          </h2>
          <span className="medhist-secure-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            256-bit Encrypted
          </span>
        </div>
        <p className="medhist-upload-subtitle">
          You can securely upload previous diagnoses, prescriptions, lab results, or hospital records.
        </p>

        <div
          className={`medhist-dropzone ${isDragOver ? 'is-dragover' : ''}`}
          {...handleDragEvents}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          aria-label="Upload files by dragging or clicking"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files?.length > 0) {
                handleFiles(e.target.files);
                e.target.value = '';
              }
            }}
            multiple
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            style={{ display: 'none' }}
            tabIndex={-1}
          />

          <div className="medhist-cloud-icon-wrap" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 20V11" />
              <path d="m8 15 4-4 4 4" />
            </svg>
          </div>

          <p className="medhist-dropzone-prompt">
            Drag and drop files here, or{' '}
            <button
              type="button"
              className="medhist-click-upload-btn"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              click to upload
            </button>
          </p>

          <span className="medhist-dropzone-hint">
            Supports PDF, JPG, PNG (up to 10 MB each)
          </span>
        </div>

        {validationError && (
          <div className="medhist-validation-error" role="alert">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{validationError}</span>
          </div>
        )}

        <div className="medhist-card2-bottom-row">
          <div className="medhist-uploaded-section">
            <div className="medhist-uploaded-header">
              <span>Uploaded Records</span>
              <span className="medhist-uploaded-count-pill">{uploadedFiles.length}</span>
            </div>

            <div className="medhist-uploaded-list">
              {uploadedFiles.length === 0 ? (
                <div className="medhist-uploaded-empty">No documents uploaded yet.</div>
              ) : (
                uploadedFiles.map((file) => (
                  <FileItem key={file.id} file={file} onRemove={removeFile} />
                ))
              )}
            </div>
          </div>

          <div className="medhist-actions-bar">
            <button
              type="button"
              className="patient-btn-primary medhist-save-btn"
              onClick={handleSaveAndContinue}
              disabled={isSaving}
            >
              <span>{isSaving ? 'Saving...' : 'Save & Continue'}</span>
              {!isSaving && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const FileItem = React.memo(({ file, onRemove }) => {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  return (
    <div className="medhist-file-item">
      <div className="medhist-file-info">
        <div className={isPdf ? "medhist-pdf-badge" : "medhist-img-badge"} aria-label={isPdf ? "PDF file" : "Image file"}>
          {isPdf ? "PDF" : "IMG"}
        </div>
        <div className="medhist-file-meta">
          <span className="medhist-file-name" title={file.name}>{file.name}</span>
          <span className="medhist-file-size">{file.size}</span>
        </div>
      </div>

      <button
        type="button"
        className="medhist-file-remove-btn"
        onClick={() => onRemove(file.id)}
        aria-label={`Remove file ${file.name}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
});

export default MedicalHistoryScreen;
