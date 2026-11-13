import type { Metadata } from 'next';
import KeystaticApp from './keystatic';

export const metadata: Metadata = {
  title: 'Content admin',
  robots: { index: false, follow: false },
};

export default function KeystaticLayout() {
  return (
    <div className="keystatic-root">
      <KeystaticApp />
    </div>
  );
}
