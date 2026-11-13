'use client';

/**
 * Last-resort error page, shown only when the root layout itself fails. It
 * replaces the whole document, so it carries its own <html>/<body> and inline
 * styles (globals.css and the fonts are not loaded here) and imports nothing.
 * Replaces Next's default global error UI.
 */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 24,
          padding: '48px max(16px, 6vw)',
          boxSizing: 'border-box',
          background: '#000',
          color: '#fff',
          colorScheme: 'dark',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <title>Something went wrong · TEDxSantaClaraUniversity</title>
        <p style={{ margin: 0, fontFamily: mono, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#a0a0a0' }}>
          Error · Clause unreadable
        </p>
        <h1 style={{ margin: 0, maxWidth: '14ch', fontSize: 'clamp(2.5rem, 7vw, 6.5rem)', lineHeight: 0.95, letterSpacing: '-0.045em', fontWeight: 600 }}>
          Something went wrong.
        </h1>
        <p style={{ margin: 0, maxWidth: '32rem', fontSize: 18, lineHeight: 1.5, color: '#b8b8b8' }}>
          The page could not be shown. Try again, or come back in a moment.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            type="button"
            onClick={() => retry()}
            style={{ minHeight: 56, padding: '12px 32px', border: 0, borderRadius: 999, background: '#eb0028', color: '#fff', font: 'inherit', fontWeight: 500, cursor: 'pointer' }}
          >
            Try again
          </button>
          {/* A full page load on purpose: the root layout is what failed. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', minHeight: 56, boxSizing: 'border-box', padding: '12px 32px', border: '1px solid rgb(255 255 255 / 0.3)', borderRadius: 999, color: '#fff', textDecoration: 'none', fontWeight: 500 }}
          >
            Back to the event
          </a>
        </div>
      </body>
    </html>
  );
}
