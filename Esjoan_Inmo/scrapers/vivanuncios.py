import requests
from bs4 import BeautifulSoup
import time
import random

def scrape_vivanuncios(tipo=None, operacion=None, ubicacion="mexico"):

    ubicacion = ubicacion.lower().replace(" ", "-")

    url = f"https://www.vivanuncios.com.mx/s-{ubicacion}/v1c1097p1"

    headers = {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Mozilla/5.0 (X11; Linux x86_64)"
        ]),
        "Accept-Language": "es-MX,es;q=0.9"
    }

    try:
        print("🔎 Vivanuncios:", url)

        time.sleep(random.uniform(2, 5))  # 👈 delay humano

        res = requests.get(url, headers=headers, timeout=10)

        if res.status_code != 200:
            print("❌ Error HTTP:", res.status_code)
            return []

        soup = BeautifulSoup(res.text, "html.parser")

        resultados = []

        items = soup.select("div[data-cy='listing']")

        if not items:
            print("⚠️ No se encontraron resultados en Vivanuncios")
            return []

        for item in items[:10]:
            try:
                titulo = item.select_one("a").text.strip()
                link = "https://www.vivanuncios.com.mx" + item.select_one("a")["href"]

                precio_tag = item.select_one("span")
                precio = precio_tag.text.strip() if precio_tag else "N/A"

                resultados.append({
                    "titulo": titulo,
                    "precio": precio,
                    "link": link,
                    "foto": "",
                    "ubicacion": ubicacion,
                    "fuente": "vivanuncios"
                })

            except:
                continue

        print("Resultados Vivanuncios:", len(resultados))
        return resultados

    except Exception as e:
        print("Error Vivanuncios:", e)
        return []