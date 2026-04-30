from flask import Flask, request, jsonify, render_template
from services.aggregator import buscar_todo

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/resultados')
def resultados():
    return render_template('resultados.html')

@app.route('/api/buscar', methods=['POST'])
def buscar():
    data = request.json

    filtros = {
        "tipo": data.get("tipo"),
        "operacion": data.get("operacion"),
        "ubicacion": data.get("ubicacion")
    }

    resultados = buscar_todo(filtros)

    return jsonify(resultados)

if __name__ == '__main__':
    app.run(debug=True)