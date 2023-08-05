import React from "react";
import {Alert, Container, Button} from "react-bootstrap";
import {ErrorBoundary} from 'react-error-boundary';

export default function TcErrorBoundary({children}) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <>{children}</>
    </ErrorBoundary>
  );
}

function ErrorFallback({error, resetErrorBoundary}) {
  const [show, setShow] = React.useState(true);

  const onResetError = React.useCallback(() => {
    setShow(false);
    resetErrorBoundary();
  }, [setShow, resetErrorBoundary]);

  if (!show) return <></>;
  return (
    <Container>
      <Alert variant="danger" onClose={() => onResetError()} dismissible>
        <Alert.Heading>You got an error!</Alert.Heading>
        <ErrorDetail error={error}/>
        <Button variant="success" type="button" onClick={onResetError}>
          Got it
        </Button>
      </Alert>
    </Container>
  );
}

function ErrorDetail({error}) {
  if (!error) return (
    <p>Empty unknown error</p>
  );

  const err = error?.response?.data;

  if (err?.code) return (
    <div>
      <p>
        Request: {`${error.request?.responseURL}`} <br/>
        Status: {`${error.response?.status}`} {`${error.response?.statusText}`} <br/>
        Code: {`${err?.code}`} <br/>
        Message: {`${err?.data?.message}`} <br/> <br/>
      </p>
      <pre>
        {JSON.stringify(error.response.data, null, 2)}
      </pre>
    </div>
  );

  if (error.response?.status) {
    return (
      <div>
        <p>
          Request: {`${error.request?.responseURL}`} <br/>
          Status: {`${error.response?.status}`} {`${error.response?.statusText}`} <br/>
        </p>
        <pre>{`${err}`}</pre>
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div>
        <p>
          Name: {error.name} <br/>
          Message: {error.message} <br/> <br/>
        </p>
        <pre>
          {error.stack}
        </pre>
      </div>
    );
  }

  if (typeof(error) === 'object') {
    return <p>Object: {JSON.stringify(error)}</p>
  }

  if (typeof(error) === 'function') {
    return <p>Function: {error.toString()}</p>
  }

  return <p>{error.toString()}</p>;
}

