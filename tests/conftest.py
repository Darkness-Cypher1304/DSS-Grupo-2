"""Fixtures compartidas por toda la suite de tests.

Siguiendo la masterclass de testing:
  - La base de datos de test es SQLite en memoria: rápida, aislada y se
    crea/destruye con el proceso (misma estrategia que `config.settings.test`).
  - El `client` de Flask es el equivalente al `APIClient` de DRF o a
    `Supertest`: hace peticiones HTTP reales contra las vistas SIN levantar
    un servidor, perfecto para CI/CD.
"""
import pytest

from app import app as flask_app


@pytest.fixture
def app():
    """La aplicación Flask configurada en modo testing."""
    # ARRANGE global: activar TESTING para que los errores propaguen limpio.
    flask_app.config.update(TESTING=True)
    return flask_app


@pytest.fixture
def client(app):
    """Cliente HTTP de test (equivalente a APIClient / Supertest)."""
    with app.test_client() as test_client:
        yield test_client
