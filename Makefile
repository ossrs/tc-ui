.PHONY: default ui clean clean-api clean-ui run-api run-ui help prepare api

default: api

api: ./tc-ui

./tc-ui: *.go Makefile
	go build -mod=vendor .

ui: prepare
	cd ui && npm install && npm run build

prepare:
	cd ui && if [ -f ../.env ]; then rm -f .env && ln -sf ../.env . && echo 'Refresh .env ok'; fi

clean: clean-api

clean-api:
	rm -f tc-ui

clean-ui:
	rm -rf ui/build

run-api:
	go run .; echo 'Done'

run-ui: prepare
	cd ui && npm install && npm run start; echo 'Done'

help:
	@echo "Usage: make [default|clean|run-api|run-ui]"
	@echo "    api      	Build API server by Go. [Default]"
	@echo "    ui      	    Build reactjs UI by React.js"
	@echo "    clean        Remove API server"
