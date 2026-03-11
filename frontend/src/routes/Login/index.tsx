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
    <div class="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div class="w-full max-w-md">
        {/* Logo */}
        <div class="text-center mb-8">
          <a href="/">
            <span class="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">エクササイズ</span>
          </a>
          <p class="text-gray-500 text-sm mt-2">{isSignUp ? 'Create your account' : 'Welcome back'}</p>
        </div>

        {/* Form Card */}
        <div class="bg-gray-900/50 border border-gray-800 rounded-2xl p-8">
          <div class="flex mb-8 bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setIsSignUp(false)}
              class={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isSignUp ? 'bg-cyan-500 text-gray-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Log In
            </button>
            <button
              onClick={() => setIsSignUp(true)}
              class={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isSignUp ? 'bg-cyan-500 text-gray-950' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onInput={e => setUsername((e.target as HTMLInputElement).value)}
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                placeholder="Enter your username"
              />
            </div>

            {isSignUp && (
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="Enter your email"
                />
              </div>
            )}

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onInput={e => setPassword((e.target as HTMLInputElement).value)}
                class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                placeholder="Enter your password"
              />
            </div>

            {isSignUp && (
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1.5">Confirm Password</label>
                <input
                  type="password"
                  class="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                  placeholder="Confirm your password"
                />
              </div>
            )}

            <button
              type="submit"
              class="w-full py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold transition-all shadow-lg shadow-cyan-500/20"
            >
              {isSignUp ? 'Create Account' : 'Log In'}
            </button>
          </form>

          {!isSignUp && (
            <p class="text-center text-sm text-gray-500 mt-4">
              <a href="#" class="text-cyan-400 hover:text-cyan-300 transition-colors">
                Forgot password?
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
