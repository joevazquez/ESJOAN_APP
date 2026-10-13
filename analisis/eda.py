"""
EDA estadístico de las tarifas hipotecarias de 9 bancos (ESJOAN)
Sin machine learning: estadística descriptiva, distribuciones, correlaciones
y pruebas de hipótesis clásicas (ANOVA / Kruskal-Wallis) para comparar bancos.
"""
import json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from scipy import stats

plt.rcParams.update({
    'font.family': 'DejaVu Sans', 'font.size': 11,
    'axes.spines.top': False, 'axes.spines.right': False,
    'axes.edgecolor': '#8890B5', 'axes.labelcolor': '#20233F',
    'text.color': '#20233F', 'xtick.color': '#20233F', 'ytick.color': '#20233F',
    'figure.facecolor': 'white', 'axes.facecolor': 'white',
})
NAVY, RED, GOLD, MUTED = '#292E54', '#E40C19', '#FFD21A', '#6B7099'
PAL = ['#292E54', '#E40C19', '#FFD21A', '#3A4174', '#B23A44', '#6B7099', '#8890B5', '#C0392B', '#D4A300']

d = json.load(open('fixtures.json', encoding='utf8'))
bancos = pd.DataFrame(d['bancos'])[['id', 'clave', 'nombre', 'activo']]
tasas = pd.DataFrame(d['tasas'])

df = tasas.merge(bancos, left_on='banco_id', right_on='id', suffixes=('', '_b'))
df = df.rename(columns={'nombre': 'banco'})
df = df[df['activo_b']].copy()          # bancos activos (excluye Banamex, sin datos)
df = df[df['tasa'].notna()].copy()
df['tasa_pct'] = df['tasa'] * 100
df['aforo_max_pct'] = df['aforo_max'] * 100
df['plazo_rango'] = df['plazo_max'] - df['plazo_min']
df['tiene_comision'] = df['comision_apertura'].notna()
df['comision_pct'] = df['comision_apertura'] * 100

print(f'Filas activas analizadas: {len(df)} de {len(tasas)} totales')
print(f'Bancos activos: {sorted(df.banco.unique().tolist())}')

# ============================================================ 1) Estadística descriptiva por banco
desc = df.groupby('banco')['tasa_pct'].agg(['count', 'mean', 'std', 'min', 'median', 'max']).round(3)
desc = desc.sort_values('mean')
print('\n=== Estadística descriptiva de la tasa (%) por banco ===')
print(desc)
desc.to_csv('desc_tasa_por_banco.csv')

# ============================================================ 2) Boxplot de tasas por banco (ordenado por mediana)
orden = df.groupby('banco')['tasa_pct'].median().sort_values().index.tolist()
fig, ax = plt.subplots(figsize=(9, 5.2))
data = [df.loc[df.banco == b, 'tasa_pct'].values for b in orden]
bp = ax.boxplot(data, labels=orden, patch_artist=True, widths=0.55, medianprops={'color': RED, 'linewidth': 2},
                boxprops={'facecolor': '#ECEEF7', 'edgecolor': NAVY}, whiskerprops={'color': NAVY}, capprops={'color': NAVY},
                flierprops={'markerfacecolor': RED, 'markeredgecolor': RED, 'markersize': 4, 'alpha': 0.6})
ax.set_ylabel('Tasa anual (%)'); ax.set_title('Distribución de tasas por banco (todas las combinaciones de producto y perfil)', loc='left', fontsize=12, color=NAVY, fontweight='bold')
ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=1))
plt.xticks(rotation=20, ha='right')
plt.tight_layout(); plt.savefig('01_boxplot_tasas.png', dpi=160); plt.close()

# ============================================================ 3) Tasa vs Aforo máximo (dispersión)
fig, ax = plt.subplots(figsize=(9, 5.2))
for i, b in enumerate(orden):
    sub = df[df.banco == b]
    ax.scatter(sub.aforo_max_pct, sub.tasa_pct, s=26, alpha=0.75, color=PAL[i % len(PAL)], label=b)
