ARG ARCH

FROM ${ARCH}ubuntu:focal as build

ARG BUILDPLATFORM
ARG TARGETPLATFORM
ARG TARGETARCH
RUN echo "BUILDPLATFORM: $BUILDPLATFORM, TARGETPLATFORM: $TARGETPLATFORM, TARGETARCH: $TARGETARCH"

# https://serverfault.com/questions/949991/how-to-install-tzdata-on-a-ubuntu-docker-image
ENV DEBIAN_FRONTEND=noninteractive

# For TC and tcpdump
RUN apt-get update -y && apt-get install -y make curl

# To use if in RUN, see https://github.com/moby/moby/issues/7281#issuecomment-389440503
# Note that only exists issue like "/bin/sh: 1: [[: not found" for Ubuntu20, no such problem in CentOS7.
SHELL ["/bin/bash", "-c"]

# For Go 1.16
ENV PATH=$PATH:/usr/local/go/bin
RUN if [[ $TARGETARCH == 'amd64' ]]; then \
      curl -L https://go.dev/dl/go1.18.10.linux-amd64.tar.gz |tar -xz -C /usr/local; \
    fi
RUN if [[ $TARGETARCH == 'arm64' ]]; then \
      curl -L https://go.dev/dl/go1.18.10.linux-arm64.tar.gz |tar -xz -C /usr/local; \
    fi
# For linux/arm/v7, because ARMv6 is upwardly compatible with ARMv7.
RUN if [[ $TARGETARCH == 'arm' ]]; then \
      curl -L https://go.dev/dl/go1.18.10.linux-armv6l.tar.gz |tar -xz -C /usr/local; \
    fi

# Note that git is very important for codecov to discover the .codecov.yml
RUN apt update && apt install -y gcc g++ make patch

ADD . /g
WORKDIR /g
RUN make -j

FROM ${ARCH}node:18-slim as ui

ARG MAKEARGS
RUN echo "MAKEARGS: $MAKEARGS"

ADD . /g
WORKDIR /g/ui

# To use if in RUN, see https://github.com/moby/moby/issues/7281#issuecomment-389440503
# Note that only exists issue like "/bin/sh: 1: [[: not found" for Ubuntu20, no such problem in CentOS7.
SHELL ["/bin/bash", "-c"]

RUN if [[ $MAKEARGS != 'build-no-ui' ]]; then \
      npm i && npm run build; \
    fi

FROM ${ARCH}ubuntu:focal as dist

RUN apt-get update -y && \
    apt-get install -y tcpdump iputils-ping net-tools dstat iproute2 kmod python3-pip && \
    rm -rf /var/lib/apt/lists/* && \
    pip install tcconfig

COPY --from=build /g/tc-ui /g/tc-ui
COPY --from=ui /g/ui/build /g/ui/build

WORKDIR /g
CMD ["./tc-ui"]
