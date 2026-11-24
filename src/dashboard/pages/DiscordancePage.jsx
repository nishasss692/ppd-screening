import React from 'react';
import { ResultsPage } from './ResultsPage.jsx';

/**
 * Discordance Analysis is now integrated into Maternal Screening Results (ResultsPage).
 * Rendering ResultsPage here preserves backward compatibility for existing route imports.
 */
export function DiscordancePage() {
  return <ResultsPage />;
}

export default DiscordancePage;
