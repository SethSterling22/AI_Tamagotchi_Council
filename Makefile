.PHONY: dev test e2e install
install:           ## dependencias de desarrollo
	pip install -r server/requirements.txt pytest playwright
dev:               ## lobby en :8080 + 3 Ollama falsos (sin hardware)
	./server/tools/dev.sh
test:              ## pruebas del backend (rápidas, sin red externa)
	cd server && python3 -m pytest -q
e2e:               ## prueba de interfaz con Playwright (requiere `make dev` en otra terminal)
	cd server && python3 tests/e2e/e2e_ui.py /tmp/council_shots
