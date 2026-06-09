"""Fixtures compartidas por toda la suite de tests.

Siguiendo la masterclass de testing:
  - La base de datos de test es SQLite en memoria: rápida, aislada y se
    crea/destruye con el proceso (misma estrategia que `config.settings.test`).
  - El `client` de Flask es el equivalente al `APIClient` de DRF o a
    `Supertest`: hace peticiones HTTP reales contra las vistas SIN levantar
    un servidor, perfecto para CI/CD.
  - Cada test arranca con la base limpia (estado fresco, sin depender del orden).
"""
import pytest

from app import app as flask_app, db, Mensaje


@pytest.fixture
def app():
    """La aplicación Flask configurada en modo testing."""
    # ARRANGE global: activar TESTING para que los errores propaguen limpio.
    flask_app.config.update(TESTING=True)
    return flask_app


@pytest.fixture(autouse=True)
def _db_limpia(app):
    """Garantiza tablas creadas y la tabla `mensajes` vacía antes de cada test."""
    with app.app_context():
        db.create_all()
        db.session.query(Mensaje).delete()
        db.session.commit()
    yield


@pytest.fixture
def client(app):
    """Cliente HTTP de test (equivalente a APIClient / Supertest)."""
    with app.test_client() as test_client:
        yield test_client
