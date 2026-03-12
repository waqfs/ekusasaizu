export function Home() {
  return (
    <div class="min-h-screen bg-stone-950 text-stone-300">
      {/* Navigation */}
      <nav class="fixed top-0 w-full z-50 bg-stone-950/90 backdrop-blur-sm">
        <div class="max-w-7xl mx-auto px-8 md:px-12 h-20 flex items-center justify-between">
          <span class="text-lg tracking-wide text-amber-400 font-light">エクササイズ</span>
          <div class="flex items-center gap-8">
            <a href="#features" class="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-300 transition-colors">
              Features
            </a>
            <a href="#how-it-works" class="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-300 transition-colors">
              Process
            </a>
            <a
              href="/login"
              class="text-xs tracking-widest uppercase px-5 py-2 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              Begin
            </a>
          </div>
        </div>
        <div class="border-b border-stone-800/30" />
      </nav>

      {/* Hero — asymmetric, left-aligned */}
      <section class="pt-40 pb-32 px-8 md:px-12">
        <div class="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div>
            <p class="text-xs tracking-[0.3em] uppercase text-stone-600 mb-8">AI-Guided Exercise Coaching</p>
            <h1 class="text-4xl md:text-6xl font-extralight tracking-tight leading-tight text-stone-100">
              Master Your
              <br />
              <span class="text-amber-400 font-light">Form.</span>
            </h1>
            <div class="w-12 h-px bg-amber-500/40 my-8" />
            <p class="text-base font-light text-stone-500 max-w-md leading-relaxed">
              An intelligent companion that observes your technique through your camera and guides you toward perfect form — quietly, precisely, every rep.
            </p>
            <div class="mt-10 flex items-center gap-6">
              <a href="/login" class="text-xs tracking-widest uppercase px-8 py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors">
                Start Training
              </a>
              <a href="#features" class="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-300 transition-colors">
                Learn More →
              </a>
            </div>
          </div>
          {/* Right side — reserved for zen image */}
          <div class="hidden md:flex items-center justify-center">
            <div class="w-full aspect-[4/5] border border-stone-800/30 flex items-center justify-center">
              <div class="text-center">
                <p class="text-6xl text-stone-800/60 font-extralight mb-4">禅</p>
                <p class="text-[10px] tracking-[0.4em] uppercase text-stone-700">Image Placeholder</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Thin divider */}
      <div class="max-w-7xl mx-auto px-8 md:px-12">
        <div class="border-t border-stone-800/20" />
      </div>

      {/* Features */}
      <section id="features" class="py-24 px-8 md:px-12">
        <div class="max-w-7xl mx-auto">
          <p class="text-xs tracking-[0.3em] uppercase text-stone-600 mb-4">Why Ekusasaizu</p>
          <h2 class="text-2xl font-extralight text-stone-200 mb-16">Purpose-built for proper technique.</h2>
          <div class="grid md:grid-cols-3 gap-12">
            {features.map(feature => (
              <div>
                <div class="text-amber-400/70 mb-5">{feature.icon}</div>
                <h3 class="text-sm font-medium tracking-wide text-stone-200 mb-3">{feature.title}</h3>
                <p class="text-sm font-light text-stone-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Thin divider */}
      <div class="max-w-7xl mx-auto px-8 md:px-12">
        <div class="border-t border-stone-800/20" />
      </div>

      {/* How It Works */}
      <section id="how-it-works" class="py-24 px-8 md:px-12">
        <div class="max-w-7xl mx-auto">
          <p class="text-xs tracking-[0.3em] uppercase text-stone-600 mb-4">Process</p>
          <h2 class="text-2xl font-extralight text-stone-200 mb-16">Four steps to better form.</h2>
          <div class="grid md:grid-cols-4 gap-12">
            {steps.map((step, i) => (
              <div>
                <span class="text-3xl font-extralight text-amber-500/40 mb-4 block">{String(i + 1).padStart(2, '0')}</span>
                <h3 class="text-sm font-medium tracking-wide text-stone-200 mb-2">{step.title}</h3>
                <p class="text-sm font-light text-stone-500 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Thin divider */}
      <div class="max-w-7xl mx-auto px-8 md:px-12">
        <div class="border-t border-stone-800/20" />
      </div>

      {/* Benefits */}
      <section class="py-24 px-8 md:px-12">
        <div class="max-w-7xl mx-auto">
          <p class="text-xs tracking-[0.3em] uppercase text-stone-600 mb-4">Benefits</p>
          <h2 class="text-2xl font-extralight text-stone-200 mb-16">Train smarter. Train safer.</h2>
          <div class="grid md:grid-cols-2 gap-x-16 gap-y-10 max-w-4xl">
            {benefits.map(b => (
              <div class="flex items-start gap-4">
                <div class="w-px h-10 bg-amber-500/30 shrink-0 mt-0.5" />
                <div>
                  <h4 class="text-sm font-medium text-stone-200 mb-1">{b.title}</h4>
                  <p class="text-sm font-light text-stone-500 leading-relaxed">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section class="py-24 px-8 md:px-12 border-t border-stone-800/20">
        <div class="max-w-7xl mx-auto">
          <h2 class="text-3xl font-extralight text-stone-200 mb-4">Begin your practice.</h2>
          <p class="text-sm font-light text-stone-500 mb-10 max-w-md">Join those improving their technique with mindful, AI-guided coaching.</p>
          <a href="/login" class="inline-block text-xs tracking-widest uppercase px-10 py-4 bg-amber-600 hover:bg-amber-500 text-stone-950 transition-colors">
            Sign Up Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer class="border-t border-stone-800/20 py-10 px-8 md:px-12">
        <div class="max-w-7xl mx-auto flex items-center justify-between text-xs text-stone-600">
          <span class="tracking-wide">© 2026 エクササイズ</span>
          <div class="flex gap-8">
            <a href="#" class="tracking-widest uppercase hover:text-stone-400 transition-colors">
              Privacy
            </a>
            <a href="#" class="tracking-widest uppercase hover:text-stone-400 transition-colors">
              Terms
            </a>
            <a href="#" class="tracking-widest uppercase hover:text-stone-400 transition-colors">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    title: 'Real-Time AI Coaching',
    description: 'Our AI agent watches your form through your camera and provides instant, actionable feedback to help you exercise safely and effectively.',
    icon: (
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
        />
      </svg>
    ),
  },
  {
    title: 'Technique Checkpoints',
    description: 'Every exercise is broken down into key positions. The agent evaluates your form at each checkpoint and provides a detailed technique score.',
    icon: (
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Track Your Progress',
    description: 'Monitor your improvement over time with detailed analytics, technique scores, and personalized goals to keep you motivated and on track.',
    icon: (
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"
        />
      </svg>
    ),
  },
];

const steps = [
  {
    title: 'Choose Exercise',
    description: 'Browse our library and select the exercise you want to practice.',
  },
  {
    title: 'Enable Camera',
    description: 'Turn on your camera so the AI agent can observe your movements.',
  },
  {
    title: 'Get Feedback',
    description: 'Receive real-time coaching on your form at every checkpoint.',
  },
  {
    title: 'Improve',
    description: 'Track your technique scores and watch your form improve over time.',
  },
];

const benefits = [
  {
    title: 'Injury Prevention',
    description: 'Real-time form correction helps you avoid common exercise injuries caused by poor technique.',
  },
  {
    title: 'Faster Results',
    description: 'Proper form means better muscle engagement, leading to faster and more effective results.',
  },
  {
    title: 'No Personal Trainer Needed',
    description: 'Get professional-quality coaching from the comfort of your home, at a fraction of the cost.',
  },
  {
    title: 'Personalized Feedback',
    description: 'The AI adapts to your skill level and focuses on the areas where you need the most improvement.',
  },
  {
    title: 'Detailed Analytics',
    description: 'Track technique scores, workout streaks, and progress over time with comprehensive dashboards.',
  },
  {
    title: 'Train Anytime, Anywhere',
    description: 'All you need is a camera and a browser. No gym equipment or special setup required.',
  },
];
