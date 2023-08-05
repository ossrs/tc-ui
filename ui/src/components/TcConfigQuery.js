import React from "react";
import {Toast} from "react-bootstrap";
import axios from "axios";
import {useErrorHandler} from "react-error-boundary";
import * as Icon from 'react-bootstrap-icons';

export function TcConfigQuery({iface, forceRefresh}) {
  const [tcConfig, setTcConfig] = React.useState();
  const [selfRefresh, setSelfRefresh] = React.useState(0);
  const [executing, setExecuting] = React.useState(false);
  const handleError = useErrorHandler();

  // When iface changing, refresh the tc configuration.
  React.useEffect(() => {
    if (!iface) {
      setTcConfig(null);
      return;
    }

    setExecuting(true);

    axios.get(`/tc/api/v1/config/query?iface=${iface}`).then(res => {
      const conf = res?.data?.data;
      setTcConfig(conf);
      console.log(`query ok, iface=${iface}, force=${forceRefresh}, self=${selfRefresh}, conf=${JSON.stringify(conf)}`);
    }).catch(handleError).finally(async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      setExecuting(false);
    });
  }, [iface, forceRefresh, selfRefresh, handleError, setTcConfig, setExecuting]);

  return <Toast>
    <Toast.Header closeButton={false}>
      <strong className="me-auto">网卡{iface}: 网络设置</strong>
      <small>{tcConfig?.cmd}</small> &nbsp; &nbsp;
      {!executing &&
        <div role='button' style={{display: 'inline-block'}} title='更换流名称'>
          <Icon.ArrowRepeat size={23} onClick={(e) => setSelfRefresh(selfRefresh + 1)}/>
        </div>
      }
    </Toast.Header>
    <Toast.Body>
      <pre>{tcConfig?.output}</pre>
    </Toast.Body>
  </Toast>;
}