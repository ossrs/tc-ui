package main

import (
	"context"
	"fmt"
	"github.com/joho/godotenv"
	"github.com/ossrs/go-oryx-lib/errors"
	ohttp "github.com/ossrs/go-oryx-lib/http"
	"github.com/ossrs/go-oryx-lib/logger"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"os/exec"
	"strings"
)

const version = "1.0.0"

func main() {
	ctx := logger.WithContext(context.Background())
	if err := doMain(ctx); err != nil {
		logger.Ef(ctx, "Exit with err %v", err)
		os.Exit(-1)
		return
	}
}

func doMain(ctx context.Context) error {
	logger.Tf(ctx, "WebUI for TC(Linux Traffic Control) https://lartc.org/howto/index.html")

	// Uses tcpdump and tc, so that user should run this as root.
	if true {
		cmd := exec.Command("id", "-u")
		if out, err := cmd.Output(); err != nil {
			return errors.Wrapf(err, "Check user")
		} else if uid := strings.TrimSpace(string(out)); uid != "0" {
			return errors.Wrapf(err, "Should run as root, uid=%v", uid)
		} else {
			logger.Tf(ctx, "Run with root permissions, uid=%v", uid)
		}
	}

	if _, err := os.Stat(".env"); err == nil {
		if err := godotenv.Load(".env"); err != nil {
			panic(err)
		}
	}
	// Set default values for env.
	setDefaultEnv := func(k, v string) {
		if os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}
	setDefaultEnv("NODE_ENV", "production")
	setDefaultEnv("API_LISTEN", "2023")
	setDefaultEnv("UI_HOST", "127.0.0.1")
	setDefaultEnv("UI_PORT", "3000")
	setDefaultEnv("IFACE_FILTER_IPV4", "true")
	setDefaultEnv("IFACE_FILTER_IPV6", "true")
	setDefaultEnv("PROXY_ID0_ENABLED", "on")
	setDefaultEnv("PROXY_ID0_MOUNT", "/restarter/")
	setDefaultEnv("PROXY_ID0_BACKEND", "http://127.0.0.1:2024")
	logger.Tf(ctx, "Load .env as NODE_ENV=%v, API_LISTEN=%v, UI_PORT(reactjs)=%v, IFACE_FILTER_IPV4=%v, IFACE_FILTER_IPV6=%v, PROXY0=%v/%v/%v",
		os.Getenv("NODE_ENV"), os.Getenv("API_LISTEN"), os.Getenv("UI_PORT"), os.Getenv("IFACE_FILTER_IPV4"),
		os.Getenv("IFACE_FILTER_IPV6"), os.Getenv("PROXY_ID0_ENABLED"), os.Getenv("PROXY_ID0_MOUNT"),
		os.Getenv("PROXY_ID0_BACKEND"),
	)

	addr := fmt.Sprintf("%v", os.Getenv("API_LISTEN"))
	if !strings.Contains(addr, ":") {
		addr = fmt.Sprintf(":%v", addr)
	}
	logger.Tf(ctx, "Listen at %v", addr)

	ep := "/tc/api/v1/versions"
	logger.Tf(ctx, "Handle %v", ep)
	http.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		ohttp.WriteVersion(w, r, version)
	})

	ep = "/tc/api/v1/scan"
	logger.Tf(ctx, "Handle %v", ep)
	http.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := ScanByTcpdump(ctx, w, r); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	ep = "/tc/api/v1/config/query"
	logger.Tf(ctx, "Handle %v", ep)
	http.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := TcQuery(logger.WithContext(ctx), w, r); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	ep = "/tc/api/v1/config/reset"
	logger.Tf(ctx, "Handle %v", ep)
	http.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := TcReset(logger.WithContext(ctx), w, r); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	ep = "/tc/api/v1/config/setup"
	logger.Tf(ctx, "Handle %v", ep)
	http.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := TcSetup(logger.WithContext(ctx), w, r); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	ep = "/tc/api/v1/init"
	logger.Tf(ctx, "Handle %v", ep)
	http.HandleFunc(ep, func(w http.ResponseWriter, r *http.Request) {
		if err := TcInit(logger.WithContext(ctx), w, r); err != nil {
			ohttp.WriteError(ctx, w, r, err)
		}
	})

	for i := 0; i < 8; i++ {
		enabledKey := fmt.Sprintf("PROXY_ID%v_ENABLED", i)
		mountKey := fmt.Sprintf("PROXY_ID%v_MOUNT", i)
		backendKey := fmt.Sprintf("PROXY_ID%v_BACKEND", i)
		if os.Getenv(enabledKey) != "on" {
			if os.Getenv(mountKey) != "" {
				logger.Tf(ctx, "Proxy to %v is disabled", os.Getenv(mountKey))
			}
		} else {
			if pattern := os.Getenv(mountKey); pattern != "" {
				backend := os.Getenv(backendKey)
				target, err := url.Parse(backend)
				if err != nil {
					return errors.Wrapf(err, "parse backend %v for #%v pattern %v", backend, i, pattern)
				}

				logger.Tf(ctx, "Proxy #%v %v to %v", i, pattern, backend)
				rp := httputil.NewSingleHostReverseProxy(target)
				http.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
					rp.ServeHTTP(w, r)
				})
			}
		}
	}

	reactjsEP := fmt.Sprintf("%v:%v", os.Getenv("UI_HOST"), os.Getenv("UI_PORT"))
	if os.Getenv("NODE_ENV") == "development" {
		logger.Tf(ctx, "Handle / by proxy to %v", reactjsEP)
	} else {
		logger.T(ctx, "Handle / by dir ./ui/build")
	}
	http.HandleFunc("/", TcUI(ctx, reactjsEP))

	if err := http.ListenAndServe(addr, nil); err != nil {
		return errors.Wrapf(err, "listen")
	}
	return nil
}
