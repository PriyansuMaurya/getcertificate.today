import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-4 py-16 text-ink">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <Link href="/">
          <Image
            src="/figma/logo.png"
            alt="getcertificate.today logo"
            width={180}
            height={40}
            priority
            className="h-10 w-auto"
          />
        </Link>
        <h1 className="font-fraunces text-4xl font-bold text-ink sm:text-5xl">404</h1>
        <h2 className="font-fraunces text-2xl font-bold text-ink">Page Not Found</h2>
        <p className="text-base text-clay">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="flex h-12 items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
