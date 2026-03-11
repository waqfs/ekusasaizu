import { ComponentChildren } from 'preact';
import { Sidebar } from '@component/Sidebar.jsx';

export function DashboardLayout({ children }: { children: ComponentChildren }) {
  return (
    <div class="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar />
      <main class="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
