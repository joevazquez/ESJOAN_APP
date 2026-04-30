import requests
from bs4 import BeautifulSoup
import time
import random

def scrape_inmuebles24(tipo=None, operacion=None, ubicacion="mexico"):

    ubicacion = ubicacion.lower().replace(" ", "-")

    tipo = tipo or "casas"
    operacion = operacion or "renta"

    url = f"https://www.inmuebles24.com/{tipo}-en-{operacion}-en-{ubicacion}.html"

    headers = {
        "User-Agent": random.choice([
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
            "Mozilla/5.0 (X11; Linux x86_64)"
        ]),
        "Accept-Language": "es-MX,es;q=0.9"
    }

    try:
        print("🔎 Inmuebles24 (ligero):", url)

        # ⏳ delay humano
        time.sleep(random.uniform(3, 6))

        res = requests.get(url, headers=headers, timeout=10)

        if res.status_code != 200:
            print("❌ Error HTTP:", res.status_code)
            return []

        html = res.text.lower()

        # 🚨 detección de bloqueo
        if "captcha" in html or "cloudflare" in html:
            print("🚨 Inmuebles24 bloqueó la request")
            return []

        soup = BeautifulSoup(res.text, "html.parser")

        resultados = []

        # 🔥 selector (puede cambiar)
        items = soup.select("div.postingCard")

        if not items:
            print("⚠️ No se encontraron resultados en Inmuebles24")
            return []

        for item in items[:10]:
            try:
                titulo_tag = item.select_one("a.go-to-posting")
                precio_tag = item.select_one("div.first-price")
                img_tag = item.select_one("img")

                titulo = titulo_tag.text.strip() if titulo_tag else "Sin título"
                link = titulo_tag["href"] if titulo_tag else "#"
                precio = precio_tag.text.strip() if precio_tag else "N/A"
                foto = img_tag["src"] if img_tag else ""

                if link and not link.startswith("http"):
                    link = "https://www.inmuebles24.com" + link

                resultados.append({
                    "titulo": titulo,
                    "precio": precio,
                    "link": link,
                    "foto": foto,
                    "ubicacion": ubicacion,
                    "fuente": "inmuebles24"
                })

            except:
                continue

        print("Resultados Inmuebles24:", len(resultados))
        return resultados

    except Exception as e:
        print("Error Inmuebles24:", e)
        return []