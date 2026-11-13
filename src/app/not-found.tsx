import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <section aria-labelledby="nf-title" className="relative isolate">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 scrim-left" />
      <div className="shell flex min-h-[70svh] flex-col justify-center py-24">
        <p className="fine-print">Error 404 · Clause not found</p>
        <h1 id="nf-title" className="mt-6 text-headline font-semibold tracking-[-0.045em]">
          This page is not in the fine print.
        </h1>
        <p className="mt-6 max-w-lg text-lg text-mute">The link may be out of date, or the page may have moved.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button href="/">Back to the event</Button>
          <Button href="/#faq" variant="ghost">
            Read the FAQ
          </Button>
        </div>
      </div>
    </section>
  );
}
