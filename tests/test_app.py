"""Suite de tests de la API.

Estructura (pirámide de testing):
  - Unit:        lógica/configuración aislada, sin HTTP ni DB real.
  - Integration: petición HTTP real (test client) + vista + capa de BD.

Todos siguen el patrón AAA (Arrange -> Act -> Assert) y nombres que
describen el comportamiento esperado.
"""
import os
from unittest.mock import patch

from app import app as flask_app


# ===========================================================================
# UNIT TESTS — configuración (sin HTTP, sin DB)
# ===========================================================================
def test_database_uri_respeta_database_url_o_cae_a_sqlite():
    # ASSERT (agnóstico al entorno): la URI configurada usa DATABASE_URL si
    # existe (Postgres en CI/Render) o cae al fallback SQLite en memoria
    # (local/tests). Pasa igual en ambos entornos.
    esperada = os.environ.get('DATABASE_URL', 'sqlite:///:memory:')
    assert flask_app.config['SQLALCHEMY_DATABASE_URI'] == esperada


# ===========================================================================
# INTEGRATION TESTS — GET /  (endpoint principal)
# ===========================================================================
def test_index_responde_200(client):
    # ACT
    res = client.get('/')
    # ASSERT
    assert res.status_code == 200


def test_index_retorna_status_ok_y_estructura_json(client):
    # ACT
    res = client.get('/')
    data = res.get_json()
    # ASSERT: validar la estructura completa del JSON, no solo el status.
    assert data['status'] == 'ok'
    assert data['message'] == 'Pipeline CI/CD funcionando'
    assert 'env' in data


# ===========================================================================
# INTEGRATION TESTS — GET /health  (lo usa el smoke-test del pipeline)
# ===========================================================================
def test_health_responde_200_y_healthy(client):
    # ACT
    res = client.get('/health')
    # ASSERT
    assert res.status_code == 200
    assert res.get_json() == {'status': 'healthy'}


# ===========================================================================
# INTEGRATION TESTS — GET /db-health  (capa de base de datos)
# ===========================================================================
def test_db_health_ejecuta_select1_y_responde_db_connected(client):
    # ACT: ejecuta un SELECT 1 REAL contra la SQLite de test (no es un mock).
    res = client.get('/db-health')
    # ASSERT
    assert res.status_code == 200
    assert res.get_json() == {'status': 'db connected'}


def test_db_health_responde_500_si_la_db_falla(client):
    """Caso de error: si la BD lanza, el endpoint degrada a 500 sin reventar."""
    # ARRANGE: mockear la sesión para forzar un fallo de base de datos.
    with patch('app.db.session.execute', side_effect=Exception('DB caida')):
        # ACT
        res = client.get('/db-health')
    # ASSERT
    assert res.status_code == 500
    body = res.get_json()
    assert body['status'] == 'db error'
    assert 'detail' in body


# ===========================================================================
# INTEGRATION TESTS — manejo de rutas inexistentes
# ===========================================================================
def test_ruta_inexistente_retorna_404(client):
    # ACT
    res = client.get('/ruta-que-no-existe')
    # ASSERT
    assert res.status_code == 404
