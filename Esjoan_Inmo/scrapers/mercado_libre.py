import requests
from bs4 import BeautifulSoup
import time
import random

def scrape_mercado_libre(tipo=None, operacion=None, ubicacion="mexico"):

    ubicacion = ubicacion.lower().replace(" ", "-")
    url = f"https://inmuebles.mercadolibre.com.mx/{tipo}/{operacion}/{ubicacion}"

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    try:
        print("🔎 ML (ligero):", url)

        time.sleep(random.uniform(3, 6))

        res = requests.get(url, headers=headers, timeout=10)

        if "captcha" in res.text.lower():
            print("🚨 ML bloqueado")
            return []

        soup = BeautifulSoup(res.text, "html.parser")

        resultados = []

        items = soup.select("li.ui-search-layout__item")

        for item in items[:5]:
            try:
                titulo = item.select_one("h2").text.strip()
                precio = item.select_one(".andes-money-amount__fraction").text.strip()
                link = item.select_one("a")["href"]

                resultados.append({
                    "titulo": titulo,
                    "precio": f"$ {precio}",
                    "link": link,
                    "foto": "",
                    "ubicacion": ubicacion,
                    "fuente": "mercado_libre"
                })
            except:
                continue

        print("Resultados ML:", len(resultados))
        return resultados

    except:
        return []