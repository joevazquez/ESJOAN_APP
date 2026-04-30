from scrapers.vivanuncios import scrape_vivanuncios
from scrapers.mercado_libre import scrape_mercado_libre
from scrapers.inmuebles24 import scrape_inmuebles24

def datos_demo():
    return [
        {
            "titulo": "Casa demo en CDMX",
            "precio": "$ 10,000",
            "ubicacion": "CDMX",
            "link": "#",
            "foto": "",
            "fuente": "demo"
        }
    ]

def buscar_todo(filtros):
    resultados = []

    # 🔥 orden estratégico (más estable → menos estable)
    resultados += scrape_vivanuncios(**filtros)

    if len(resultados) < 5:
        resultados += scrape_inmuebles24(**filtros)

    if len(resultados) < 5:
        resultados += scrape_mercado_libre(**filtros)

    if not resultados:
        print("⚠️ usando fallback")
        resultados = datos_demo()

    return resultados