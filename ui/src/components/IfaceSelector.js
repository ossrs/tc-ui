import React from "react";
import {Form, InputGroup, Button} from "react-bootstrap";
import {Utils} from "../utils";

export default function IfaceSelector({onIfaceChange, appendNewScan, gIfaces}) {
  const [ifaces, setIfaces] = React.useState({});
  const [currentSelected, setCurrentSelected] = React.useState();

  // For callback to update state, because in callback we can only get the copy, so we need a ref to point to the latest
  // copy of state of variant objects.
  const ref = React.useRef({});
  React.useEffect(() => {
    ref.current.ifaces = ifaces;
  }, [ifaces]);

  const onClick = React.useCallback((item, checked) => {
    const modules = Utils.copy(ref.current.ifaces, [item, checked]);
    setIfaces(modules);
    setCurrentSelected(checked ? item : null);
    onIfaceChange && onIfaceChange(modules);
  }, [ref, setIfaces, onIfaceChange, setCurrentSelected]);

  const onAppendNewScan = React.useCallback(() => {
    appendNewScan && appendNewScan();
  }, [appendNewScan]);

  return <Form.Group className="mb-3">
    <Form.Label><b>网卡选择</b></Form.Label>
    <Form.Text>
      * 请选择需要扫描的网卡，只能选一个，若需要扫描多个网卡，
    </Form.Text>
    <Button variant="link" size='sm' onClick={(e) => onAppendNewScan()}>可以点这里</Button>
    <InputGroup>
      {gIfaces?.map(iface => {
        if (iface?.name?.indexOf('ifb') >= 0) return <React.Fragment key={iface?.name}/>;
        return (
          <Form.Group key={iface?.name} className="mb-3" controlId={`formWxEnabledCheckbox-${iface.name}`}>
            <Form.Check
              type="switch"
              label={iface?.ipv4 ? `${iface?.name}(${iface?.ipv4})` : iface?.name}
              inline defaultChecked={ifaces[iface?.name]}
              onChange={(e) => onClick(iface?.name, e.target.checked)}
              disabled={currentSelected && currentSelected !== iface?.name}
              title={`ipv4: ${iface?.ipv4}, ipv6: ${iface?.ipv6}`}
            />
          </Form.Group>
        );
      })}
    </InputGroup>
  </Form.Group>;
}