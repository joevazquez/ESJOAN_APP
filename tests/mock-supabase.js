// Sustituto de supabase-js SOLO para pruebas de interfaz (Playwright). No se despliega.
(function () {
  const F = window.__FIX; const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();
  const ID = { admin: '00000000-0000-4000-8000-0000000000a1', broker: '00000000-0000-4000-8000-0000000000b1', cliente: '00000000-0000-4000-8000-0000000000c1', cliente2: '00000000-0000-4000-8000-0000000000c2' };
  const P = (id, email, nombre, rol) => ({ id, email, nombre_completo: nombre, telefono: '55 1234 5678', rol, activo: true, created_at: now(), updated_at: now() });
  const DB = {
    profiles: [P(ID.admin, 'admin@esjoan.mx', 'Joel Vázquez Anaya', 'admin'), P(ID.broker, 'broker@esjoan.mx', 'Mariana Ortega', 'broker'), P(ID.cliente, 'ana@correo.mx', 'Ana Lucía Reyes', 'cliente'), P(ID.cliente2, 'luis@correo.mx', 'Luis Herrera', 'cliente')],
    tipos_documento: F.tipos, bancos: F.bancos, bancos_tasas: F.tasas, documentos: [], expediente_historial: [], expediente_notas: [], simulaciones: [], auditoria: [], analisis_financiero: [],
    expedientes: [
      { id: '11111111-1111-4111-8111-111111111111', folio: 1, cliente_id: ID.cliente, broker_id: ID.broker, tipo: 'adquisicion', estatus: 'creado', valor_inmueble: 3800000, monto_solicitado: 3040000, plazo_anios: 20, ingreso_mensual: 95000, estado_inmueble: 'Ciudad de México', created_at: now(), estatus_actualizado_en: now() },
      { id: '22222222-2222-4222-8222-222222222222', folio: 2, cliente_id: ID.cliente2, broker_id: ID.broker, tipo: 'cofinavit', estatus: 'en_avaluo', valor_inmueble: 2500000, monto_solicitado: 1900000, plazo_anios: 20, ingreso_mensual: 62000, estado_inmueble: 'Estado de México', avaluo_valuador: 'Valuación Integral', avaluo_fecha: '2026-10-02', created_at: now(), estatus_actualizado_en: now() },
      { id: '33333333-3333-4333-8333-333333333333', folio: 3, cliente_id: ID.cliente2, broker_id: null, tipo: 'sustitucion', estatus: 'firmado', valor_inmueble: 4200000, monto_solicitado: 2500000, plazo_anios: 15, ingreso_mensual: 80000, estado_inmueble: 'Jalisco', created_at: now(), estatus_actualizado_en: now() },
    ],
  };
  DB.expediente_historial.push({ id: 1, expediente_id: DB.expedientes[0].id, actor_id: ID.cliente, evento: 'creado', estatus_nuevo: 'creado', detalle: null, created_at: now() });
  DB.documentos.push(
    { id: 'doc-edo-1', expediente_id: DB.expedientes[1].id, tipo_clave: 'estados_cuenta', nombre_archivo: 'estado_cuenta_enero.pdf', storage_path: DB.expedientes[1].id + '/edo1.pdf', tamano_bytes: 50000, estado: 'aprobado', subido_por: ID.cliente2, created_at: now() },
    { id: 'doc-buro-1', expediente_id: DB.expedientes[1].id, tipo_clave: 'reporte_buro', nombre_archivo: 'buro_credito.pdf', storage_path: DB.expedientes[1].id + '/buro1.pdf', tamano_bytes: 30000, estado: 'aprobado', subido_por: ID.cliente2, created_at: now() },
  );
  try { const g = localStorage.getItem('mockDB'); if (g) Object.assign(DB, JSON.parse(g)); } catch (e) {}
  const persist = () => { try { localStorage.setItem('mockDB', JSON.stringify(DB)); } catch (e) {} };
  const who = () => JSON.parse(localStorage.getItem('mockUser') || 'null');
  const me = () => { const w = who(); return w ? DB.profiles.find((p) => p.id === ID[w]) : null; };
  window.__DB = DB;

  const visibles = () => { const m = me(); return DB.expedientes.filter((e) => !m || m.rol === 'admin' || (m.rol === 'broker' && e.broker_id === m.id) || (m.rol === 'cliente' && e.cliente_id === m.id)); };
  function base(tabla) {
    const m = me(); const ex = new Set(visibles().map((e) => e.id));
    if (tabla === 'expedientes') return visibles();
    if (['documentos', 'expediente_historial', 'expediente_notas', 'simulaciones', 'analisis_financiero'].includes(tabla)) {
      let r = DB[tabla].filter((x) => ex.has(x.expediente_id));
      if (tabla === 'simulaciones' && m && m.rol === 'cliente') r = r.filter((x) => x.compartida);
      if ((tabla === 'expediente_notas' || tabla === 'analisis_financiero') && m && m.rol === 'cliente') r = [];
      return r;
    }
    if (tabla === 'profiles') return m.rol === 'cliente' ? DB.profiles.filter((p) => p.id === m.id) : DB.profiles;
    if (['bancos', 'bancos_tasas'].includes(tabla) && m.rol === 'cliente') return [];
    if (tabla === 'auditoria' && m.rol !== 'admin') return [];
    return DB[tabla] || [];
  }
  function recalcular(expId) {
    const e = DB.expedientes.find((x) => x.id === expId); if (!e || !['creado', 'en_revision_documentacion', 'documentacion_completa'].includes(e.estatus)) return;
    const docs = DB.documentos.filter((d) => d.expediente_id === expId);
    const falta = DB.tipos_documento.filter((t) => t.activo && t.obligatorio && (!t.aplica_tipos || t.aplica_tipos.includes(e.tipo)) && !docs.some((d) => d.tipo_clave === t.clave && d.estado !== 'rechazado')).length;
    const pend = docs.filter((d) => d.estado === 'pendiente').length;
    const n = !docs.length || falta ? 'creado' : pend ? 'en_revision_documentacion' : 'documentacion_completa';
    if (n !== e.estatus) { DB.expediente_historial.unshift({ id: Date.now(), expediente_id: expId, actor_id: null, evento: 'cambio_estatus', estatus_anterior: e.estatus, estatus_nuevo: n, created_at: now() }); e.estatus = n; e.estatus_actualizado_en = now(); }
  }
  class Q {
    constructor(t) { this.t = t; this.f = []; this.op = 'select'; this.ord = null; this.lim = null; this.rng = null; this.one = null; this.payload = null; this.ret = false; }
    select() { this.ret = true; return this; } eq(k, v) { this.f.push((r) => r[k] === v); return this; } in(k, v) { this.f.push((r) => v.includes(r[k])); return this; }
    order(k, o) { this.ord = [k, !(o && o.ascending === false)]; return this; } limit(n) { this.lim = n; return this; } range(a, b) { this.rng = [a, b]; return this; }
    maybeSingle() { this.one = 'maybe'; return this; } single() { this.one = 'single'; return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; } update(p) { this.op = 'update'; this.payload = p; return this; } delete() { this.op = 'delete'; return this; } upsert(p) { this.op = 'upsert'; this.payload = p; return this; }
    then(res, rej) { return Promise.resolve().then(() => { const r = this.run(); if (this.op !== 'select') persist(); return r; }).then(res, rej); }
    run() {
      const t = this.t; let rows = base(t).filter((r) => this.f.every((f) => f(r)));
      try {
        if (this.op === 'insert') {
          const n = { id: uid(), created_at: now(), ...this.payload };
          if (t === 'expedientes') { Object.assign(n, { folio: DB.expedientes.length + 1, estatus: 'creado', broker_id: null, estatus_actualizado_en: now() }); DB.expedientes.push(n); DB.expediente_historial.push({ id: Date.now(), expediente_id: n.id, actor_id: me().id, evento: 'creado', estatus_nuevo: 'creado', created_at: now() }); }
          else if (t === 'documentos') { Object.assign(n, { estado: 'pendiente' }); DB.documentos.push(n); DB.expediente_historial.unshift({ id: Date.now(), expediente_id: n.expediente_id, actor_id: me().id, evento: 'documento_subido', detalle: n.nombre_archivo, created_at: now() }); recalcular(n.expediente_id); }
          else if (t === 'simulaciones') { Object.assign(n, { recomendada: false, compartida: !!n.compartida }); DB.simulaciones.unshift(n); }
          else if (t === 'expediente_notas') { DB.expediente_notas.unshift(n); } else if (t === 'bancos') { DB.bancos.push(n); } else DB[t].push(n);
          return { data: this.one ? n : [n], error: null };
        }
        if (this.op === 'update') { rows.forEach((r) => Object.assign(r, this.payload)); return { data: this.one ? rows[0] : rows, error: null }; }
        if (this.op === 'delete') { DB[t] = DB[t].filter((r) => !rows.includes(r)); if (t === 'documentos') rows.forEach((r) => recalcular(r.expediente_id)); return { data: null, error: null }; }
        if (this.op === 'upsert') { const i = DB[t].findIndex((r) => r.clave === this.payload.clave); if (i >= 0) Object.assign(DB[t][i], this.payload); else DB[t].push(this.payload); return { data: this.payload, error: null }; }
        if (this.ord) { const [k, asc] = this.ord; rows = [...rows].sort((a, b) => (a[k] > b[k] ? 1 : a[k] < b[k] ? -1 : 0) * (asc ? 1 : -1)); }
        if (this.rng) rows = rows.slice(this.rng[0], this.rng[1] + 1); if (this.lim) rows = rows.slice(0, this.lim);
        if (this.one) return { data: rows[0] || null, error: null };
        return { data: JSON.parse(JSON.stringify(rows)), error: null };
      } catch (e) { return { data: null, error: e }; }
    }
  }
  const rpcs = {
    asignar_broker: (a) => { const e = DB.expedientes.find((x) => x.id === a.p_expediente); e.broker_id = a.p_broker; },
    revisar_documento: (a) => { const d = DB.documentos.find((x) => x.id === a.p_documento); d.estado = a.p_estado; d.motivo_rechazo = a.p_motivo; recalcular(d.expediente_id); },
    asignar_avaluo: (a) => { const e = DB.expedientes.find((x) => x.id === a.p_expediente); if (e.estatus !== 'documentacion_completa') throw new Error('El avalúo solo se asigna con la documentación completa'); Object.assign(e, { avaluo_valuador: a.p_valuador, avaluo_fecha: a.p_fecha, estatus: 'en_avaluo', estatus_actualizado_en: now() }); },
    asignar_firma: (a) => { const e = DB.expedientes.find((x) => x.id === a.p_expediente); Object.assign(e, { firma_fecha: a.p_fecha, firma_notaria: a.p_notaria, estatus: 'en_proceso_firma', estatus_actualizado_en: now() }); },
    confirmar_firma: (a) => { const e = DB.expedientes.find((x) => x.id === a.p_expediente); Object.assign(e, { estatus: 'firmado', firma_confirmada_en: now(), estatus_actualizado_en: now() }); },
    marcar_recomendada: (a) => { const s = DB.simulaciones.find((x) => x.id === a.p_simulacion); DB.simulaciones.filter((x) => x.expediente_id === s.expediente_id).forEach((x) => (x.recomendada = false)); s.recomendada = a.p_valor; },
    reemplazar_tasas: (a) => { DB.bancos_tasas = DB.bancos_tasas.filter((t) => t.banco_id !== a.p_banco).concat(a.p_tasas.map((t) => ({ id: uid(), banco_id: a.p_banco, ...t }))); return a.p_tasas.length; },
    admin_actualizar_usuario: (a) => { const p = DB.profiles.find((x) => x.id === a.p_usuario); p.rol = a.p_rol; p.activo = a.p_activo; },
    mapear_score_a_banda: (a) => {
      const s = a.p_score;
      if (s == null) return null;
      if (s >= 750) return 'NR 1 y 2 +'; if (s >= 700) return 'NR 3 +'; if (s >= 650) return 'NR 1 y 2'; return 'NR 3';
    },
    guardar_analisis_financiero: (a) => {
      const existente = DB.analisis_financiero.find((x) => x.expediente_id === a.p_expediente);
      const fila = {
        id: existente?.id || uid(), expediente_id: a.p_expediente, extraido: a.p_extraido || {},
        ingreso_mensual: a.p_ingreso_mensual, deuda_mensual: a.p_deuda_mensual, score_buro: a.p_score_buro, banda_riesgo: a.p_banda_riesgo,
        num_creditos_activos: a.p_num_creditos_activos, monto_creditos_activos: a.p_monto_creditos_activos, tiene_atrasos: a.p_tiene_atrasos,
        fuente_estado_cuenta_id: a.p_fuente_estado_cuenta, fuente_buro_id: a.p_fuente_buro,
        confirmado_por: me()?.id, confirmado_en: now(), created_at: existente?.created_at || now(), updated_at: now(),
      };
      if (existente) Object.assign(existente, fila); else DB.analisis_financiero.push(fila);
      DB.expediente_historial.unshift({ id: Date.now(), expediente_id: a.p_expediente, actor_id: me()?.id, evento: 'analisis_financiero_confirmado', detalle: `Ingreso: ${a.p_ingreso_mensual} · Banda: ${a.p_banda_riesgo} · Score: ${a.p_score_buro}`, created_at: now() });
      return fila;
    },
    buscar_expedientes: (a) => {
      const q = (a.p_q || '').toLowerCase().trim();
      let filas = visibles().filter((e) => {
        if (a.p_estatus && e.estatus !== a.p_estatus) return false;
        if (a.p_sin_broker && e.broker_id) return false;
        if (a.p_broker && e.broker_id !== a.p_broker) return false;
        if (q) {
          const c = DB.profiles.find((p) => p.id === e.cliente_id) || {};
          if (!`${e.folio} ${c.nombre_completo || ''} ${c.email || ''}`.toLowerCase().includes(q)) return false;
        }
        return true;
      });
      filas = filas.slice().sort((x, y) => (x.created_at < y.created_at ? 1 : -1));
      const total = filas.length;
      const pagina = filas.slice(a.p_offset || 0, (a.p_offset || 0) + (a.p_limite || 50));
      return pagina.map((e) => {
        const c = DB.profiles.find((p) => p.id === e.cliente_id) || {};
        const b = DB.profiles.find((p) => p.id === e.broker_id);
        const pend = DB.documentos.filter((d) => d.expediente_id === e.id && d.estado === 'pendiente').length;
        return { ...e, cliente_nombre: c.nombre_completo, cliente_email: c.email, broker_nombre: b?.nombre_completo, broker_email: b?.email, documentos_pendientes: pend, total_filas: total };
      });
    },
    contar_expedientes_por_estatus: () => {
      const por = {};
      for (const e of visibles()) por[e.estatus] = (por[e.estatus] || 0) + 1;
      return Object.entries(por).map(([estatus, total]) => ({ estatus, total }));
    },
  };
  const subs = [];
  const sesion = () => { const p = me(); return p ? { user: { id: p.id, email: p.email } } : null; };
  const client = {
    from: (t) => new Q(t),
    rpc: (n, a) => Promise.resolve().then(() => { try { const d = rpcs[n](a || {}); persist(); return { data: d ?? null, error: null }; } catch (e) { return { data: null, error: e }; } }),
    auth: {
      getSession: async () => ({ data: { session: sesion() } }),
      onAuthStateChange: (cb) => { subs.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithPassword: async ({ email }) => { const p = DB.profiles.find((x) => x.email === email); if (!p) return { error: new Error('Invalid login credentials') }; localStorage.setItem('mockUser', JSON.stringify(Object.keys(ID).find((k) => ID[k] === p.id))); subs.forEach((cb) => cb('SIGNED_IN', sesion())); return { data: {}, error: null }; },
      signUp: async () => ({ data: {}, error: null }), resetPasswordForEmail: async () => ({ error: null }), updateUser: async () => ({ error: null }),
      signOut: async () => { localStorage.removeItem('mockUser'); subs.forEach((cb) => cb('SIGNED_OUT', null)); return { error: null }; },
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' } }), listFactors: async () => ({ data: { all: [], totp: [] } }),
        enroll: async () => ({ data: { id: 'f1', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>', secret: 'JBSWY3DPEHPK3PXP' } }, error: null }),
        challengeAndVerify: async () => ({ error: null }), unenroll: async () => ({ error: null }) },
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => ({ error: null }), createSignedUrl: async () => ({ data: { signedUrl: 'about:blank#pdf' }, error: null }) }) },
  };
  window.supabase = { createClient: () => client };
})();
