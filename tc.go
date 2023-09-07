package main

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"
	"io/ioutil"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

var isDarwin bool

func init() {
	ctx := logger.WithContext(context.Background())
	isDarwin = runtime.GOOS == "darwin"
	logger.Tf(ctx, "OS darwin=%v", isDarwin)
}

func ScanByTcpdump(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	ifaces, timeout, exp := q.Get("ifaces"), q.Get("timeout"), q.Get("exp")
	if ifaces == "" {
		return errors.Errorf("no iface, url=%v", r.RequestURI)
	}
	if strings.Contains(ifaces, ",") {
		return errors.Errorf("only support single interface, ifaces=%v", ifaces)
	}
	if timeout == "" {
		return errors.Errorf("no timeout, url=%v", r.RequestURI)
	}
	if exp == "" {
		exp = "ip"
	}

	var to time.Duration
	if tov, err := strconv.ParseInt(timeout, 10, 64); err != nil {
		return errors.Wrapf(err, "parse timeout=%v", timeout)
	} else {
		to = time.Duration(tov) * time.Second
	}

	if to <= time.Duration(0) {
		return errors.Errorf("invalid timeout=%v, should >0s", timeout)
	}
	if to > time.Duration(60)*time.Second {
		return errors.Errorf("invalid timeout=%v, should <=60s", timeout)
	}

	ctx, cancel := context.WithCancel(logger.WithContext(context.Background()))
	defer cancel()
	logger.Tf(ctx, "Scan start, ifaces=%v, timeout=%v, exp=%v", ifaces, to, exp)

	go func() {
		select {
		case <-ctx.Done():
		case <-time.After(to):
			logger.Tf(ctx, "Scan finished for to=%v", to)
			cancel()
		}
	}()

	// -i interface
	// -n     Don't convert addresses (i.e., host addresses, port numbers, etc.) to names.
	// -tt    Print the timestamp, as seconds since January 1, 1970, 00:00:00, UTC, and fractions of a second since that time, on each dump line.
	args := []string{"-i", ifaces, "-n", "-tt", "--immediate-mode", "-l", exp}
	cmd := exec.CommandContext(context.Background(), "tcpdump", args...)
	logger.Tf(ctx, "tcpdump %v", strings.Join(args, " "))

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return errors.Wrapf(err, "pipe stdout")
	}
	defer stdout.Close()

	if err := cmd.Start(); err != nil {
		return errors.Wrapf(err, "start")
	}

	go func() {
		// Kill process if context is canceled
		<-ctx.Done()
		cmd.Process.Kill()
		logger.Tf(ctx, "Scan canceled, kill tcpdump %v", cmd.Process.Pid)
	}()

	summary := NewTcpdumpSummary()
	if s := bufio.NewScanner(stdout); true {
		for s.Scan() {
			line := s.Text()
			l, ok := parseTcpdumpLine(line)
			if !ok {
				continue
			}
			summary.OnPacket(l)
		}
	}
	logger.Tf(ctx, "Scan finished")

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != context.Canceled {
			return errors.Wrapf(err, "wait cmd ctx=%v", ctx.Err())
		}
	}

	for _, iface := range summary.Interfaces {
		sort.Slice(iface.Endpoints, func(i, j int) bool {
			return iface.Endpoints[i].Packets > iface.Endpoints[j].Packets
		})
	}

	logger.Tf(ctx, "Scan ok, ifaces=%v, %v", ifaces, summary.String())
	ohttp.WriteData(ctx, w, r, summary)
	return nil
}

