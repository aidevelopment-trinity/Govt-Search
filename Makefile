WEB_DIR := apps/web

.PHONY: web-install web-dev web-build web-build-wasm

web-install:
	cd $(WEB_DIR) && npm install

web-dev:
	cd $(WEB_DIR) && npm run dev

web-build:
	cd $(WEB_DIR) && npm run build

web-build-wasm:
	NEXT_TEST_WASM=1 NEXT_TEST_WASM_DIR=./node_modules/@next/swc-wasm-nodejs npm --workspace apps/web run build
