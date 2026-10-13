# Análisis exploratorio de tarifas hipotecarias

Análisis estadístico (sin machine learning) de las 305 tarifas de los 9 bancos con los que trabaja ESJOAN, hecho para el Módulo 1 de la Maestría en Ciencia de Datos y usado directamente por el negocio para decidir con qué bancos negociar y para calibrar el comparador de crédito del CRM.

## Archivos

- **`EDA_tasas_hipotecarias.ipynb`** — el análisis completo, con narrativa: estadística descriptiva, distribuciones, correlaciones (Pearson/Spearman) y pruebas de hipótesis (ANOVA, Kruskal-Wallis, t de Welch). Ábrelo con Jupyter o revísalo directamente en GitHub (renderiza las gráficas).
- **`eda.py`** — el mismo análisis como script de línea de comandos; regenera todas las gráficas en `graficas/` y las tablas en los `.csv`.
- **`graficas/`** — las 11 gráficas generadas (PNG, listas para usar en reportes o presentaciones).
- **`fixtures.json`** — copia de los datos de bancos y tarifas usados (mismo origen que `tests/fixtures.json` del CRM).
- **`*.csv`** — tablas de resultados (estadística descriptiva por banco, matriz de correlación, tasa promedio por banco y plazo).

## Hallazgos principales

1. **El aforo se correlaciona con la tasa** (Spearman ρ=0.59, p<0.001): a mayor financiamiento relativo del inmueble, tasa más alta.
2. **El plazo no predice la tasa** (p=0.53) en estos datos.
3. **Dentro de HSBC** (el único banco con volumen suficiente para estadística con potencia: 292 de 304 filas), **la banda de riesgo crediticio** es, por mucho, el factor más determinante de la tasa (ANOVA p<0.0001, diferencia de hasta 0.9 puntos porcentuales), mientras que **el programa de crédito no lo es** (p=0.95).
4. **Limitación central:** la cobertura de datos es extremadamente desigual entre bancos (HSBC=96% de las filas; el resto, 1-3 filas cada uno). Las comparaciones *entre* bancos son indicativas, no concluyentes; las conclusiones robustas de este análisis aplican específicamente a HSBC.

## Cómo reproducirlo

```bash
pip install pandas numpy scipy matplotlib --break-system-packages
python3 eda.py
```

o abre `EDA_tasas_hipotecarias.ipynb` en Jupyter y ejecuta todas las celdas.