func TcQuery(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	iface := r.URL.Query().Get("iface")
	if iface == "" {
		return errors.New("no iface")
	}
	logger.Tf(ctx, "Start query for iface=%v", iface)

	var output string
	var args []string
	if !isDarwin {
		args = []string{iface}
		if b, err := exec.CommandContext(ctx, "tcshow", args...).Output(); err != nil {
			return errors.Wrapf(err, "exec tcshow %v", strings.Join(args, " "))
		} else {
			logger.Tf(ctx, "tcshow %v", strings.Join(args, " "))
			output = strings.TrimSpace(string(b))
		}
	}

	logger.Tf(ctx, "Query TC for iface=%v, args=%v, %v", iface, args, output)
	ohttp.WriteData(ctx, w, r, &struct {
		Cmd    string `json:"cmd"`
		Output string `json:"output"`
	}{
		Cmd:    strings.Join(append([]string{"ts"}, args...), " "),
		Output: output,
	})
	return nil
}

func TcReset(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	iface := r.URL.Query().Get("iface")
	if iface == "" {
		return errors.New("no iface")
	}
	logger.Tf(ctx, "Start reset for iface=%v", iface)

	if !isDarwin {
		args := []string{"--all", iface}
		if b, err := exec.CommandContext(ctx, "tcdel", args...).CombinedOutput(); err != nil {
			return errors.Wrapf(err, "tcdel %v", strings.Join(args, " "))
		} else if bs := string(b); len(bs) > 0 {
			nnErrors := strings.Count(bs, "ERROR")

			// Ignore the error because it always happens:
			// 		tc qdisc del dev lo ingress
			// 		Error: Invalid handle.
			isIngressDel := strings.Contains(bs, "ingress") && strings.Contains(bs, "qdisc del")
			canIgnore := nnErrors == 1 && isIngressDel

			if nnErrors > 0 && !canIgnore {
				return errors.Errorf("tcdel %v, %v", strings.Join(args, " "), bs)
			}
			logger.Tf(ctx, "tcdel %v, error=%v, ingress=%v, ignore=%v, %v",
				strings.Join(args, " "), nnErrors, isIngressDel, canIgnore, bs)
		} else {
			logger.Tf(ctx, "tcdel %v", strings.Join(args, " "))
		}
	}

	logger.Tf(ctx, "Reset TC for iface=%v", iface)
	ohttp.WriteData(ctx, w, r, nil)
	return nil
}

func TcSetup(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	opts := &NetworkOptions{
		iface: q.Get("iface"), protocol: q.Get("protocol"), direction: q.Get("direction"),
		identifyKey: q.Get("identifyKey"), identifyValue: q.Get("identifyValue"),
		strategy: q.Get("strategy"), loss: q.Get("loss"), delay: q.Get("delay"),
		rate: q.Get("rate"), apiPort: strings.Trim(os.Getenv("API_LISTEN"), ":"),
		delayDistro: q.Get("delayDistro"),
	}
	if q.Get("api") != "" {
		opts.apiPort = q.Get("api")
	}
	if err := opts.Execute(ctx); err != nil {
		return err
	}

	logger.Tf(ctx, "Setup TC for iface=%v", opts.iface)
	ohttp.WriteData(ctx, w, r, nil)
	return nil
}

func TcSetup2(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	opts := &NetworkOptions{
		iface: q.Get("iface"), protocol: q.Get("protocol"), direction: q.Get("direction"),
		identifyKey: q.Get("identifyKey"), identifyValue: q.Get("identifyValue"),
		apiPort:  strings.Trim(os.Getenv("API_LISTEN"), ":"),
		strategy: q.Get("strategy"), loss: q.Get("loss"), delay: q.Get("delay"),
		rate: q.Get("rate"), delayDistro: q.Get("delayDistro"),
		strategy2: q.Get("strategy2"), loss2: q.Get("loss2"), delay2: q.Get("delay2"),
		rate2: q.Get("rate2"), delayDistro2: q.Get("delayDistro2"),
	}
	if q.Get("api") != "" {
		opts.apiPort = q.Get("api")
	}
	if err := opts.Execute(ctx); err != nil {
		return err
	}

	logger.Tf(ctx, "Setup2 TC for iface=%v", opts.iface)
	ohttp.WriteData(ctx, w, r, nil)
	return nil
}

