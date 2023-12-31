import React from "react";
import {Col, Form, InputGroup, Row} from "react-bootstrap";

export default function NetFilter({gIfaces,
    iface, setIface, protocol, setProtocol, direction,
    setDirection, identifyKey, setIdentifyKey, identifyValue, setIdentifyValue,
  }) {
  const [ivVisible, setIvVisible] = React.useState(false);
  const [ivLabel, setIvLabel] = React.useState('IP');

  React.useEffect(() => {
    const nv = identifyKey;
    setIvVisible(nv === "serverPort" || nv === "clientPort" || nv === "clientIp");
    setIvLabel(nv === "clientIp" ? 'IP' : '端口');
  }, [identifyKey, setIvVisible, setIvLabel]);

  const updateIdentify = React.useCallback((e) => {
    const nv = e.target.value;
    setIdentifyKey(nv);
    setIvVisible(nv === "serverPort" || nv === "clientPort" || nv === "clientIp");
    setIvLabel(nv === "clientIp" ? 'IP' : '端口');
  }, [setIdentifyKey, setIvLabel, setIvVisible]);

  return (
    <Row>
      <Col xs='auto'>
        <Form.Group className="mb-3">
          <Form.Label><b>网卡</b></Form.Label>
          <Form.Text> * 对指定网卡生效</Form.Text>
          <InputGroup hasValidation>
            <Form.Select required defaultValue={iface} onChange={(e) => setIface(e.target.value)}>
              <option value="">--请选择--</option>
              {gIfaces?.map(iface => {
                if (iface?.name?.indexOf('ifb') >= 0) return <React.Fragment key={iface.name}/>;
                return <option key={iface.name} value={iface.name}>{iface.name}</option>;
              })}
            </Form.Select>
            <Form.Control.Feedback type='invalid' tooltip>请选择网卡</Form.Control.Feedback>
          </InputGroup>
        </Form.Group>
      </Col>
      <Col xs='auto'>
        <Form.Group className="mb-3">
          <Form.Label><b>网络协议</b></Form.Label>
          <Form.Text> * 对指定协议生效</Form.Text>
          <InputGroup hasValidation>
            <Form.Select required defaultValue={protocol} onChange={(e) => setProtocol(e.target.value)}>
              <option value="">--请选择--</option>
              <option value="ip">IP</option>
            </Form.Select>
            <Form.Control.Feedback type='invalid' tooltip>请选择协议</Form.Control.Feedback>
          </InputGroup>
        </Form.Group>
      </Col>
      <Col xs='auto'>
        <Form.Group className="mb-3">
          <Form.Label><b>流量方向</b></Form.Label>
          <Form.Text> * 流入或流出</Form.Text>
          <InputGroup hasValidation>
            <Form.Select required defaultValue={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="">--请选择--</option>
              <option value="incoming">流入(incoming), 发数据到这个设备</option>
              <option value="outgoing">流出(outgoing), 从该设备接收数据</option>
            </Form.Select>
            <Form.Control.Feedback type='invalid' tooltip>请选择客户端类型</Form.Control.Feedback>
          </InputGroup>
        </Form.Group>
      </Col>
      <Col xs='auto'>
        <Form.Group className="mb-3">
          <Form.Label><b>过滤器</b></Form.Label>
          <Form.Text> * 按特定标识加弱网</Form.Text>
          <InputGroup hasValidation>
            <Form.Select required defaultValue={identifyKey} onChange={updateIdentify}>
              <option value="">--请选择--</option>
              <option value="serverPort">按本设备端口</option>n>
              <option value="clientIp">按对方设备IP</option>n>
              <option value="clientPort">按对方设备端口</option>
              <option value="all">匹配所有</option>
            </Form.Select>
            <Form.Control.Feedback type='invalid' tooltip>请选择弱网标识</Form.Control.Feedback>
          </InputGroup>
        </Form.Group>
      </Col>
      {ivVisible &&
        <Col xs='auto'>
          <Form.Group className="mb-3">
            <Form.Label><b>按{ivLabel}</b></Form.Label>
            <Form.Text> * 请输入{ivLabel}</Form.Text>
            <InputGroup hasValidation>
              <Form.Control
                required type="input" placeholder={`请输入匹配的${ivLabel}`} defaultValue={identifyValue}
                onChange={(e) => setIdentifyValue(e.target.value)}
              />
              <Form.Control.Feedback type='invalid' tooltip>请输入{ivLabel}</Form.Control.Feedback>
            </InputGroup>
          </Form.Group>
        </Col>
      }
    </Row>
  );
}
