def normalizar(prop):
    return {
        "titulo": prop.get("titulo"),
        "precio": prop.get("precio"),
        "ubicacion": prop.get("ubicacion"),
        "link": prop.get("link"),
        "foto": prop.get("foto"),
        "fuente": prop.get("fuente", "desconocido")
    }