func TcRaw(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	cmd := q.Get("cmd")

	defer r.Body.Close()
	if b, err := ioutil.ReadAll(r.Body); err != nil {
		return errors.Wrapf(err, "read body")
	} else if len(b) > 0 {
		cmd = string(b)
	}
	logger.Tf(ctx, "Start raw cmd=%v", cmd)

	args := strings.Split(cmd, " ")
	if len(args) == 0 {
		return errors.New("no cmd")
	}

	arg0 := args[0]
	switch arg0 {
	case "tcset", "tcshow", "tcdel":
	default:
		return errors.Errorf("invalid cmd %v", cmd)
	}

	if b, err := exec.CommandContext(ctx, arg0, args[1:]...).Output(); err != nil {
		return errors.Wrapf(err, "exec %v", strings.Join(args, " "))
	} else if len(b) == 0 {
		logger.Tf(ctx, "exec %v ok", cmd)
		ohttp.WriteData(ctx, w, r, nil)
	} else {
		logger.Tf(ctx, "exec %v output %v", cmd, string(b))

		var res interface{}
		if err := json.Unmarshal(b, &res); err != nil {
			return errors.Wrapf(err, "unmarshal %v", string(b))
		}

		ohttp.WriteData(ctx, w, r, res)
	}

	return nil
}

func TcInit(ctx context.Context, w http.ResponseWriter, r *http.Request) error {
	ifaces, err := queryIPNetInterfaces(nil)
	if err != nil {
		return errors.Wrapf(err, "query ifaces")
	}

	ohttp.WriteData(ctx, w, r, &struct {
		Ifaces []*TcInterface `json:"ifaces,omitempty"`
	}{
		ifaces,
	})
	return nil
}

// TcUI serves the UI static files.
// If development and reactjsEP is not empty, proxy to react development server.
func TcUI(ctx context.Context, reactjsEP string) http.HandlerFunc {
	sfs := http.FileServer(http.Dir("./ui/build"))
	proxy := httputil.ReverseProxy{
		Director: func(r *http.Request) {
			r.URL.Scheme = "http"
			r.URL.Host = reactjsEP
		},
	}

	return func(w http.ResponseWriter, r *http.Request) {
		// For development, proxy to react development server.
		if os.Getenv("NODE_ENV") == "development" && reactjsEP != "" {
			proxy.ServeHTTP(w, r)
			return
		}

		// Directly serve the react routes by index.html
		// See https://stackoverflow.com/a/52464577/17679565
		if strings.HasPrefix(r.URL.Path, "/tc/p/") {
			http.ServeFile(w, r, "./ui/build/index.html")
			return
		}

		// Remove the prefix /tc/ if not api.
		if !strings.HasPrefix(r.URL.Path, "/tc/api/") {
			r.URL.Path = strings.TrimPrefix(r.URL.Path, "/tc")
		}

		// Serve react static files.
		sfs.ServeHTTP(w, r)
	}
}

type NetworkOptions struct {
	// The interface name to set the network condition.
	iface string
	// The protocol to set, UDP or TCP.
	protocol string
	// The direction, publisher for incoming, player for outgoing.
	direction string
	// The filter to identify, by ip or port.
	identifyKey, identifyValue string
	// The network strategy name.
	strategy, strategy2 string
	// If strategy is loss, the loss rate in %.
	loss, loss2 string
	// If strategy is delay, the delay in ms.
	delay, delay2 string
	// If delayDistro is not empty, it's the delay-distro in ms.
	delayDistro, delayDistro2 string
	// If strategy is rate, the bitrate limit in kbps.
	rate, rate2 string
	// The api listen port, which should be excluded from the network condition.
	apiPort string
}

