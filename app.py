from flask import Flask, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from datetime import datetime, timezone
import os

app = Flask(__name__)

# PostgreSQL en Render, SQLite en CI/tests
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
    'DATABASE_URL',
    'sqlite:///:memory:'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
migrate = Migrate(app, db)


# ---------------------------------------------------------------------------
# Modelo de ejemplo: Mensaje
# ---------------------------------------------------------------------------
class Mensaje(db.Model):
    __tablename__ = 'mensajes'

    id = db.Column(db.Integer, primary_key=True)
    texto = db.Column(db.String(280), nullable=False)
    creado_en = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'texto': self.texto,
            'creado_en': self.creado_en.isoformat() if self.creado_en else None,
        }


with app.app_context():
    db.create_all()


# ---------------------------------------------------------------------------
# Headers de seguridad HTTP — corrige alertas MEDIUM/LOW de ZAP
# ---------------------------------------------------------------------------
@app.after_request
def set_security_headers(response):
    response.headers['Content-Security-Policy'] = "default-src 'self'"
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
    response.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    return response


# Endpoint principal
@app.route('/')
def hello():
    return jsonify({
        "status": "ok",
        "message": "NeuroAlert API funcionando",
        "version": "1.1.0",
        "env": "dev"
    })


@app.route('/version')
def version():
    return jsonify({
        "version": "1.1.0",
        "commit": os.environ.get('RENDER_GIT_COMMIT', 'local')[:7],
    })


@app.route('/health')
def health():
    return jsonify({"status": "healthy"}), 200


@app.route('/db-health')
def db_health():
    try:
        db.session.execute(db.text('SELECT 1'))
        return jsonify({"status": "db connected"}), 200
    except Exception as e:
        return jsonify({"status": "db error", "detail": str(e)}), 500


@app.route('/mensajes', methods=['GET'])
def listar_mensajes():
    mensajes = Mensaje.query.order_by(Mensaje.id.desc()).all()
    return jsonify({
        "total": len(mensajes),
        "mensajes": [m.to_dict() for m in mensajes],
    })


@app.route('/mensajes', methods=['POST'])
def crear_mensaje():
    data = request.get_json(silent=True) or {}
    texto = (data.get('texto') or '').strip()
    if not texto:
        return jsonify({"error": "el campo 'texto' es requerido"}), 400
    mensaje = Mensaje(texto=texto[:280])
    db.session.add(mensaje)
    db.session.commit()
    return jsonify(mensaje.to_dict()), 201


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)  # nosec B104