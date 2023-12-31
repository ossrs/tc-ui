import './App.css';
import React from "react";
import {Container} from "react-bootstrap";
import {ErrorBoundary} from "react-error-boundary";
import {BrowserRouter, Route, Routes, useLocation, useNavigate} from "react-router-dom";
import SingleStategy from "./pages/SingleStategy";
import Navigator from "./pages/Navigator";
import ComplexStategy from "./pages/ComplexStategy";

export default function App() {
  React.useEffect(() => {
    const l = window.location;
    const q = encodeURI('tcshow lo');
    console.log(`HTTP API by GET or POST, see https://github.com/ossrs/tc-ui#http-openapi`);
    console.log(`    ${l.protocol}//${l.host}/tc/api/v1/config/raw?cmd=${q}`);
  }, []);

  return (
    <ErrorBoundary FallbackComponent={(RootError)}>
      <AppImpl/>
    </ErrorBoundary>
  );
}

function RootError({error, resetErrorBoundary}) {
  return (
    <Container>
      <div>
        message:
        <pre>{error?.message}</pre>
      </div>
      {error?.response?.data && <div>
        response:
        <pre>{error?.response?.data}</pre>
      </div>}
      {error?.stack && <div>
        stack:
        <pre>{error?.stack}</pre>
      </div>}
      <div>
        <button onClick={resetErrorBoundary}>Clear Error</button>
      </div>
    </Container>
  );
}

function AppImpl() {
  const [loading, setLoading] = React.useState(true);

  // See https://reactjs.org/docs/strict-mode.html#ensuring-reusable-state
  // See https://beta.reactjs.org/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
  React.useEffect(() => {
    setLoading(false);
    return () => {
      setLoading(true);
    };
  }, []);

  return <>
    {loading && <>
      <Container>Loading...</Container>
    </>}
    {!loading && <>
      <BrowserRouter>
        <Navigator/>
        <Routes>
          <Route path="/tc/p/SingleStategy" element={<SingleStategy/>}/>
          <Route path="/tc/p/ComplexStategy" element={<ComplexStategy/>}/>
          <Route path="*" element={<AppDefault/>}/>
        </Routes>
      </BrowserRouter>
    </>}
  </>;
}

// For unknown route, redirect to working issue.
function AppDefault() {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const to = {pathname: `/tc/p/SingleStategy`, search: location.search};
    console.log(`Jump to ${JSON.stringify(to)} by root`);
    navigate(to);
  }, [navigate, location]);

  return <></>;
}