func (v *NetworkOptions) Execute(ctx context.Context) error {
	if v.iface == "" {
		return errors.New("no iface")
	}
	if v.protocol == "" {
		return errors.New("no protocol")
	}
	if v.direction == "" {
		return errors.New("no direction")
	}
	if v.direction != "incoming" && v.direction != "outgoing" {
		return errors.Errorf("invalid direction=%v", v.direction)
	}
	if v.identifyKey == "" {
		return errors.New("no identifyKey")
	}
	if v.identifyKey != "all" && v.identifyValue == "" {
		return errors.Errorf("no identifyValue for identifyKey=%v", v.identifyKey)
	}
	if v.identifyKey != "all" && v.identifyKey != "serverPort" && v.identifyKey != "clientPort" && v.identifyKey != "clientIp" {
		return errors.Errorf("invalid identifyKey=%v", v.identifyKey)
	}
	if v.strategy == "" && v.strategy2 == "" {
		return errors.New("no strategy")
	}
	if v.strategy == v.strategy2 {
		return errors.Errorf("duplicated strategy %v", v.strategy)
	}
	if (v.strategy == "loss" && v.loss == "") || (v.strategy2 == "loss" && v.loss2 == "") {
		return errors.New("no loss")
	}
	if (v.strategy == "delay" && v.delay == "") || (v.strategy2 == "delay" && v.delay2 == "") {
		return errors.New("no delay")
	}
	if (v.strategy == "rate" && v.rate == "") || (v.strategy2 == "rate" && v.rate2 == "") {
		return errors.New("no rate")
	}
	logger.Tf(ctx, "Setup network for darwin=%v, iface=%v, protocol=%v, direction=%v, identify=%v/%v, "+
		"strategy=%v, loss=%v, delay=%v, rate=%v, delayDistro=%v, strategy2=%v, loss2=%v, delay2=%v, rate2=%v, "+
		"delayDistro2=%v",
		isDarwin, v.iface, v.protocol, v.direction, v.identifyKey, v.identifyKey, v.strategy, v.loss,
		v.delay, v.rate, v.delayDistro, v.strategy2, v.loss2, v.delay2, v.rate2, v.delayDistro2,
	)

	// Ignore if the os is darwin because it doesn't support it yet.
	if isDarwin {
		logger.Tf(ctx, "Darwin: Ignore network setup")
		return nil
	}

	// Format the shaping algorithm. We use HTB which doesn't require iptables.
	args := []string{
		// Overwrite existing traffic shaping rules.
		"--overwrite",
		// Use HTB which doesn't require iptables.
		"--shaping-algo", "htb",
	}

	// For direction outgoing, client pull stream from server.
	if v.direction == "outgoing" {
		args = append(args,
			"--direction", "outgoing",
			"--exclude-src-port", v.apiPort, // Exclude the API port.
		)
		if v.identifyKey == "serverPort" {
			args = append(args, "--src-port", v.identifyValue)
		} else if v.identifyKey == "clientIp" {
			args = append(args, "--dst-network", v.identifyValue)
		} else if v.identifyKey == "clientPort" {
			args = append(args, "--dst-port", v.identifyValue)
		}
	}

	// For direction incoming, client push stream to server.
	if v.direction == "incoming" {
		args = append(args,
			"--direction", "incoming",
			"--exclude-dst-port", v.apiPort, // Exclude the API port.
		)
		if v.identifyKey == "serverPort" {
			args = append(args, "--dst-port", v.identifyValue)
		} else if v.identifyKey == "clientIp" {
			args = append(args, "--src-network", v.identifyValue)
		} else if v.identifyKey == "clientPort" {
			args = append(args, "--src-port", v.identifyValue)
		}
	}

	// Build the first strategy.
	buildStrategyArgs := func(args []string, strategy, loss, delay, rate, delayDistro string) []string {
		// Ignore empty strategy.
		if strategy == "" {
			return args
		}

		// Format the network strategy, that is, loss, delay, rate.
		if strategy == "loss" {
			args = append(args, "--loss", fmt.Sprintf("%v%%", loss))
		} else if strategy == "delay" {
			args = append(args, "--delay", fmt.Sprintf("%vms", delay))
		} else if strategy == "rate" {
			// Note that tc is in kbit, while tcset is in kbps.
			args = append(args, "--rate", fmt.Sprintf("%vkbps", rate))
		}

		// Append other arguments.
		if delayDistro != "" {
			args = append(args, "--delay-distro", fmt.Sprintf("%v", delayDistro))
		}
		return args
	}
	args = buildStrategyArgs(args, v.strategy, v.loss, v.delay, v.rate, v.delayDistro)
	args = buildStrategyArgs(args, v.strategy2, v.loss2, v.delay2, v.rate2, v.delayDistro2)

	args = append(args, v.iface)
	if b, err := exec.CommandContext(ctx, "tcset", args...).CombinedOutput(); err != nil {
		return errors.Wrapf(err, "tcset %v", strings.Join(args, " "))
	} else if bs := string(b); len(bs) > 0 {
		nnErrors := strings.Count(bs, "ERROR")

		// Ignore the error because it always happens:
		// 		tc qdisc del dev lo ingress
		// 		Error: Invalid handle.
		isIngressDel := strings.Contains(bs, "ingress") && strings.Contains(bs, "qdisc del")
		canIgnore := nnErrors == 1 && isIngressDel

		if nnErrors > 0 && !canIgnore {
			return errors.Errorf("tcset %v, %v", strings.Join(args, " "), bs)
		}
		logger.Tf(ctx, "tcset %v, error=%v, ingress=%v, ignore=%v, %v",
			strings.Join(args, " "), nnErrors, isIngressDel, canIgnore, bs)
	} else {
		logger.Tf(ctx, "tcset %v", strings.Join(args, " "))
	}
	return nil
}

