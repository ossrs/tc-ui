import React from "react";
import {Container} from "react-bootstrap";
import {Navbar, Nav} from 'react-bootstrap';
import {Link, useLocation} from "react-router-dom";

export default function Navigator() {
  const [activekey, setActiveKey] = React.useState(1);
  const [navs, setNavs] = React.useState([]);
  const location = useLocation();

  React.useEffect(() => {
    const r0 = `${location.pathname}${location.search}`;
    setNavs([
      {eventKey: '1', to: `/tc/p/SingleStategy`, text: '简单弱网'},
      {eventKey: '2', to: `/tc/p/ComplexStategy`, text: '组合弱网'},
    ].map(e => {
      if (r0.indexOf(e.to) >= 0) {
        e.className = 'text-light';
        setActiveKey(e.eventKey);
      }
      return e;
    }));
  }, [location]);

  return <>
    <Navbar>
      <Container className={{color: '#fff'}}>
        <Navbar.Brand>TC-WebUI</Navbar.Brand>
        <Nav className='me-auto' variant="pills" activeKey={activekey}>
          {navs.map((e, index) => {
            return (
              <Nav.Link
                as={Link}
                eventKey={e.eventKey}
                to={e.to}
                key={index}
                className={e.className}
              >
                {e.text}
              </Nav.Link>
            );
          })}
        </Nav>
      </Container>
    </Navbar>
  </>;
}

