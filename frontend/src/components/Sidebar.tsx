import { useLocation } from 'preact-iso';

const navItems = [
  {
    path: '/progress',
    label: 'Progress',
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
  {
    path: '/exercise',
    label: 'Exercises',
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
  },
  {
    path: '/live',
    label: 'Live Session',
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path
          stroke-linecap="round"
          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9.75a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75H4.5a.75.75 0 00-.75.75v12c0 .414.336.75.75.75z"
        />
      </svg>
    ),
  },
  {
    path: '/demo',
    label: 'Demo',
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M6 7.125v-1.5" />
      </svg>
    ),
  },
  {
    path: '/settings',
    label: 'Settings',
    icon: (
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        />
        <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { url } = useLocation();

  return (
    <aside class="w-60 h-full bg-stone-950 md:bg-stone-950/80 border-r border-stone-800/30 flex flex-col shrink-0">
      <div class="px-6 py-8 flex items-center justify-between">
        <a href="/" class="block">
          <span class="text-lg font-light tracking-wide text-amber-400">エクササイズ</span>
          <span class="block text-[10px] text-stone-600 tracking-[0.25em] uppercase mt-1">Ekusasaizu</span>
        </a>
        {onClose && (
          <button onClick={onClose} class="md:hidden text-stone-500 hover:text-stone-300">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <nav class="flex-1 px-4 space-y-0.5">
        {navItems.map(item => {
          const isActive = url === item.path || url.startsWith(item.path + '/');
          return (
            <a
              href={item.path}
              class={`flex items-center gap-3 px-3 py-2.5 text-sm font-light tracking-wide transition-all duration-150 ${
                isActive ? 'text-amber-400 border-l-2 border-amber-400/50 -ml-px' : 'text-stone-500 hover:text-stone-300 border-l-2 border-transparent -ml-px'
              }`}
            >
              {item.icon}
              {item.label}
            </a>
          );
        })}
      </nav>

      <div class="px-6 py-6 border-t border-stone-800/20">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-full bg-stone-800 flex items-center justify-center text-stone-400 text-xs font-light shrink-0">U</div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-light text-stone-300 truncate">User</p>
            <p class="text-[11px] text-stone-600 truncate">user@example.com</p>
          </div>
        </div>
        <a href="/login" class="mt-3 block text-center text-[11px] tracking-widest uppercase text-stone-600 hover:text-stone-400 transition-colors">
          Sign Out
        </a>
      </div>
    </aside>
  );
}
