import React from "react";
import {Form, Row, Col, InputGroup} from "react-bootstrap";

export function StrategySetting({
    strategy, setStrategy, loss, setLoss, delay, setDelay, rate, setRate, delayDistro, setDelayDistro,
  }) {
  return <Row>
    <Col xs='auto'>
      <Form.Group className="mb-3">
        <Form.Label><b>策略</b></Form.Label>
        <Form.Text> * 设置弱网策略</Form.Text>
        <InputGroup hasValidation>
          <Form.Select required defaultValue={strategy} onChange={(e) => setStrategy(e.target.value)}>
            <option value="no">--请选择--</option>
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
            {[1, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90, 95, 100].map((e, index) => {
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
            {[1, 5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 80, 90, 100, 130, 150, 200, 500, 1000, 3000].map((e, index) => {
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
          <Form.Control defaultValue={delayDistro}
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
            {[1, 10, 100, 300, 500, 800, 900, 1000, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2500, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 15000, 30000, 50000, 100000, 1000000].map((e, index) => {
              return <option value={e} key={index}>{e ? e : '不限'}</option>;
            })}
          </Form.Select>
          <InputGroup.Text>Kbps</InputGroup.Text>
        </InputGroup>
      </Form.Group>
    </Col>}
  </Row>;
}
