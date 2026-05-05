from flask import Flask, jsonify

app = Flask(__name__)

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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)

