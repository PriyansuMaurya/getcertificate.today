import Image from 'next/image';

/**
 * The hero's Certificate of Achievement.
 *
 * The document is the Figma export rather than live markup: a certificate is a
 * fixed print artifact, so the approved artwork ships as a bitmap and stays
 * pixel-identical at every width instead of being re-set in type.
 *
 * Geometry: a 3:2 document, the proportion the exported artwork uses.
 *
 * Sizing: the root is a query container (see `.query-container` in
 * globals.css), so the card's own `cqw` measurements resolve against its width
 * rather than falling back to the viewport.
 *
 * The hint of movement on the pointer is applied by the stage, on a wrapper
 * around this card (see `.cert-lift` in globals.css), so the card itself stays a
 * plain document that does not move on its own.
 */

/** 3:2, the proportion the exported certificate uses. Applied as a style rather
 *  than a class so the ratio lives with the artwork it describes. */
const HERO_CERT_ASPECT = 3 / 2;

export default function HeroCertificate() {
  return (
    <div
      style={{ aspectRatio: HERO_CERT_ASPECT }}
      className="query-container relative w-full select-none overflow-hidden rounded-[0.8cqw] border border-sandline bg-[#FBF7F0] shadow-[0_34px_64px_-30px_rgba(24,18,12,0.7)]"
    >
      <Image
        src="/figma/certificate-hero-sm.jpg"
        alt="Example getcertificate.today certificate of achievement"
        fill
        priority
        sizes="(max-width: 640px) 66vw, (max-width: 1024px) 63vw, 50vw"
        className="object-cover"
      />
    </div>
  );
}
