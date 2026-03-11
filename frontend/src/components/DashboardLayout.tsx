import { useState } from 'preact/hooks';
import { ComponentChildren } from 'preact';
import { Sidebar } from '@component/Sidebar.jsx';

export function DashboardLayout({ children }: { children: ComponentChildren }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div class="flex h-screen bg-gray-950 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && <div class="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar — fixed overlay on mobile, static on desktop */}
      <div
        class={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      <div class="flex-1 flex flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <div class="md:hidden sticky top-0 z-30 bg-gray-950 border-b border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} class="text-gray-400 hover:text-gray-200">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <span class="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">エクササイズ</span>
        </div>
        <main class="flex-1">{children}</main>
      </div>
    </div>
  );
}