ax.set_xlabel('Aforo máximo permitido (%)'); ax.set_ylabel('Tasa anual (%)')
ax.set_title('Tasa vs. aforo máximo, por banco', loc='left', fontsize=12, color=NAVY, fontweight='bold')
ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=1)); ax.xaxis.set_major_formatter(mtick.PercentFormatter(decimals=1))
ax.legend(fontsize=8, ncol=3, loc='upper center', bbox_to_anchor=(0.5, -0.18), frameon=False)
plt.tight_layout(); plt.savefig('02_dispersion_tasa_aforo.png', dpi=160); plt.close()

# correlación tasa vs aforo (Pearson y Spearman)
r_p, p_p = stats.pearsonr(df.aforo_max_pct, df.tasa_pct)
r_s, p_s = stats.spearmanr(df.aforo_max_pct, df.tasa_pct)
print(f'\nCorrelación tasa vs aforo máximo: Pearson r={r_p:.3f} (p={p_p:.4f}) | Spearman rho={r_s:.3f} (p={p_s:.4f})')

# ============================================================ 4) Tasa vs plazo máximo
fig, ax = plt.subplots(figsize=(9, 5.2))
plazos = sorted(df.plazo_max.unique())
prom_por_plazo = df.groupby('plazo_max')['tasa_pct'].mean()
ax.plot(prom_por_plazo.index, prom_por_plazo.values, marker='o', color=NAVY, linewidth=2)
for i, b in enumerate(orden):
    sub = df[df.banco == b].groupby('plazo_max')['tasa_pct'].mean()
    ax.plot(sub.index, sub.values, marker='o', markersize=4, linewidth=1, alpha=0.5, color=PAL[i % len(PAL)])
ax.set_xlabel('Plazo máximo (años)'); ax.set_ylabel('Tasa promedio (%)')
ax.set_title('Tasa promedio por plazo máximo (línea gruesa = promedio de mercado)', loc='left', fontsize=12, color=NAVY, fontweight='bold')
ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=1))
plt.tight_layout(); plt.savefig('03_tasa_vs_plazo.png', dpi=160); plt.close()
r_plazo, p_plazo = stats.pearsonr(df.plazo_max, df.tasa_pct)
print(f'Correlación tasa vs plazo máximo: Pearson r={r_plazo:.3f} (p={p_plazo:.4f})')

# ============================================================ 5) ANOVA / Kruskal-Wallis: ¿difieren las medias entre bancos?
grupos = [df.loc[df.banco == b, 'tasa_pct'].values for b in orden]
f_stat, p_anova = stats.f_oneway(*grupos)
h_stat, p_kw = stats.kruskal(*grupos)
print(f'\nANOVA (paramétrica) entre bancos: F={f_stat:.2f}, p={p_anova:.2e}')
print(f'Kruskal-Wallis (no paramétrica) entre bancos: H={h_stat:.2f}, p={p_kw:.2e}')

# normalidad por banco (Shapiro) para justificar cuál prueba es más apropiada
print('\nPrueba de normalidad (Shapiro-Wilk) por banco:')
normalidad = {}
for b in orden:
    vals = df.loc[df.banco == b, 'tasa_pct'].values
    if len(vals) >= 3:
        w, p = stats.shapiro(vals)
        normalidad[b] = p
        print(f'  {b}: n={len(vals)}, p={p:.4f} {"(no normal)" if p < 0.05 else "(no se rechaza normalidad)"}')

# ============================================================ 6) Comisión por apertura: ¿quién cobra y cuánto?
con_comision = df[df.tiene_comision]
resumen_comision = con_comision.groupby('banco')['comision_pct'].agg(['count', 'mean', 'min', 'max']).round(2)
print('\n=== Comisión por apertura (solo bancos que la cobran) ===')
print(resumen_comision)
sin_comision = sorted(set(orden) - set(resumen_comision.index))
print('Bancos sin comisión de apertura registrada:', sin_comision)

