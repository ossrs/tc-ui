# tc-ui

WebUI for [tcconfig](https://github.com/thombashi/tcconfig) which wraps
[TC(Linux Traffic Control)](https://lartc.org/howto/index.html)

## Usage

Ensure there is `ifb.ko` on your server:

```bash
ls /lib/modules/$(uname -r)/kernel/drivers/net/ifb.ko 2>/dev/null && echo yes || echo no
```

Run TC WebUI by docker:

```bash
docker run --network=host --privileged --rm -it \
  -v /lib/modules:/lib/modules:ro ossrs/tc-ui:1 ./tc-ui
```

> Note: Only support Linux server, because it requires kernel module ifb and host network mode.

Open [http://localhost:2023](http://localhost:2023) in browser.

## Development

Run Go API server in Ubuntu20 server or docker:

```bash
sudo docker build -t test -f Dockerfile .
sudo docker run --network=host --privileged --rm -it -v $(pwd):/g -w /g \
  -v /lib/modules:/lib/modules:ro test go run .
```

> Note: Please run in Ubuntu20 server, macOS docker doesn't support ingress, which requires kernel module ifb.

> Note: Must run with `--privileged` or failed to run `tc` and `tcpdump` commands.

> Note: Mount `/lib/modules` for ifb kernel module at `/lib/modules/$(uname -r)/kernel/drivers/net/ifb.ko`

> Note: Run with `--network=host` to install ifb for ingress network.

Run react UI in macOS or WebStorm:

```bash
cd ui
npm install
env API_HOST=ubuntu20 npm run start
```

> Note: Setup the `API_HOST=ubuntu20` to connect the remote Ubuntu API server.

Open http://localhost:3000/ in browser.

## Tools

Please install required tools, for Ubuntu20:

```bash
apt-get update -y
apt-get install -y curl tcpdump iputils-ping iproute2
curl -L https://golang.google.cn/dl/go1.16.12.linux-amd64.tar.gz |tar -xz -C /usr/local
export PATH=$PATH:/usr/local/go/bin
```

Please install tc and tcpdump:

```bash
sudo apt-get install -y iproute2 tcpdump
```

You can verify the installation by `tc qdisc help` and `tcpdump --version`.

Please install tcconfig:

```bash
# For Ubuntu20
sudo apt-get install -y python3-pip
sudo pip install tcconfig

# For CentOS7
sudo yum install -y python3-pip
sudo pip3 install tcconfig
```

You can verfiy the installation by `tcset --version`.

Please install Go 1.16+ by yourself and verfiy the installation by `go version`.

This is optional for docker.

## Config

Config by environment variables, so create a `.env` file with:

```bash
API_HOST=ubuntu20
API_LISTEN=2023
UI_HOST=localhost
UI_PORT=3001
NODE_ENV=development
IFACE_FILTER_IPV4=true
IFACE_FILTER_IPV6=true
```

This is optional.
