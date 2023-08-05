FROM ubuntu:focal as build

# https://serverfault.com/questions/949991/how-to-install-tzdata-on-a-ubuntu-docker-image
ENV DEBIAN_FRONTEND=noninteractive

# For TC and tcpdump
RUN apt-get update -y && apt-get install -y make curl

# For Go 1.16
ENV PATH=$PATH:/usr/local/go/bin
RUN curl -L https://golang.google.cn/dl/go1.16.12.linux-amd64.tar.gz |tar -xz -C /usr/local

ADD . /g
WORKDIR /g
RUN make -j

FROM node:18-slim as ui

ADD . /g
WORKDIR /g/ui
RUN npm i && npm run build

FROM ubuntu:focal as dist

RUN apt-get update -y && \
    apt-get install -y tcpdump iputils-ping net-tools dstat iproute2 kmod python3-pip && \
    rm -rf /var/lib/apt/lists/* && \
    pip install tcconfig

COPY --from=build /g/tc-ui /g/tc-ui
COPY --from=ui /g/ui/build /g/ui/build

WORKDIR /g
CMD ["./tc-ui"]