fig, ax = plt.subplots(figsize=(9, 5))
resumen_comision_sorted = resumen_comision.sort_values('mean')
bars = ax.bar(resumen_comision_sorted.index, resumen_comision_sorted['mean'], color=RED, alpha=0.85, width=0.55)
ax.errorbar(resumen_comision_sorted.index, resumen_comision_sorted['mean'],
            yerr=[resumen_comision_sorted['mean'] - resumen_comision_sorted['min'], resumen_comision_sorted['max'] - resumen_comision_sorted['mean']],
            fmt='none', ecolor=NAVY, capsize=4)
ax.set_ylabel('Comisión por apertura (%)'); ax.set_title('Comisión por apertura promedio por banco (barra de error = rango min-max)', loc='left', fontsize=11.5, color=NAVY, fontweight='bold')
ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=1))
plt.xticks(rotation=20, ha='right')
plt.tight_layout(); plt.savefig('04_comision_apertura.png', dpi=160); plt.close()

# ============================================================ 7) Matriz de correlación de variables numéricas
num_cols = ['tasa_pct', 'aforo_max_pct', 'plazo_min', 'plazo_max', 'incremento_anual', 'comision_pct']
corr = df[num_cols].corr(method='spearman')
fig, ax = plt.subplots(figsize=(6.6, 5.6))
im = ax.imshow(corr.values, cmap='RdBu_r', vmin=-1, vmax=1)
ax.set_xticks(range(len(num_cols))); ax.set_xticklabels(['Tasa', 'Aforo máx.', 'Plazo mín.', 'Plazo máx.', 'Incr. anual', 'Comisión'], rotation=35, ha='right')
ax.set_yticks(range(len(num_cols))); ax.set_yticklabels(['Tasa', 'Aforo máx.', 'Plazo mín.', 'Plazo máx.', 'Incr. anual', 'Comisión'])
for i in range(len(num_cols)):
    for j in range(len(num_cols)):
        v = corr.values[i, j]
        if not np.isnan(v):
            ax.text(j, i, f'{v:.2f}', ha='center', va='center', fontsize=9, color='white' if abs(v) > 0.5 else NAVY)
ax.set_title('Correlación de Spearman entre variables', loc='left', fontsize=12, color=NAVY, fontweight='bold')
plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
plt.tight_layout(); plt.savefig('05_correlacion.png', dpi=160); plt.close()
corr.round(3).to_csv('correlacion_spearman.csv')

# ============================================================ 8) Segmentación: ¿cuántas variantes por programa y esquema?
seg = df.groupby(['esquema']).size()
print('\n=== Filas por esquema de pago ===')
print(seg)
prog = df.groupby('programa').size().sort_values(ascending=False)
print('\n=== Filas por programa ===')
print(prog)

fig, axes = plt.subplots(1, 2, figsize=(10.5, 4.6))
axes[0].pie(seg.values, labels=seg.index, autopct='%1.0f%%', colors=[NAVY, RED], textprops={'color': 'white', 'fontweight': 'bold'})
axes[0].set_title('Esquema de pago', fontsize=11, color=NAVY, fontweight='bold')
top_prog = prog.head(6)
axes[1].barh(top_prog.index[::-1], top_prog.values[::-1], color=GOLD, edgecolor=NAVY)
axes[1].set_title('Programas más frecuentes', fontsize=11, color=NAVY, fontweight='bold')
plt.tight_layout(); plt.savefig('06_segmentos.png', dpi=160); plt.close()

# ============================================================ 9) ¿Cuál banco es más barato POR PLAZO (controlando la variable de confusión)?
tabla_plazo_banco = df.pivot_table(index='banco', columns='plazo_max', values='tasa_pct', aggfunc='mean')
print('\n=== Tasa promedio por banco y plazo máximo (tabla de contingencia) ===')
print(tabla_plazo_banco.round(2))
tabla_plazo_banco.round(2).to_csv('tabla_tasa_banco_plazo.csv')

