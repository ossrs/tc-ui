import React from "react";
import TcErrorBoundary from "../components/TcErrorBoundary";
import {Accordion, Container, Form, Row, Col, Button} from "react-bootstrap";
import NetFilter from "../components/NetFilter";
import {TcConfigQuery} from "../components/TcConfigQuery";
import axios from "axios";
import {useErrorHandler} from "react-error-boundary";
import {ComplexStrategyStorage} from "../utils";
import {StrategySetting} from "../components/StrategySetting";

export default function ComplexStategy() {
  // Load filter and strategy from storage.
  const defaultFilter = ComplexStrategyStorage.loadFilter() || {};
  const defaultStrategy = ComplexStrategyStorage.loadStrategy() || {};
  console.log(`load filter=${JSON.stringify(defaultFilter)}, strategy=${JSON.stringify(defaultStrategy)}`);

  return <TcErrorBoundary>
    <Container fluid={true}>
      <TcErrorBoundary>
        <ComplexStategySetting defaultFilter={defaultFilter} defaultStrategy={defaultStrategy}/>
      </TcErrorBoundary>
    </Container>
  </TcErrorBoundary>;
}

function ComplexStategySetting({defaultFilter, defaultStrategy}) {
  const [executing, setExecuting] = React.useState(false);
  const [refresh, setRefresh] = React.useState(0);
  const [validated, setValidated] = React.useState(false);
  const handleError = useErrorHandler();

  const [iface, setIface] = React.useState(defaultFilter.iface);
  const [protocol, setProtocol] = React.useState(defaultFilter.protocol || 'ip');
  const [direction, setDirection] = React.useState(defaultFilter.direction || 'incoming');
  const [identifyKey, setIdentifyKey] = React.useState(defaultFilter.identifyKey || 'all');
  const [identifyValue, setIdentifyValue] = React.useState(defaultFilter.identifyValue);
  // First strategy.
  const [strategy, setStrategy] = React.useState(defaultStrategy.strategy || 'loss');
  const [loss, setLoss] = React.useState(defaultStrategy.loss || '1');
  const [delay, setDelay] = React.useState(defaultStrategy.delay || '10');
  const [rate, setRate] = React.useState(defaultStrategy.rate || '1000000');
  const [delayDistro, setDelayDistro] = React.useState(defaultStrategy.delayDistro);
  // Second strategy.
  const [strategy2, setStrategy2] = React.useState(defaultStrategy.strategy2 || 'delay');
  const [loss2, setLoss2] = React.useState(defaultStrategy.loss2 || '1');
  const [delay2, setDelay2] = React.useState(defaultStrategy.delay2 || '10');
  const [rate2, setRate2] = React.useState(defaultStrategy.rate2 || '1000000');
  const [delayDistro2, setDelayDistro2] = React.useState(defaultStrategy.delayDistro2);

  const [gIfaces, setGIfaces] = React.useState();
  const [ifbs, setIfbs] = React.useState();

  // For callback to update state, because in callback we can only get the copy, so we need a ref to point to the latest
  // copy of state of variant objects.
  const ref = React.useRef({});
  React.useEffect(() => {
    ref.current.refresh = refresh;
  }, [refresh]);

  // Update whether it has ifb interface.
  React.useEffect(() => {
    axios.get('/tc/api/v1/init').then(res => {
      const data = res?.data?.data;
      console.log(`TC: Init ok, ${JSON.stringify(data)}`);

      const ifaces = data?.ifaces;
      setGIfaces(ifaces);

      const ifbs = ifaces?.filter(e => e?.name?.indexOf('ifb') >= 0);
      setIfbs(ifbs);
    });
  }, [refresh, setIfbs, setGIfaces]);

  // Reset the TC config.
  const resetNetwork = React.useCallback((e) => {
    if (!iface) {
      setValidated(true);
      return;
    }

    setExecuting(true);
    axios.get(`/tc/api/v1/config/reset?iface=${iface}`).then(res => {
      const conf = res?.data?.data;
      console.log(`query ok, iface=${iface}, conf=${JSON.stringify(conf)}`);
    }).catch(handleError).finally(async () => {
      setRefresh(ref.current.refresh + 1);
      await new Promise(resolve => setTimeout(resolve, 300));
      setExecuting(false);
    });
  }, [iface, handleError, setExecuting, ref, setRefresh]);

  // Setup the TC config.
  const setupNetwork = React.useCallback(() => {
    if (!iface || !protocol || (identifyKey !== 'all' && !identifyValue)) {
      setValidated(true);
      return;
    }
    if ((!strategy || strategy === 'no') && (!strategy2 || strategy2 === 'no')) {
      return alert('请选择策略');
    }
    if (strategy === strategy2) {
      return alert('重复的弱网策略');
    }
    if (delayDistro && Number(delayDistro) > Number(delay)) {
      return alert(`延迟抖动${delayDistro}不能大于延迟${delay}`);
    }
    if (delayDistro2 && Number(delayDistro2) > Number(delay2)) {
      return alert(`延迟抖动${delayDistro2}不能大于延迟${delay2}`);
    }

    ComplexStrategyStorage.saveFilter(iface, protocol, direction, identifyKey, identifyValue);
    ComplexStrategyStorage.saveStrategy(strategy, loss, delay, rate, delayDistro, strategy2, loss2, delay2, rate2, delayDistro2);
    console.log(`save iface=${iface}, protocol=${protocol}, direction=${direction}, identify=${identifyKey}/${identifyValue}, ` +
      `strategy=${strategy}, loss=${loss}, delay=${delay}, rate=${rate}, delayDistro=${delayDistro}, ` +
      `strategy2=${strategy2}, loss2=${loss2}, delay2=${delay2}, rate2=${rate2}, delayDistro2=${delayDistro2}`);

    setExecuting(true);
    const queries = [
      iface ? `iface=${iface}` : null,
      protocol ? `protocol=${protocol}` : null,
      direction ? `direction=${direction}` : null,
      identifyKey ? `identifyKey=${identifyKey}` : null,
      identifyValue ? `identifyValue=${identifyValue}` : null,
      strategy && strategy !== 'no' ? `strategy=${strategy}` : null,
      loss && strategy === 'loss' ? `loss=${loss}` : null,
      delay && strategy === 'delay' ? `delay=${delay}` : null,
      rate && strategy === 'rate' ? `rate=${rate}` : null,
      delayDistro && strategy === 'delay' ? `delayDistro=${delayDistro}` : null,
      strategy2 && strategy2 !== 'no' ? `strategy2=${strategy2}` : null,
      loss2 && strategy2 === 'loss' ? `loss2=${loss2}` : null,
      delay2 && strategy2 === 'delay' ? `delay2=${delay2}` : null,
      rate2 && strategy2 === 'rate' ? `rate2=${rate2}` : null,
      delayDistro2 && strategy2 === 'delay' ? `delayDistro2=${delayDistro2}` : null,
      `api=${window.location.port}`,
    ].filter(e => e);
    axios.get(`/tc/api/v1/config/setup2?${queries.join('&')}`).then(res => {
      const conf = res?.data?.data;
      console.log(`query ok, ${queries.join(', ')}, conf=${JSON.stringify(conf)}`);
    }).catch(handleError).finally(async () => {
      setRefresh(ref.current.refresh + 1);
      await new Promise(resolve => setTimeout(resolve, 300));
      setExecuting(false);
    });
  }, [
    iface, protocol, direction, identifyKey, identifyValue,
    strategy, loss, delay, rate, delayDistro,
    strategy2, loss2, delay2, rate2, delayDistro2,
    handleError, setExecuting, ref, setRefresh,
  ]);

  return <Accordion defaultActiveKey="0">
    <Accordion.Item eventKey="0">
      <Accordion.Header>网络丢包设置</Accordion.Header>
      <Accordion.Body>
        <Form noValidate validated={validated}>
          <Row>
            <Col xs='auto'>
              {gIfaces && <NetFilter gIfaces={gIfaces}
                         iface={iface} setIface={setIface} protocol={protocol} setProtocol={setProtocol}
                         direction={direction} setDirection={setDirection} identifyKey={identifyKey}
                         setIdentifyKey={setIdentifyKey} identifyValue={identifyValue}
                         setIdentifyValue={setIdentifyValue}/>}
            </Col>
          </Row>
          <Row>
            <Col xs='auto'>
              <StrategySetting strategy={strategy} setStrategy={setStrategy} loss={loss}
                               setLoss={setLoss} delay={delay} setDelay={setDelay}
                               rate={rate} setRate={setRate} delayDistro={delayDistro}
                               setDelayDistro={setDelayDistro}/>
            </Col>
          </Row>
          <Row>
            <Col xs='auto'>
              <StrategySetting strategy={strategy2} setStrategy={setStrategy2} loss={loss2}
                               setLoss={setLoss2} delay={delay2} setDelay={setDelay2}
                               rate={rate2} setRate={setRate2} delayDistro={delayDistro2}
                               setDelayDistro={setDelayDistro2}/>
            </Col>
          </Row>
          <Row>
            <Col xs='auto'>
              <TcErrorBoundary>
                <Button variant="primary" type="button" onClick={setupNetwork} disabled={executing}>
                  设置网络
                </Button> &nbsp;
                <Button variant="primary" type="button" onClick={resetNetwork} disabled={executing}>
                  重置网络
                </Button>
              </TcErrorBoundary>
            </Col>
          </Row>
          <Row>
            {iface && <Col xs='auto'>
              <p/>
              <TcConfigQuery iface={iface} forceRefresh={refresh}/>
            </Col>}
            {ifbs && ifbs?.filter(e => e.name).map(e => {
              return <Col xs='auto' key={e.name}>
                <p/>
                <TcConfigQuery iface={e.name} forceRefresh={refresh}/>
              </Col>;
            })}
          </Row>
        </Form>
      </Accordion.Body>
    </Accordion.Item>
  </Accordion>;
}
