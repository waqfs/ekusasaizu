import { useLocation } from 'preact-iso';
import { p } from '../lib/basePath';

export function Header() {
  const { url } = useLocation();

  return (
    <header>
      <nav>
        <a href={p('/')} class={url == p('/') && 'active'}>
          Home
        </a>
        <a href={p('/404')} class={url == p('/404') && 'active'}>
          404
        </a>
      </nav>
    </header>
  );
}