fig, ax = plt.subplots(figsize=(9.5, 5.2))
im = ax.imshow(tabla_plazo_banco.values, cmap='RdYlGn_r', aspect='auto')
ax.set_xticks(range(len(tabla_plazo_banco.columns))); ax.set_xticklabels(tabla_plazo_banco.columns)
ax.set_yticks(range(len(tabla_plazo_banco.index))); ax.set_yticklabels(tabla_plazo_banco.index)
for i in range(tabla_plazo_banco.shape[0]):
    for j in range(tabla_plazo_banco.shape[1]):
        v = tabla_plazo_banco.values[i, j]
        if not np.isnan(v):
            ax.text(j, i, f'{v:.1f}', ha='center', va='center', fontsize=8, color=NAVY)
ax.set_xlabel('Plazo máximo (años)'); ax.set_title('Mapa de calor: tasa promedio (%) por banco y plazo', loc='left', fontsize=12, color=NAVY, fontweight='bold')
plt.colorbar(im, ax=ax, fraction=0.035, pad=0.03, label='Tasa (%)')
plt.tight_layout(); plt.savefig('07_heatmap_banco_plazo.png', dpi=160); plt.close()

print('\nListo. Imágenes y CSV guardados en', __file__.rsplit('/',1)[0] or '.')

# ============================================================================================
#  ANÁLISIS PROFUNDO DENTRO DE HSBC (único banco con volumen suficiente para estadística
#  con potencia real: 292 filas). Aquí sí el tamaño de muestra por grupo es grande.
# ============================================================================================
print('\n' + '='*70)
print('ANÁLISIS PROFUNDO DENTRO DE HSBC (n=292, la única muestra con potencia real)')
print('='*70)

h = df[df.banco == 'HSBC'].copy()
partes = h['perfil'].str.split(' · ', expand=True)
h['premier'] = partes[0].str.strip()
h['nomina'] = partes[1].str.strip().replace({'nan': 'No Premier (sin nómina)'})
h['riesgo'] = partes[2].str.strip()

# 1) Tasa por programa (n grande en los 3 grupos: tradicional, apoyo_infonavit, cofinavit)
grupos_prog = [h.loc[h.programa == p, 'tasa_pct'].values for p in h.programa.unique()]
f_prog, p_prog = stats.f_oneway(*grupos_prog)
print(f'\nANOVA tasa por programa dentro de HSBC (n≈96-100/grupo): F={f_prog:.2f}, p={p_prog:.2e}')
print(h.groupby('programa')['tasa_pct'].agg(['count', 'mean', 'std']).round(3))

fig, ax = plt.subplots(figsize=(7.5, 5))
prog_orden = h.groupby('programa')['tasa_pct'].median().sort_values().index.tolist()
data = [h.loc[h.programa == pr, 'tasa_pct'].values for pr in prog_orden]
ax.boxplot(data, tick_labels=[p.replace('_', ' ').title() for p in prog_orden], patch_artist=True, widths=0.5,
           medianprops={'color': RED, 'linewidth': 2}, boxprops={'facecolor': '#ECEEF7', 'edgecolor': NAVY},
           whiskerprops={'color': NAVY}, capprops={'color': NAVY})
ax.set_ylabel('Tasa anual (%)'); ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=1))
ax.set_title(f'HSBC: tasa por programa  (ANOVA p={p_prog:.4f})', loc='left', fontsize=12, color=NAVY, fontweight='bold')
plt.tight_layout(); plt.savefig('08_hsbc_por_programa.png', dpi=160); plt.close()

# 2) Tasa por banda de riesgo (NR) — ¿el perfil crediticio predice la tasa?
riesgo_orden = sorted(h.riesgo.dropna().unique())
grupos_riesgo = [h.loc[h.riesgo == r, 'tasa_pct'].values for r in riesgo_orden if len(h.loc[h.riesgo == r]) >= 3]
riesgo_validos = [r for r in riesgo_orden if len(h.loc[h.riesgo == r]) >= 3]
f_riesgo, p_riesgo = stats.f_oneway(*grupos_riesgo)
print(f'\nANOVA tasa por banda de riesgo (NR) dentro de HSBC: F={f_riesgo:.2f}, p={p_riesgo:.2e}')
print(h.groupby('riesgo')['tasa_pct'].agg(['count', 'mean', 'std']).round(3).loc[riesgo_orden])

