import React from "react";
import TcErrorBoundary from "../components/TcErrorBoundary";
import {Accordion, Container, Form, Row, Col, InputGroup, Button} from "react-bootstrap";
import Scan from "./Scan";
import NetFilter from "../components/NetFilter";
import {TcConfigQuery} from "../components/TcConfigQuery";
import axios from "axios";
import {useErrorHandler} from "react-error-boundary";

export default function SingleStategy() {
  const [scanPanels, setScanPanels] = React.useState([0]);
  const [executing, setExecuting] = React.useState(false);
  const [gIfaces, setGIfaces] = React.useState();
  const handleError = useErrorHandler();

  // Update whether it has ifb interface.
  React.useEffect(() => {
    if (!setGIfaces) return;

    axios.get('/tc/api/v1/init').then(res => {
      const data = res?.data?.data;
      console.log(`TC: Init ok, ${JSON.stringify(data)}`);
      setGIfaces(data?.ifaces);
    }).catch(handleError);
  }, [handleError, setGIfaces]);

  // For callback to update state, because in callback we can only get the copy, so we need a ref to point to the latest
  // copy of state of variant objects.
  const ref = React.useRef({});
  React.useEffect(() => {
    ref.current.scanPanels = scanPanels;
  }, [scanPanels]);

  const appendNewScan = React.useCallback(() => {
    setScanPanels([ref.current.scanPanels.length, ...ref.current.scanPanels]);
  }, [setScanPanels, ref]);

  return <TcErrorBoundary>
    <Container fluid={true}>
      <TcErrorBoundary>
        <SingleStategySetting/>
        <p/>
        {scanPanels?.length && scanPanels.map(e => {
          return <React.Fragment key={e}>
            <Scan
              appendNewScan={appendNewScan}
              executing={executing}
              setExecuting={setExecuting}
              gIfaces={gIfaces}
            />
            <p/>
          </React.Fragment>;
        })}
      </TcErrorBoundary>
    </Container>
  </TcErrorBoundary>;
}

function SingleStategySetting() {
  const [executing, setExecuting] = React.useState(false);
  const [refresh, setRefresh] = React.useState(0);
  const [validated, setValidated] = React.useState(false);
  const handleError = useErrorHandler();

  const [iface, setIface] = React.useState();
  const [protocol, setProtocol] = React.useState();
  const [direction, setDirection] = React.useState();
  const [identifyKey, setIdentifyKey] = React.useState();
  const [identifyValue, setIdentifyValue] = React.useState();
  const [strategy, setStrategy] = React.useState();
  const [loss, setLoss] = React.useState();
  const [delay, setDelay] = React.useState();
  const [rate, setRate] = React.useState();
  const [delayDistro, setDelayDistro] = React.useState();

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

  // When user change filters.
  const updateFilter = React.useCallback((iface, protocol, direction, identifyKey, identifyValue) => {
    setIface(iface);
    setProtocol(protocol);
    setDirection(direction);
    setIdentifyKey(identifyKey);
    setIdentifyValue(identifyValue);
    console.log(`update filter iface=${iface}, protocol=${protocol}, direction=${direction}, identify=${identifyKey}/${identifyValue}`)
  }, [setIface, setProtocol, setDirection, setIdentifyKey, setIdentifyValue]);

  // When user change strategy.
  const updateStategy = React.useCallback((strategy, loss, delay, rate, delayDistro) => {
    if (delayDistro && Number(delayDistro) > Number(delay)) return alert(`延迟抖动${delayDistro}不能大于延迟${delay}`);

    setStrategy(strategy);
    setLoss(loss);
    setDelay(delay);
    setRate(rate);
    setDelayDistro(delayDistro);
    console.log(`update strategy strategy=${strategy}, loss=${loss}, delay=${delay}, rate=${rate}, delayDistro=${delayDistro}`);
  }, [setStrategy, setLoss, setDelay, setRate]);

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
    if (delayDistro && Number(delayDistro) > Number(delay)) {
      setValidated(true);
      return alert(`延迟抖动${delayDistro}不能大于延迟${delay}`);
    }

    setExecuting(true);
    const queries = [
      iface ? `iface=${iface}` : null,
      protocol ? `protocol=${protocol}` : null,
      direction ? `direction=${direction}` : null,
      identifyKey ? `identifyKey=${identifyKey}` : null,
      identifyValue ? `identifyValue=${identifyValue}` : null,
      strategy ? `strategy=${strategy}` : null,
      loss && strategy === 'loss' ? `loss=${loss}` : null,
      delay && strategy === 'delay' ? `delay=${delay}` : null,
      rate && strategy === 'rate' ? `rate=${rate}` : null,
      delayDistro && strategy === 'delay' ? `delayDistro=${delayDistro}` : null,
      `api=${window.location.port}`,
    ].filter(e => e);
    axios.get(`/tc/api/v1/config/setup?${queries.join('&')}`).then(res => {
      const conf = res?.data?.data;
      console.log(`query ok, ${queries.join(', ')}, conf=${JSON.stringify(conf)}`);
    }).catch(handleError).finally(async () => {
      setRefresh(ref.current.refresh + 1);
      await new Promise(resolve => setTimeout(resolve, 300));
      setExecuting(false);
    });
  }, [iface, protocol, direction, identifyKey, identifyValue, strategy, loss, delay, rate, delayDistro, handleError, setExecuting, ref, setRefresh]);

  return <Accordion defaultActiveKey="0">
    <Accordion.Item eventKey="0">
      <Accordion.Header>网络丢包设置</Accordion.Header>
      <Accordion.Body>
        <Form noValidate validated={validated}>
          <Row>
            <Col xs='auto'>
              <NetFilter onChange={updateFilter} gIfaces={gIfaces}/>
            </Col>
          </Row>
          <Row>
            <Col xs='auto'>
              <StrategySetting onChange={updateStategy}/>
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

