import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Home } from '@route/Home/index.tsx';
import { Login } from '@route/Login/index.tsx';
import { Progress } from '@route/Progress/index.tsx';
import { Exercise } from '@route/Exercise/index.tsx';
import { Live } from '@route/Live/index.tsx';
import { Demo } from '@route/Demo/index.tsx';
import { RawDemo } from '@route/RawDemo/index.tsx';
import { TwoPassDemo } from '@route/TwoPassDemo/index.tsx';
import { Settings } from '@route/Settings/index.tsx';
import { NotFound } from '@route/_404.tsx';
import { p } from './lib/basePath';
import './style.css';

export function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path={p('/')} component={Home} />
        <Route path={p('/login')} component={Login} />
        <Route path={p('/progress')} component={Progress} />
        <Route path={p('/exercise')} component={Exercise} />
        <Route path={p('/live')} component={Live} />
        <Route path={p('/demo')} component={Demo} />
        <Route path={p('/raw-demo')} component={RawDemo} />
        <Route path={p('/two-pass')} component={TwoPassDemo} />
        <Route path={p('/settings')} component={Settings} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}

render(<App />, document.getElementById('app'));
