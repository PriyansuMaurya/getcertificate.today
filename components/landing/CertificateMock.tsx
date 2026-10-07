import Image from 'next/image';

/**
 * The certificate, as it is drawn in the Figma file, shipped as the exported
 * bitmap rather than rebuilt as live markup. It is a document mock, so it is
 * exposed to assistive tech as one image with one describing label - the
 * individual lines of type carry no useful structure.
 *
 * The frame is 3:2 - the proportion the printable certificate uses - and the
 * root is a query container (see `.query-container` in globals.css), so the
 * image fills whichever width it is handed, with no size prop and no
 * breakpoints. The hero's centre card is `HeroCertificate`, a separate component.
 */
export default function CertificateMock() {
  return (
    <div className="query-container relative aspect-[3/2] w-full select-none overflow-hidden rounded-[1.4cqw] border border-[#E4DACA] bg-[#FBF7F1] shadow-[0_22px_48px_-18px_rgba(26,26,26,0.32)]">
      <Image
        src="/figma/certificate-hero-sm.jpg"
        alt="Example getcertificate.today certificate of completion"
        fill
        sizes="(max-width: 768px) 84vw, 34vw"
        className="object-cover"
      />
    </div>
  );
}
