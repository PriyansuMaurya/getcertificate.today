'use client';

import { Printer } from 'lucide-react';

/**
 * Browser print → PDF is the MVP export path (PRD FR-E3 AC2). The `print:`
 * variants on the certificate page plus the `[data-print-hide]` rule in
 * globals.css strip nav/chrome and keep the QR vector-sharp.
 */
export default function PrintCertificateButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="hidden h-10 items-center gap-2 rounded-lg border border-ink px-4 text-sm font-bold text-ink transition-colors hover:bg-ink hover:text-cream sm:inline-flex print:hidden"
    >
      <Printer aria-hidden="true" className="h-4 w-4" />
      Print / Save PDF
    </button>
  );
}
