import { useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';

export function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { route } = useLocation();

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    route('/progress');
  };

  return (
    <div class="min-h-screen bg-stone-950 flex items-center justify-center px-6">
      <div class="w-full max-w-md">
        {/* Logo */}
        <div class="text-center mb-8">
          <a href="/">
            <span class="text-2xl font-light tracking-wide text-amber-400">エクササイズ</span>
          </a>
          <p class="text-stone-600 text-sm font-light mt-2">{isSignUp ? 'Create your account' : 'Welcome back'}</p>
        </div>

        {/* Form Card */}
        <div class="bg-stone-900/30 border border-stone-800/30 rounded-lg p-8">
          <div class="flex mb-8 bg-stone-800/50 p-1">
            <button
              onClick={() => setIsSignUp(false)}
              class={`flex-1 py-2 text-sm font-light tracking-wide transition-colors ${
                !isSignUp ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              class={`flex-1 py-2 text-sm font-light tracking-wide transition-colors ${
                isSignUp ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} class="space-y-5">
            <div>
              <label class="block text-xs font-light tracking-wide text-stone-500 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onInput={e => setUsername((e.target as HTMLInputElement).value)}
                class="w-full px-4 py-2.5 bg-stone-900/50 border border-stone-800/30 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="Enter your username"
              />
            </div>

            {isSignUp && (
              <div>
                <label class="block text-xs font-light tracking-wide text-stone-500 mb-1.5">Email</label>
                <input
                  type="email"
                  class="w-full px-4 py-2.5 bg-stone-900/50 border border-stone-800/30 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  placeholder="Enter your email"
                />
              </div>
            )}

            <div>
              <label class="block text-xs font-light tracking-wide text-stone-500 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onInput={e => setPassword((e.target as HTMLInputElement).value)}
                class="w-full px-4 py-2.5 bg-stone-900/50 border border-stone-800/30 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                placeholder="Enter your password"
              />
            </div>

            {isSignUp && (
              <div>
                <label class="block text-xs font-light tracking-wide text-stone-500 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  class="w-full px-4 py-2.5 bg-stone-900/50 border border-stone-800/30 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
                  placeholder="Confirm your password"
                />
              </div>
            )}

            <button
              type="submit"
              class="w-full py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 font-light tracking-widest uppercase text-xs transition-all"
            >
              {isSignUp ? 'Create Account' : 'Log In'}
            </button>
          </form>

          {!isSignUp && (
            <p class="text-center text-sm text-stone-500 mt-4">
              <a href="#" class="text-amber-400 hover:text-amber-300 transition-colors">
                Forgot password?
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