type TcpdumpEndpoint struct {
	// The protocol family, TCP or UDP.
	Family TcProtocolFamily `json:"family"`
	// The source and dest IP address.
	Source      TcIP `json:"source,omitempty"`
	Destination TcIP `json:"dest,omitempty"`
	// The source and dest TCP/UDP port.
	SourcePort uint16 `json:"sport,omitempty"`
	DestPort   uint16 `json:"dport,omitempty"`
	// The number of packets.
	Packets uint64 `json:"packets"`
	// The total bytes.
	Bytes uint64 `json:"bytes"`
}

func (v *TcpdumpEndpoint) Endpoint() string {
	return fmt.Sprintf("%v, %v:%v, %v:%v", v.Family, v.Source.String(), v.SourcePort, v.Destination.String(), v.DestPort)
}

type TcpdumpInterfaceSummary struct {
	// Network interface.
	Interface *TcInterface `json:"iface,omitempty"`
	// Endpoints in kv.
	Endpoints []*TcpdumpEndpoint `json:"endpoints,omitempty"`

	// The enpoints in slice.
	endpoints map[string]*TcpdumpEndpoint `json:"endpoints,omitempty"`
}

func NewTcpdumpInterfaceSummary(iface *TcInterface) *TcpdumpInterfaceSummary {
	return &TcpdumpInterfaceSummary{
		Interface: iface, Endpoints: []*TcpdumpEndpoint{}, endpoints: map[string]*TcpdumpEndpoint{},
	}
}

func (v *TcpdumpInterfaceSummary) String() string {
	return fmt.Sprintf("iface=%v, endpoints=%v", v.Interface, len(v.Endpoints))
}

type TcpdumpSummary struct {
	// Start time.
	StartTime TcTime `json:"start,omitempty"`
	// End time.
	EndTime TcTime `json:"end,omitempty"`
	// Interfaces.
	Interfaces map[string]*TcpdumpInterfaceSummary `json:"ifaces,omitempty"`

	// Network interface. Key is ipv4 address.
	ipv4Interfaces map[string]*TcInterface
}

