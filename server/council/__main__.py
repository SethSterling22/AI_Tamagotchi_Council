import os
from .app import create_app

app = create_app()
host, port = os.environ.get("COUNCIL_BIND", "0.0.0.0"), int(os.environ.get("COUNCIL_PORT", "8080"))
if __name__ == "__main__":
    try:
        from waitress import serve  # opcional: pip install waitress
        serve(app, host=host, port=port, threads=8)
    except ImportError:
        app.run(host=host, port=port, threaded=True)
