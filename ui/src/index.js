import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import App from './App';
import axios from "axios";

const root = ReactDOM.createRoot(document.getElementById('root'));

// When we init application, we should never use Effect, because it fires twice.
// See https://reactjs.org/docs/strict-mode.html#ensuring-reusable-state
// See https://beta.reactjs.org/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
// Instead, we should put it outside the component.
// See https://beta.reactjs.org/learn/synchronizing-with-effects#not-an-effect-initializing-the-application
// See https://stackoverflow.com/a/51450332/17679565
if (typeof window !== 'undefined') { // Check if we're running in the browser.
  axios.get('/tc/api/v1/init').then(res => {
    const data = res?.data?.data;
    console.log(`TC: Init ok, ${JSON.stringify(data)}`);

    root.render(
      <React.StrictMode>
        <App/>
      </React.StrictMode>
    );
  }).catch((e) => {
    document.write(`<pre style="color: darkred">${JSON.stringify(e, null, 2)}</pre>`);
    console.error(e);
  }).finally(() => {
  });
}
