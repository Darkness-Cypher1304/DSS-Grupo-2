from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
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

# Endpoint principal
@app.route('/')
def hello():
    return jsonify({
        "status": "ok",
        "message": "Pipeline CI/CD funcionando",
        "env": "dev"
    })

# Smoke test endpoint
@app.route('/health')
def health():
    return jsonify({"status": "healthy"}), 200

# DB test endpoint
@app.route('/db-health')
def db_health():
    try:
        db.session.execute(db.text('SELECT 1'))
        return jsonify({"status": "db connected"}), 200
    except Exception as e:
        return jsonify({"status": "db error", "detail": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)  # nosec B104