func NewTcpdumpSummary() *TcpdumpSummary {
	v := &TcpdumpSummary{
		Interfaces:     make(map[string]*TcpdumpInterfaceSummary),
		ipv4Interfaces: make(map[string]*TcInterface),
	}

	// Build the network interfaces metadata.
	interfaces, _ := queryIPNetInterfaces(nil)
	for _, iface := range interfaces {
		if iface.IPv4 != nil {
			v.ipv4Interfaces[iface.IPv4.String()] = iface
		}
	}

	return v
}

func (v *TcpdumpSummary) String() string {
	return fmt.Sprintf("start=%v, end=%v, ifaces=%v",
		v.StartTime, v.EndTime, len(v.Interfaces),
	)
}

func (v *TcpdumpSummary) OnPacket(p *TcpdumpLog) {
	// Ignore packet without any payload.
	if p.Length == 0 {
		return
	}

	// Ignore if no interface found.
	var tcInterface *TcInterface
	if iface, ok := v.ipv4Interfaces[p.Source.String()]; ok {
		tcInterface = iface
	} else if iface, ok = v.ipv4Interfaces[p.Destination.String()]; ok {
		tcInterface = iface
	} else {
		return
	}

	var ifaceSummary *TcpdumpInterfaceSummary
	if iface, ok := v.Interfaces[tcInterface.Name]; !ok {
		ifaceSummary = NewTcpdumpInterfaceSummary(tcInterface)
		v.Interfaces[tcInterface.Name] = ifaceSummary
	} else {
		ifaceSummary = iface
	}

	// Parse the start and end time.
	if time.Time(v.StartTime).IsZero() {
		v.StartTime, v.EndTime = TcTime(p.Timestamp), TcTime(p.Timestamp)
	}
	if time.Time(v.StartTime).After(p.Timestamp) {
		v.StartTime = TcTime(p.Timestamp)
	}
	if time.Time(v.EndTime).Before(p.Timestamp) {
		v.EndTime = TcTime(p.Timestamp)
	}

	// Build the endpoint and summary.
	pep := &TcpdumpEndpoint{
		Family: p.Family,
		Source: TcIP(p.Source), SourcePort: p.SourcePort,
		Destination: TcIP(p.Destination), DestPort: p.DestPort,
	}

	if ep, ok := ifaceSummary.endpoints[pep.Endpoint()]; !ok {
		ifaceSummary.endpoints[pep.Endpoint()] = pep
		ifaceSummary.Endpoints = append(ifaceSummary.Endpoints, pep)
	} else {
		pep = ep
	}

	pep.Packets++
	pep.Bytes += uint64(p.Length)
}

type TcpdumpLog struct {
	// The timestamp.
	Timestamp time.Time
	// The source and dest IP address.
	Source, Destination net.IP
	// The source and dest TCP/UDP port.
	SourcePort, DestPort uint16
	// The protocol family, TCP or UDP.
	Family TcProtocolFamily
	// The length of packet in bytes.
	Length int
}