function StrategySetting({onChange}) {
  const [strategy, setStrategy] = React.useState('loss');
  const [loss, setLoss] = React.useState('1');
  const [delay, setDelay] = React.useState('1');
  const [rate, setRate] = React.useState('1000000');
  const [delayDistro, setDelayDistro] = React.useState();

  React.useEffect(() => {
    onChange && onChange(strategy, loss, delay, rate, delayDistro);
  }, [strategy, loss, delay, rate, delayDistro, onChange]);

  return <Row>
    <Col xs='auto'>
      <Form.Group className="mb-3">
        <Form.Label><b>策略</b></Form.Label>
        <Form.Text> * 设置弱网策略</Form.Text>
        <InputGroup hasValidation>
          <Form.Select required defaultValue={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="">--请选择--</option>
            <option value="loss">丢包</option>
            <option value="delay">延迟</option>
            <option value="rate">限带宽</option>
          </Form.Select>
          <Form.Control.Feedback type='invalid' tooltip>请选择弱网策略</Form.Control.Feedback>
        </InputGroup>
      </Form.Group>
    </Col>
    {strategy === 'loss' && <Col xs='auto'>
      <Form.Group className="mb-3">
        <Form.Label><b>丢包率</b></Form.Label>
        <Form.Text> * 随机丢包率</Form.Text>
        <InputGroup className="mb-3">
          <InputGroup.Text>百分之</InputGroup.Text>
          <Form.Select defaultValue={loss} onChange={(e) => setLoss(e.target.value)}>
            {[1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 95, 100].map((e, index) => {
              return <option value={e} key={index}>{e}</option>;
            })}
          </Form.Select>
          <InputGroup.Text>%</InputGroup.Text>
        </InputGroup>
      </Form.Group>
    </Col>}
    {strategy === 'delay' && <Col xs='auto'>
      <Form.Group className="mb-3">
        <Form.Label><b>延迟</b></Form.Label>
        <Form.Text> * 网络延迟</Form.Text>
        <InputGroup className="mb-3">
          <Form.Select defaultValue={delay} onChange={(e) => setDelay(e.target.value)}>
            {[1, 10, 25, 50, 100, 200, 500, 1000, 3000].map((e, index) => {
              return <option value={e} key={index}>{e}</option>;
            })}
          </Form.Select>
          <InputGroup.Text>ms</InputGroup.Text>
        </InputGroup>
      </Form.Group>
    </Col>}
    {strategy === 'delay' && <Col xs='auto'>
      <Form.Group className="mb-3">
        <Form.Label><b>延迟抖动</b></Form.Label>
        <Form.Text> * 可选, 延迟区间为[{Number(delay)-Number(delayDistro || 0)}, {Number(delay)+Number(delayDistro || 0)}]正态分布</Form.Text>
        <InputGroup className="mb-3">
          <Form.Control
            required type="input" placeholder={`请输入抖动的的值`}
            onChange={(e) => setDelayDistro(e.target.value)}
          />
          <InputGroup.Text>ms</InputGroup.Text>
        </InputGroup>
      </Form.Group>
    </Col>}
    {strategy === 'rate' && <Col xs='auto'>
      <Form.Group className="mb-3">
        <Form.Label><b>带宽</b></Form.Label>
        <Form.Text> * 目标带宽</Form.Text>
        <InputGroup className="mb-3">
          <Form.Select defaultValue={rate} onChange={(e) => setRate(e.target.value)}>
            {[1, 10, 100, 300, 500, 800, 1200, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 30000, 100000, 1000000].map((e, index) => {
              return <option value={e} key={index}>{e ? e : '不限'}</option>;
            })}
          </Form.Select>
          <InputGroup.Text>Kbps</InputGroup.Text>
        </InputGroup>
      </Form.Group>
    </Col>}
  </Row>;
}
