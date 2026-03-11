export function Home() {
  return (
    <div class="min-h-screen bg-gray-950 text-gray-100">
      {/* Navigation */}
      <nav class="fixed top-0 w-full z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800/50">
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">エクササイズ</span>
          </div>
          <div class="flex items-center gap-6">
            <a href="#features" class="text-sm text-gray-400 hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" class="text-sm text-gray-400 hover:text-white transition-colors">
              How It Works
            </a>
            <a href="/login" class="text-sm px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-gray-950 font-medium transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section class="relative pt-32 pb-20 px-6">
        <div class="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-transparent" />
        <div class="max-w-4xl mx-auto text-center relative">
          <div class="inline-block mb-6 px-4 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-sm">
            AI-Powered Exercise Coaching
          </div>
          <h1 class="text-5xl md:text-7xl font-bold tracking-tight">
            Master Your Form.
            <br />
            <span class="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">Elevate Your Fitness.</span>
          </h1>
          <p class="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            An intelligent exercise companion that watches your technique in real-time through your camera, provides instant feedback, and guides you toward
            perfect form — every rep, every set.
          </p>
          <div class="mt-10 flex items-center justify-center gap-4">
            <a
              href="/login"
              class="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-lg transition-all shadow-lg shadow-cyan-500/25"
            >
              Start Training
            </a>
            <a href="#features" class="px-8 py-3 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 font-medium text-lg transition-colors">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" class="py-20 px-6">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-4">Why エクササイズ?</h2>
          <p class="text-gray-400 text-center mb-16 max-w-xl mx-auto">Combining AI vision with exercise science to revolutionize how you train.</p>
          <div class="grid md:grid-cols-3 gap-6">
            {features.map(feature => (
              <div class="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition-colors">
                <div class="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 mb-4">{feature.icon}</div>
                <h3 class="text-lg font-semibold mb-2">{feature.title}</h3>
                <p class="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" class="py-20 px-6 bg-gray-900/30">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-4">How It Works</h2>
          <p class="text-gray-400 text-center mb-16 max-w-xl mx-auto">Get started in minutes — no special equipment required.</p>
          <div class="grid md:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <div class="text-center">
                <div class="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
                  {i + 1}
                </div>
                <h3 class="font-semibold mb-2">{step.title}</h3>
                <p class="text-gray-400 text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section class="py-20 px-6">
        <div class="max-w-6xl mx-auto">
          <h2 class="text-3xl font-bold text-center mb-4">Benefits</h2>
          <p class="text-gray-400 text-center mb-16 max-w-xl mx-auto">Everything you need to train smarter and safer.</p>
          <div class="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {benefits.map(b => (
              <div class="flex items-start gap-4 p-5 rounded-xl bg-gray-900/30 border border-gray-800/50">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h4 class="font-medium text-gray-200 mb-1">{b.title}</h4>
                  <p class="text-sm text-gray-500">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section class="py-20 px-6">
        <div class="max-w-3xl mx-auto text-center">
          <h2 class="text-4xl font-bold mb-4">Ready to perfect your form?</h2>
          <p class="text-gray-400 mb-8">Join athletes improving their technique with AI-powered coaching.</p>
          <a
            href="/login"
            class="inline-block px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-lg transition-all shadow-lg shadow-cyan-500/25"
          >
            Sign Up Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer class="border-t border-gray-800 py-8 px-6">
        <div class="max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <span>© 2026 エクササイズ (Ekusasaizu)</span>
          <div class="flex gap-6">
            <a href="#" class="hover:text-gray-300 transition-colors">
              Privacy
            </a>
            <a href="#" class="hover:text-gray-300 transition-colors">
              Terms
            </a>
            <a href="#" class="hover:text-gray-300 transition-colors">
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
