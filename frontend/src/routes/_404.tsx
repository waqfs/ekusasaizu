export function NotFound() {
  return (
    <div class="min-h-screen bg-gray-950 flex items-center justify-center">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-700 mb-4">404</h1>
        <p class="text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
        <a href="/" class="px-6 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-medium transition-colors inline-block">
          Go Home
        </a>
      </div>
    </div>
  );
}