fig, ax = plt.subplots(figsize=(8.5, 5))
data = [h.loc[h.riesgo == r, 'tasa_pct'].values for r in riesgo_orden]
ax.boxplot(data, tick_labels=riesgo_orden, patch_artist=True, widths=0.5,
           medianprops={'color': RED, 'linewidth': 2}, boxprops={'facecolor': '#ECEEF7', 'edgecolor': NAVY},
           whiskerprops={'color': NAVY}, capprops={'color': NAVY})
ax.set_ylabel('Tasa anual (%)'); ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=1))
ax.set_title(f'HSBC: tasa por banda de riesgo crediticio  (ANOVA p={p_riesgo:.4f})', loc='left', fontsize=11.5, color=NAVY, fontweight='bold')
plt.xticks(rotation=15)
plt.tight_layout(); plt.savefig('09_hsbc_por_riesgo.png', dpi=160); plt.close()

# 3) Premier vs No Premier
premier_a = h.loc[h.premier == 'Premier', 'tasa_pct'].values
premier_b = h.loc[h.premier == 'No Premier', 'tasa_pct'].values
t_stat, p_ttest = stats.ttest_ind(premier_a, premier_b, equal_var=False)
print(f'\nPremier (n={len(premier_a)}, media={premier_a.mean():.2f}%) vs No Premier (n={len(premier_b)}, media={premier_b.mean():.2f}%)')
print(f't-test Welch: t={t_stat:.2f}, p={p_ttest:.2e}')

# 4) Tasa por plazo dentro de HSBC (n grande por plazo también)
fig, ax = plt.subplots(figsize=(8, 5))
plazo_orden = sorted(h.plazo_max.unique())
data = [h.loc[h.plazo_max == pz, 'tasa_pct'].values for pz in plazo_orden]
ax.boxplot(data, tick_labels=[f'{p}a' for p in plazo_orden], patch_artist=True, widths=0.5,
           medianprops={'color': RED, 'linewidth': 2}, boxprops={'facecolor': '#ECEEF7', 'edgecolor': NAVY},
           whiskerprops={'color': NAVY}, capprops={'color': NAVY})
f_plazo_h, p_plazo_h = stats.f_oneway(*data)
ax.set_ylabel('Tasa anual (%)'); ax.yaxis.set_major_formatter(mtick.PercentFormatter(decimals=1))
ax.set_title(f'HSBC: tasa por plazo  (ANOVA p={p_plazo_h:.4f})', loc='left', fontsize=12, color=NAVY, fontweight='bold')
plt.tight_layout(); plt.savefig('10_hsbc_por_plazo.png', dpi=160); plt.close()
print(f'\nANOVA tasa por plazo dentro de HSBC: F={f_plazo_h:.2f}, p={p_plazo_h:.2e}')

# 5) Resumen del hallazgo de cobertura desigual (para reportar como limitación honesta)
cobertura = df.groupby('banco').size().sort_values(ascending=False)
cobertura_pct = (cobertura / cobertura.sum() * 100).round(1)
print('\n=== Cobertura de datos por banco (% de las 304 filas activas) ===')
print(pd.DataFrame({'filas': cobertura, 'pct_del_total': cobertura_pct}))

fig, ax = plt.subplots(figsize=(8.5, 5))
ax.barh(cobertura.index[::-1], cobertura.values[::-1], color=[NAVY if v > 50 else '#8890B5' for v in cobertura.values[::-1]])
ax.set_xlabel('Número de tarifas capturadas'); ax.set_title('Cobertura de datos MUY desigual entre bancos', loc='left', fontsize=12, color=RED, fontweight='bold')
for i, v in enumerate(cobertura.values[::-1]):
    ax.text(v + 3, i, str(v), va='center', fontsize=9, color=NAVY)
plt.tight_layout(); plt.savefig('11_cobertura_desigual.png', dpi=160); plt.close()
