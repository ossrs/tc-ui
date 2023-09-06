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
docker run --network=host --privileged -it --restart always -d \
    --name tc -v /lib/modules:/lib/modules:ro ossrs/tc-ui:1
```

> Note: Only support Linux server, because it requires kernel module ifb and host network mode.

> Note: Please use `registry.cn-hangzhou.aliyuncs.com/ossrs/tc-ui:1` in China.

Open [http://localhost:2023](http://localhost:2023) in browser.

## Export and Load Docker Image

If want to export the docker image:

```bash
docker pull ossrs/tc-ui:1
docker save ossrs/tc-ui:1 |gzip > tc-ui.tar.gz
```

If want to download the arm64 docker image:

```bash
docker pull --platform linux/arm64 ossrs/tc-ui:1
docker save ossrs/tc-ui:1 |gzip > tc-ui.tar.gz
```

Load the docker image:

```bash
docker load -i tc-ui.tar.gz
```

## HTTP OpenAPI

There is an HTTP OpenAPI, pass cmd in HTTP POST body, for example:

```bash
curl http://localhost:2023/tc/api/v1/config/raw -X POST -d 'tcshow lo'
```

Set 10% loss of interface lo:

```bash
curl http://localhost:2023/tc/api/v1/config/raw -X POST -d 'tcset lo --loss 10%'
#{"code":0,"data":null}
```

Get settings of interface lo:

```bash
curl http://localhost:2023/tc/api/v1/config/raw -X POST -d 'tcshow lo'
#{"code":0,"data":{"lo":{"incoming":{},"outgoing":{}}}}
```

Reset all settings of interface lo:

```bash
curl http://localhost:2023/tc/api/v1/config/raw -X POST -d 'tcdel --all lo'
#{"code":0,"data":null}
```

Only allow `tcset`, `tcshow` and `tcdel`, or failed:

```bash
curl http://localhost:2023/tc/api/v1/config/raw -X POST -d 'ls'
#{"code":100,"data":"invalid cmd ls"}
```

For TC command, see:

* [Set traffic control (tcset command)](https://tcconfig.readthedocs.io/en/latest/pages/usage/tcset/index.html)
* [Delete traffic control (tcdel command)](https://tcconfig.readthedocs.io/en/latest/pages/usage/tcdel/index.html)
* [Display traffic control configurations (tcshow command)](https://tcconfig.readthedocs.io/en/latest/pages/usage/tcshow/index.html)

## Development in macOS

Build UI:

```bash
(cd ui && npm install && npm run build)
```

Run Go API server in Ubuntu20 server or docker:

```bash
docker build -t test -f Dockerfile.dev .
docker run --privileged --rm -it -p 2023:2023 -v $(pwd):/g -w /g test go run .
```

> Note: Note that macOS docker doesn't support ingress, which requires kernel module ifb.

> Note: Must run with `--privileged` or failed to run `tc` and `tcpdump` commands.

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
