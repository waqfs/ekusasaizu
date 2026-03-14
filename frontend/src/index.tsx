import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Home } from '@route/Home/index.tsx';
import { Login } from '@route/Login/index.tsx';
import { Progress } from '@route/Progress/index.tsx';
import { Exercise } from '@route/Exercise/index.tsx';
import { Live } from '@route/Live/index.tsx';
import { Demo } from '@route/Demo/index.tsx';
import { Settings } from '@route/Settings/index.tsx';
import { NotFound } from '@route/_404.tsx';
import './style.css';

export function App() {
  return (
    <LocationProvider>
      <Router>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/progress" component={Progress} />
        <Route path="/exercise" component={Exercise} />
        <Route path="/live" component={Live} />
        <Route path="/demo" component={Demo} />
        <Route path="/settings" component={Settings} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}

render(<App />, document.getElementById('app'));