// For example:
//
//		1675941530.517119 IP 10.72.6.42.54440 > 10.72.6.42.8000: UDP, length 88
//	 1675941503.166124 IP 10.99.245.232.443 > 10.72.6.42.58325: Flags [P.], seq 1205:1377, ack 16476, win 330, options [nop,nop,TS val 1265544348 ecr 1176955433], length 172
//	 1675941649.798584 IP 192.168.255.10 > 101.43.175.30: ICMP echo request, id 57083, seq 8, length 64
func parseTcpdumpLine(line string) (*TcpdumpLog, bool) {
	var timestamp float64
	var ssrc, sdst, label string
	fmt.Sscanf(line, "%f IP %s > %s %s", &timestamp, &ssrc, &sdst, &label)

	ssrc = strings.Trim(ssrc, ":")
	sdst = strings.Trim(sdst, ":")
	label = strings.Trim(label, ",")

	l := &TcpdumpLog{}
	var s0, s1, s2, s3, d0, d1, d2, d3 int
	fmt.Sscanf(ssrc, "%d.%d.%d.%d.%d", &s0, &s1, &s2, &s3, &l.SourcePort)
	fmt.Sscanf(sdst, "%d.%d.%d.%d.%d", &d0, &d1, &d2, &d3, &l.DestPort)
	if idx := strings.LastIndex(line, ", length "); idx > 0 {
		fmt.Sscanf(line[idx:], ", length %d", &l.Length)
	}

	if label == "UDP" {
		l.Family = ProtocolFamilyUDP
	} else if label == "Flags" {
		l.Family = ProtocolFamilyTCP
	} else if label == "ICMP" {
		l.Family = ProtocolFamilyICMP
	} else {
		return nil, false
	}

	l.Timestamp = time.Unix(0, int64(timestamp*1000*1000*1000))
	l.Source = net.IPv4(byte(s0), byte(s1), byte(s2), byte(s3))
	l.Destination = net.IPv4(byte(d0), byte(d1), byte(d2), byte(d3))
	return l, true
}

func queryIPNetInterfaces(filter func(iface *net.Interface, addr net.Addr) bool) ([]*TcInterface, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, errors.Wrapf(err, "query interfaces")
	}

	var targets []*TcInterface
	for _, iface := range ifaces {
		if (iface.Flags & net.FlagPointToPoint) == net.FlagPointToPoint {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			return nil, errors.Wrapf(err, "query addrs of %v", iface.Name)
		}

		ti := &TcInterface{Name: iface.Name}
		for _, addr := range addrs {
			if filter != nil {
				if ok := filter(&iface, addr); !ok {
					continue
				}
			}

			if r0, ok := addr.(*net.IPNet); ok {
				if ip := r0.IP.To4(); ip != nil {
					if os.Getenv("IFACE_FILTER_IPV4") != "false" {
						ti.IPv4 = TcIP(ip)
					}
				} else if ip := r0.IP.To16(); ip != nil {
					if os.Getenv("IFACE_FILTER_IPV6") != "false" {
						ti.IPv6 = TcIP(ip)
					}
				}
			}
		}
		if ti.IPv4 != nil || ti.IPv6 != nil {
			targets = append(targets, ti)
		}
	}

	return targets, nil
}

type TcTime time.Time

func (v TcTime) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf("\"%v\"", v.String())), nil
}

func (v TcTime) String() string {
	return time.Time(v).Format("2006-01-02T15:04:05.000Z07:00")
}

type TcIP net.IP

func (v TcIP) MarshalJSON() ([]byte, error) {
	return []byte(fmt.Sprintf("\"%v\"", v.String())), nil
}

func (v TcIP) String() string {
	return net.IP(v).String()
}

type TcInterface struct {
	// The name of interface.
	Name string `json:"name,omitempty"`
	// The ipv4 address.
	IPv4 TcIP `json:"ipv4,omitempty"`
	// The ipv6 address.
	IPv6 TcIP `json:"ipv6,omitempty"`
}

func (v *TcInterface) String() string {
	return fmt.Sprintf("name=%v, ipv4=%v, ipv6=%v", v.Name, v.IPv4.String(), v.IPv6.String())
}

type TcProtocolFamily int

func (v TcProtocolFamily) String() string {
	switch v {
	case ProtocolFamilyTCP:
		return "TCP"
	case ProtocolFamilyUDP:
		return "UDP"
	case ProtocolFamilyICMP:
		return "ICMP"
	default:
		return "Forbbiden"
	}
}

const (
	ProtocolFamilyForbbiden TcProtocolFamily = 0
	ProtocolFamilyICMP      TcProtocolFamily = 1
	ProtocolFamilyTCP       TcProtocolFamily = 6
	ProtocolFamilyUDP       TcProtocolFamily = 17
)
