import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PatientIcon } from '../components/PatientIcons.jsx';
import './patientHome.css';

export function PatientHomePage() {
  const navigate = useNavigate();

  const handleBeginJourney = () => {
    navigate('/patient/screening');
  };

  return (
    <div className="aanchal-home-root" aria-label="AANCHAL Maternal Wellbeing Homepage">
      {/* ====================================================================
          Section 1 – Hero
          Left: Minimal editorial typography: headline, description, CTA button
          Right: Original static 2D mother-and-baby sculpture
          ==================================================================== */}
      <section className="aanchal-hero-section" aria-labelledby="hero-heading">
        <div className="aanchal-hero-grid">
          {/* Left Column: Minimal Typography & Primary Action */}
          <div className="aanchal-hero-copy">
            {/* Prominent Official AANCHAL Logo in Top-Left Hero Corner */}
            <div className="aanchal-hero-brand-logo">
              <picture>
                <source srcSet="/assets/aanchal-brand-logo.webp" type="image/webp" />
                <img
                  src="/assets/aanchal-brand-logo.png"
                  alt="AANCHAL — Caring for the One Who Cares for All"
                  className="aanchal-hero-logo-img"
                  loading="eager"
                  decoding="async"
                />
              </picture>
            </div>

            <h1 id="hero-heading" className="aanchal-hero-headline">
              Beyond motherhood,<br />
              <em>there is you.</em>
            </h1>

            <p className="aanchal-hero-description">
              A gentle space to understand your emotional wellbeing, find support and reconnect with yourself.
            </p>

            <div className="aanchal-hero-action">
              <button
                type="button"
                className="aanchal-primary-btn"
                onClick={handleBeginJourney}
              >
                <span>Begin Your Journey</span>
                <PatientIcon name="arrow-right" size={16} />
              </button>

              <button
                type="button"
                className="aanchal-secondary-btn"
                onClick={() => navigate('/patient/ai-assistant')}
                aria-label="Talk to AANCHAL Assistant"
              >
                <PatientIcon name="ai-assistant" size={18} />
                <span>Talk to AANCHAL Assistant</span>
              </button>
            </div>
          </div>

          {/* Right Column: Original Static 2D Mother & Baby Sculpture */}
          <div
            className="aanchal-hero-visual"
            aria-label="AANCHAL Mother & Baby Sculpture"
            role="region"
          >
            <picture>
              <source srcSet="/assets/mother-baby-sculpture-hero.webp" type="image/webp" />
              <img
                src="/assets/mother-baby-sculpture-hero.png"
                alt="AANCHAL Mother and Baby Sculpture"
                className="aanchal-hero-sculpture"
                loading="eager"
                decoding="async"
              />
            </picture>
          </div>
        </div>
      </section>

      {/* ====================================================================
          Section 2 – A Gentle Message
          Spacious, centered editorial statement with no cards or grids
          ==================================================================== */}
      <section className="aanchal-message-section" aria-labelledby="message-heading">
        <div className="aanchal-message-inner">
          <h2 id="message-heading" className="aanchal-message-headline">
            Motherhood is a journey. You deserve care along the way.
          </h2>
          <p className="aanchal-message-sentence">
            Take a quiet moment to breathe, reflect, and receive the gentle care you give to others every day.
          </p>
        </div>
      </section>

      {/* ====================================================================
          Section 3 – Final Call to Action
          Minimal closing CTA leading back to gentle screening
          ==================================================================== */}
      <section className="aanchal-cta-section" aria-labelledby="cta-heading">
        <div className="aanchal-cta-inner">
          <h2 id="cta-heading" className="aanchal-cta-headline">
            You are more than a mother.
          </h2>
          <p className="aanchal-cta-line">
            Your feelings matter. Your wellbeing matters.
          </p>
          <div className="aanchal-cta-action">
            <button
              type="button"
              className="aanchal-primary-btn"
              onClick={handleBeginJourney}
            >
              <span>Begin Your Journey</span>
              <PatientIcon name="arrow-right" size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default PatientHomePage;
