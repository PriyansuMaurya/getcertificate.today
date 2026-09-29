'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error cleanly if needed
    console.error(error);
  }, [error]);

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
        <h1 className="font-fraunces text-3xl font-bold text-ink sm:text-4xl">
          Something went wrong
        </h1>
        <p className="text-base text-clay">An unexpected error occurred while loading this page.</p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => reset()}
            className="flex h-12 items-center justify-center rounded-lg bg-ink px-6 py-3.5 text-[15px] font-bold text-cream transition-colors hover:bg-ink/90"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="flex h-12 items-center justify-center rounded-lg border-[1.5px] border-ink px-6 py-3.5 text-[15px] font-bold text-ink transition-colors hover:bg-black/5"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
