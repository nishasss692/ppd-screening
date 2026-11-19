"""Three-Modality Late Fusion Pipeline for AANCHAL Postpartum Depression Screening.

Combines probabilistic screening outputs from:
1. Text Modality (Maternal narrative self-reports via TF-IDF + Logistic Regression)
2. Audio Modality (Speech acoustic biomarker features via pooled statistics)
3. Video Modality (Facial dynamics, Action Units & Head Pose via pooled statistics)

Clinical numerical features and EPDS questionnaire responses are strictly excluded.
"""
