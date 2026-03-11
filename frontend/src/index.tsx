import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Home } from '@route/Home/index.jsx';
import { Login } from '@route/Login/index.jsx';
import { Progress } from '@route/Progress/index.jsx';
import { Exercise } from '@route/Exercise/index.jsx';
import { Live } from '@route/Live/index.jsx';
import { Settings } from '@route/Settings/index.jsx';
import { NotFound } from '@route/_404.jsx';
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
        <Route path="/settings" component={Settings} />
        <Route default component={NotFound} />
      </Router>
    </LocationProvider>
  );
}

render(<App />, document.getElementById('app'));
