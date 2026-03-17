import { p } from '../lib/basePath';

export function NotFound() {
  return (
    <div class="min-h-screen bg-stone-950 flex items-center justify-center">
      <div class="text-center">
        <h1 class="text-6xl font-extralight text-stone-700 mb-4">404</h1>
        <p class="text-stone-500 font-light mb-8">This page does not exist.</p>
        <a href={p('/')} class="text-xs tracking-widest uppercase px-6 py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors inline-block">
          Return
        </a>
      </div>
    </div>
  );
}
