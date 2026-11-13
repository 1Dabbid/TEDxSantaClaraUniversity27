'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Error boundary for every page under the root layout: the header and footer
 * stay, the page body is replaced with this clause and a way to recover.
 * `retry()` re-fetches and re-renders the failed segment.
 */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section aria-labelledby="error-title" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-black/85" />
      <div className="shell flex min-h-[calc(100svh-var(--header-h))] flex-col justify-center gap-8 py-16 sm:py-24">
        <p className="fine-print text-mute">Error · Clause unreadable</p>
        <h1 id="error-title" className="max-w-[14ch] text-headline font-semibold tracking-[-0.045em] text-balance">
          Something went wrong.
        </h1>
        <p className="max-w-lg text-lg text-mute">
          This part of the page could not be shown. Try again; if it keeps happening, come back in a moment.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="btn inline-flex min-h-14 items-center justify-center rounded-full bg-accent px-8 py-3 text-base font-medium tracking-tight text-white transition-colors duration-300 hover:bg-white hover:text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Try again
          </button>
          <Button href="/" variant="ghost" size="lg">
            Back to the event
          </Button>
        </div>
      </div>
    </section>
  );
}
