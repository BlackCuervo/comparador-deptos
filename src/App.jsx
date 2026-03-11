import { useState, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip
} from "recharts";

// ─── SUPABASE ────────────────────────────────────────────────────────────────
const supabase = createClient(
  "https://eoshllkbjocvpdbgxoqs.supabase.co",
  "sb_publishable_nx5Chv756kDa53aGjq8KaA_U5qrKFAp"
);

// ─── PALETTE & TOKENS ────────────────────────────────────────────────────────
const T = {
  bg: "#F5F1EB",
  surface: "#FEFCF8",
  border: "#E5DDD0",
  text: "#1C1712",
  muted: "#8C7B6B",
  faint: "#C4B8A8",
  accent: "#2D6A4F",
  accentLight: "#2D6A4F18",
  danger: "#C0392B",
  dangerLight: "#C0392B15",
  warn: "#B7791F",
  warnLight: "#B7791F15",
};

const PROPERTY_COLORS = [
  "#2D6A4F", "#C0392B", "#1A56A0", "#7B2D8B", "#B7791F",
  "#0E7490", "#166534", "#9D174D",
];

// ─── NORMALIZATION ────────────────────────────────────────────────────────────
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function normalize(prop) {
  const precio = clamp(((3500 - prop.precio) / (3500 - 2000)) * 10, 0, 10);
  const area = clamp(((prop.area - 50) / (100 - 50)) * 10, 0, 10);
  const metro = clamp(((1000 - prop.metro) / (1000 - 250)) * 10, 0, 10);
  const estac = prop.estacionamiento ? 10 : 0;
  const banhos = clamp(((prop.banhos - 1) / (3 - 1)) * 10, 0, 10);
  const habitaciones = clamp(((prop.habitaciones - 1) / (3 - 1)) * 10, 0, 10);
  return { precio, area, metro, estac, banhos, habitaciones };
}

function overallScore(prop) {
  const n = normalize(prop);
  const weights = { metro: 2.5, precio: 2, area: 1.5, banhos: 1, habitaciones: 1, estac: 0.5 };
  const total = Object.entries(weights).reduce((s, [k, w]) => s + n[k] * w, 0);
  const maxTotal = Object.values(weights).reduce((s, w) => s + 10 * w, 0);
  return Math.round((total / maxTotal) * 100);
}

function passesFilter(prop, filters) {
  return prop.precio <= filters.maxPrecio && prop.area >= filters.minArea;
}

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${T.bg};}
input,select{outline:none;}
input:focus,select:focus{border-color:${T.accent} !important;box-shadow:0 0 0 3px ${T.accentLight};}
button{cursor:pointer;font-family:inherit;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-thumb{background:${T.faint};border-radius:2px;}
.fade-in{animation:fadeIn 0.35s ease;}
@keyframes fadeIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
.prop-card:hover .card-hover-actions{opacity:1 !important;}
`;

function Chip({ children, color = T.accent }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, background: color + "18", color, border: `1px solid ${color}30` }}>
      {children}
    </span>
  );
}

function Input({ label, value, onChange, type = "number", hint, min, max, step, placeholder }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.muted }}>{label}</label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step} placeholder={placeholder}
        style={{
          padding: "10px 14px", borderRadius: 8, border: `1.5px solid ${T.border}`,
          background: T.surface, fontFamily: "inherit", fontSize: 15, color: T.text,
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
      />
      {hint && <span style={{ fontSize: 11, color: T.faint }}>{hint}</span>}
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: s = {} }) {
  const base = {
    padding: "10px 22px", borderRadius: 8, fontSize: 13, fontWeight: 600,
    border: "none", fontFamily: "inherit", transition: "all 0.15s", letterSpacing: 0.3,
    opacity: disabled ? 0.45 : 1, ...s,
  };
  const variants = {
    primary: { background: T.accent, color: "#fff" },
    secondary: { background: "transparent", color: T.text, border: `1.5px solid ${T.border}` },
    ghost: { background: "transparent", color: T.muted, border: "none", padding: "8px 14px" },
    danger: { background: T.dangerLight, color: T.danger, border: `1.5px solid ${T.danger}30` },
  };
  return <button disabled={disabled} onClick={onClick} style={{ ...base, ...variants[variant] }}>{children}</button>;
}

// ─── SCREEN 0: LOGIN ──────────────────────────────────────────────────────────
function LoginScreen() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError("Correo o contraseña incorrectos.");
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else setSuccess("¡Cuenta creada! Revisa tu correo para confirmar tu cuenta y luego inicia sesión.");
    }
    setLoading(false);
  };

  return (
    <div className="fade-in" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: T.bg }}>
      <div style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <p style={{ fontSize: 11, letterSpacing: 3, color: T.faint, textTransform: "uppercase", marginBottom: 12 }}>Comparador de Deptos</p>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 38, fontWeight: 700, color: T.text, lineHeight: 1.1, marginBottom: 16 }}>
          {mode === "login" ? "Bienvenido" : "Crear cuenta"}
        </h1>
        <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          {mode === "login"
            ? "Inicia sesión para acceder a tus deptos guardados."
            : "Crea tu cuenta para guardar y comparar deptos."}
        </p>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, boxShadow: "0 2px 20px rgba(0,0,0,0.05)", textAlign: "left" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Input label="Correo electrónico" value={email} onChange={setEmail} type="text" placeholder="tu@correo.com" />
            <Input label="Contraseña" value={password} onChange={setPassword} type="password" placeholder="Mínimo 6 caracteres" />
          </div>

          {error && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: T.dangerLight, border: `1px solid ${T.danger}30`, fontSize: 13, color: T.danger }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: T.accentLight, border: `1px solid ${T.accent}30`, fontSize: 13, color: T.accent }}>
              {success}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading || !email || !password} style={{
            marginTop: 20, width: "100%", padding: "13px", borderRadius: 10,
            border: "none", background: T.accent, color: "#fff",
            fontSize: 15, fontWeight: 600, cursor: loading ? "wait" : "pointer",
            fontFamily: "inherit", opacity: (loading || !email || !password) ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}>
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>

          <p style={{ marginTop: 16, fontSize: 13, color: T.muted, textAlign: "center" }}>
            {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); setSuccess(""); }}
              style={{ background: "none", border: "none", color: T.accent, fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              {mode === "login" ? "Regístrate" : "Inicia sesión"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 1: CONFIG ─────────────────────────────────────────────────────────
function ConfigScreen({ onDone, user, onSignOut }) {
  const [maxPrecio, setMaxPrecio] = useState(3000);
  const [minArea, setMinArea] = useState(50);

  return (
    <div className="fade-in" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, background: T.bg }}>
      <div style={{ maxWidth: 440, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} style={{ width: 32, height: 32, borderRadius: "50%", border: `2px solid ${T.border}` }} />
            )}
            <span style={{ fontSize: 13, color: T.muted }}>{user?.user_metadata?.full_name || user?.email}</span>
          </div>
          <Btn variant="ghost" onClick={onSignOut} style={{ fontSize: 12 }}>Cerrar sesión</Btn>
        </div>

        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, letterSpacing: 3, color: T.faint, textTransform: "uppercase", marginBottom: 12 }}>Comparador de Deptos</p>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 38, fontWeight: 700, color: T.text, lineHeight: 1.1, marginBottom: 16 }}>
            Define tus<br /><em style={{ color: T.accent }}>mínimos</em>
          </h1>
          <p style={{ color: T.muted, fontSize: 15, lineHeight: 1.6 }}>
            Solo los deptos que cumplan estos requisitos entrarán al comparador. Puedes ajustarlos más adelante.
          </p>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 20, marginBottom: 24, boxShadow: "0 2px 20px rgba(0,0,0,0.05)" }}>
          <Input label="Precio máximo" value={maxPrecio} onChange={setMaxPrecio} type="number" hint="En UF · Rango típico: 2.000 – 3.500 UF" min={1000} max={10000} step={50} />
          <div style={{ borderTop: `1px solid ${T.border}` }} />
          <Input label="Superficie mínima" value={minArea} onChange={setMinArea} type="number" hint="En m² · Rango típico: 50 – 100 m²" min={20} max={300} step={5} />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
          <Chip>Precio ≤ {Number(maxPrecio).toLocaleString()} UF</Chip>
          <Chip>Superficie ≥ {minArea} m²</Chip>
        </div>

        <Btn onClick={() => onDone({ maxPrecio: Number(maxPrecio), minArea: Number(minArea) })} style={{ width: "100%", padding: "14px", fontSize: 14 }}>
          Comenzar a comparar →
        </Btn>
      </div>
    </div>
  );
}

// ─── FORM MODAL ───────────────────────────────────────────────────────────────
const EMPTY_FORM = { alias: "", link: "", precio: "", area: "", metro: "", estacionamiento: false, banhos: 1, habitaciones: 2, orientacion: "", gastosCom: "" };

function PropForm({ initial = EMPTY_FORM, onSave, onCancel, filters }) {
  const [f, setF] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const valid = f.alias && f.precio && f.area && f.metro;
  const passes = valid && Number(f.precio) <= filters.maxPrecio && Number(f.area) >= filters.minArea;

  const handleSave = async () => {
    setSaving(true);
    await onSave({ ...f, precio: Number(f.precio), area: Number(f.area), metro: Number(f.metro), gastosCom: f.gastosCom ? Number(f.gastosCom) : null });
    setSaving(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,23,18,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div className="fade-in" style={{ background: T.surface, borderRadius: 20, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700 }}>
            {initial.alias ? "Editar depto" : "Agregar depto"}
          </h2>
          <Btn variant="ghost" onClick={onCancel}>✕</Btn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Input label="Alias / nombre" value={f.alias} onChange={v => set("alias", v)} type="text" placeholder="Ej: Ñuñoa - Irarrázaval" />
          <Input label="Link de referencia" value={f.link} onChange={v => set("link", v)} type="text" placeholder="URL del portal (opcional)" />
          <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Input label="Precio (UF)" value={f.precio} onChange={v => set("precio", v)} min={500} max={20000} step={50} placeholder="Ej: 2800" />
            <Input label="Superficie (m²)" value={f.area} onChange={v => set("area", v)} min={20} max={500} step={1} placeholder="Ej: 65" />
            <Input label="Dist. metro (m)" value={f.metro} onChange={v => set("metro", v)} min={0} max={5000} step={50} placeholder="Ej: 400" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.muted }}>Estacionamiento</label>
              <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => set("estacionamiento", v)} style={{
                    flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 13, fontWeight: 500,
                    border: `1.5px solid ${f.estacionamiento === v ? T.accent : T.border}`,
                    background: f.estacionamiento === v ? T.accentLight : "transparent",
                    color: f.estacionamiento === v ? T.accent : T.muted,
                    transition: "all 0.15s",
                  }}>{v ? "Sí" : "No"}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[["banhos", "Baños"], ["habitaciones", "Habitaciones"]].map(([k, label]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.muted }}>{label}</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => set(k, n)} style={{
                      flex: 1, padding: "10px 0", borderRadius: 8, fontSize: 14, fontWeight: 600,
                      border: `1.5px solid ${f[k] === n ? T.accent : T.border}`,
                      background: f[k] === n ? T.accentLight : "transparent",
                      color: f[k] === n ? T.accent : T.muted,
                      transition: "all 0.15s",
                    }}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${T.border}`, margin: "4px 0" }} />
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.faint }}>Información complementaria</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: T.muted }}>Orientación</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {["Norte", "Sur", "Oriente", "Poniente"].map(o => (
                  <button key={o} onClick={() => set("orientacion", f.orientacion === o ? "" : o)} style={{
                    flex: "1 1 40%", padding: "8px 4px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                    border: `1.5px solid ${f.orientacion === o ? T.accent : T.border}`,
                    background: f.orientacion === o ? T.accentLight : "transparent",
                    color: f.orientacion === o ? T.accent : T.muted,
                    transition: "all 0.15s",
                  }}>{o}</button>
                ))}
              </div>
            </div>
            <Input label="Gastos comunes ($)" value={f.gastosCom} onChange={v => set("gastosCom", v)} type="number" min={0} step={5000} placeholder="Ej: 85000" />
          </div>
          {valid && !passes && (
            <div style={{ padding: "10px 14px", borderRadius: 8, background: T.warnLight, border: `1px solid ${T.warn}30`, fontSize: 13, color: T.warn }}>
              ⚠ Este depto no cumple tus filtros mínimos — igual puedes guardarlo, quedará marcado como descartado.
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <Btn variant="secondary" onClick={onCancel} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn disabled={!valid || saving} onClick={handleSave} style={{ flex: 2 }}>
            {saving ? "Guardando..." : "Guardar depto"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

// ─── SCREEN 2: LIST ───────────────────────────────────────────────────────────
function ListScreen({ props, filters, selected, onSelect, onAdd, onEdit, onDelete, onCompare, onEditFilters, user, onSignOut, loading }) {
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const handleSave = useCallback(async (data) => {
    if (editTarget !== null) {
      await onEdit(editTarget, data);
    } else {
      await onAdd(data);
    }
    setShowForm(false);
    setEditTarget(null);
  }, [editTarget, onAdd, onEdit]);

  const passing = props.filter(p => passesFilter(p, filters));
  const failing = props.filter(p => !passesFilter(p, filters));

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: T.text }}>Mis Deptos</h1>
            <div style={{ display: "flex", gap: 6 }}>
              <Chip>{passing.length} pasan filtros</Chip>
              {failing.length > 0 && <Chip color={T.warn}>{failing.length} descartados</Chip>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {user?.user_metadata?.avatar_url && (
              <img src={user.user_metadata.avatar_url} style={{ width: 28, height: 28, borderRadius: "50%", border: `2px solid ${T.border}` }} />
            )}
            <Btn variant="ghost" onClick={onEditFilters} style={{ fontSize: 12 }}>⚙ Filtros</Btn>
            <Btn variant="ghost" onClick={onSignOut} style={{ fontSize: 12 }}>Salir</Btn>
            <Btn onClick={() => { setEditTarget(null); setShowForm(true); }} style={{ fontSize: 13 }}>+ Agregar</Btn>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "16px 24px 0" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: T.faint }}>Filtros activos:</span>
          <Chip>Precio ≤ {filters.maxPrecio.toLocaleString()} UF</Chip>
          <Chip>Superficie ≥ {filters.minArea} m²</Chip>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "20px 24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 22, color: T.muted }}>Cargando tus deptos...</p>
          </div>
        ) : props.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px", color: T.faint }}>
            <p style={{ fontFamily: "'Fraunces', serif", fontSize: 22, marginBottom: 8, color: T.muted }}>Sin deptos aún</p>
            <p style={{ fontSize: 14, marginBottom: 24 }}>Agrega tu primer depto para comenzar</p>
            <Btn onClick={() => setShowForm(true)}>+ Agregar primer depto</Btn>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {props.map((p, i) => {
              const passes = passesFilter(p, filters);
              const isSelected = selected.includes(p.id);
              const score = overallScore(p);
              const color = PROPERTY_COLORS[i % PROPERTY_COLORS.length];
              const canSelect = isSelected || selected.length < 3;
              return (
                <div key={p.id} className="prop-card" style={{
                  background: T.surface,
                  border: `1.5px solid ${isSelected ? color : passes ? T.border : T.warn + "55"}`,
                  borderRadius: 14, padding: "16px 20px",
                  display: "grid", gridTemplateColumns: "auto 1fr auto",
                  gap: 16, alignItems: "center",
                  opacity: passes ? 1 : 0.65,
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  boxShadow: isSelected ? `0 0 0 3px ${color}20` : "none",
                }}>
                  <button onClick={() => (canSelect || isSelected) ? onSelect(p.id) : null}
                    disabled={!canSelect && !isSelected}
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: `2px solid ${isSelected ? color : T.border}`,
                      background: isSelected ? color : "transparent",
                      color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all 0.15s", flexShrink: 0,
                      opacity: (!canSelect && !isSelected) ? 0.35 : 1,
                    }}>{isSelected ? "✓" : ""}</button>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: T.text }}>{p.alias}</span>
                      {!passes && <Chip color={T.warn}>Descartado</Chip>}
                      {passes && isSelected && <Chip color={color}>Seleccionado</Chip>}
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {[
                        ["💰", `${p.precio.toLocaleString()} UF`],
                        ["📐", `${p.area} m²`],
                        ["🚇", `${p.metro}m al metro`],
                        ["🚗", p.estacionamiento ? "Con estac." : "Sin estac."],
                        ["🛁", `${p.banhos} baño${p.banhos > 1 ? "s" : ""}`],
                        ["🛏", `${p.habitaciones} hab.`],
                        ...(p.orientacion ? [["🧭", p.orientacion]] : []),
                        ...(p.gastosCom ? [["🏢", `$${Number(p.gastosCom).toLocaleString()} GC`]] : []),
                      ].map(([icon, val]) => (
                        <span key={val} style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "center", gap: 4 }}>
                          <span>{icon}</span>{val}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                    {passes && (
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: 22, fontWeight: 700, color: score >= 70 ? T.accent : score >= 50 ? T.warn : T.danger, lineHeight: 1 }}>{score}</div>
                        <div style={{ fontSize: 10, color: T.faint, letterSpacing: 0.5 }}>score</div>
                      </div>
                    )}
                    <div className="card-hover-actions" style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }}>
                      <Btn variant="ghost" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => { setEditTarget(p.id); setShowForm(true); }}>Editar</Btn>
                      <Btn variant="danger" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => onDelete(p.id)}>✕</Btn>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected.length >= 2 && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 20 }}>
          <div className="fade-in" style={{
            background: T.text, color: "#fff", borderRadius: 50, padding: "14px 28px",
            display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}>
            <span style={{ fontSize: 14 }}>{selected.length} deptos seleccionados</span>
            <button onClick={onCompare} style={{
              background: T.accent, color: "#fff", border: "none", borderRadius: 30,
              padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>Comparar →</button>
          </div>
        </div>
      )}

      {showForm && (
        <PropForm
          initial={editTarget !== null ? props.find(p => p.id === editTarget) : EMPTY_FORM}
          filters={filters} onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditTarget(null); }}
        />
      )}
    </div>
  );
}

// ─── SCREEN 3: COMPARE ────────────────────────────────────────────────────────
const AXIS_LABELS = {
  precio: "Precio", area: "Superficie", metro: "Metro",
  estac: "Estaciona-\nmiento", banhos: "Baños", habitaciones: "Habitaciones",
};

function CustomAngleAxis({ payload, x, y, textAnchor }) {
  const lines = payload.value.split("\n");
  return (
    <text x={x} y={y} textAnchor={textAnchor} fontSize={11} fill={T.muted} fontFamily="DM Sans" fontWeight={500}>
      {lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 14}>{l}</tspan>)}
    </text>
  );
}

function CompareScreen({ props, selected, onBack }) {
  const selectedProps = selected.map(id => props.find(p => p.id === id)).filter(Boolean);
  const colorMap = {};
  selected.forEach(id => { colorMap[id] = PROPERTY_COLORS[props.findIndex(p => p.id === id) % PROPERTY_COLORS.length]; });

  const radarData = Object.keys(AXIS_LABELS).map(key => {
    const entry = { axis: AXIS_LABELS[key] };
    selectedProps.forEach(p => { entry[p.alias] = +normalize(p)[key].toFixed(1); });
    return entry;
  });

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Btn variant="ghost" onClick={onBack} style={{ fontSize: 13 }}>← Volver</Btn>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700 }}>Comparativa</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {selectedProps.map(p => <Chip key={p.id} color={colorMap[p.id]}>{p.alias}</Chip>)}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px" }}>
        <div className="fade-in" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: "32px 16px 24px", marginBottom: 24, boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}>
          <p style={{ textAlign: "center", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: T.faint, marginBottom: 4 }}>Análisis comparativo</p>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 700, textAlign: "center", marginBottom: 24, color: T.text }}>Radar de propiedades</h2>
          <ResponsiveContainer width="100%" height={380}>
            <RadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
              <PolarGrid stroke={T.border} strokeDasharray="3 3" />
              <PolarAngleAxis dataKey="axis" tick={<CustomAngleAxis />} />
              {selectedProps.map(p => (
                <Radar key={p.id} name={p.alias} dataKey={p.alias}
                  stroke={colorMap[p.id]} fill={colorMap[p.id]} fillOpacity={0.12}
                  strokeWidth={2.5} dot={{ r: 4, fill: colorMap[p.id], strokeWidth: 0 }} />
              ))}
              <Tooltip contentStyle={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, fontFamily: "DM Sans", fontSize: 12 }}
                formatter={(v, name) => [`${v}/10`, name]} />
            </RadarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
            {selectedProps.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: colorMap[p.id] }} />
                <span style={{ fontSize: 12, color: T.muted }}>{p.alias}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${selectedProps.length}, 1fr)`, gap: 16, marginBottom: 24 }}>
          {selectedProps.map(p => {
            const score = overallScore(p);
            const color = colorMap[p.id];
            return (
              <div key={p.id} className="fade-in" style={{ background: T.surface, border: `2px solid ${color}40`, borderRadius: 16, padding: "20px", textAlign: "center", boxShadow: `0 4px 20px ${color}15` }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: 52, fontWeight: 700, color, lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 11, color: T.faint, marginBottom: 12, letterSpacing: 1 }}>/ 100</div>
                <div style={{ fontWeight: 600, fontSize: 14, color: T.text, marginBottom: 4 }}>{p.alias}</div>
                {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.accent, textDecoration: "none" }}>Ver en portal →</a>}
              </div>
            );
          })}
        </div>

        <div className="fade-in" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>Detalle por variable</h3>
          </div>
          {[
            { label: "Precio", key: "precio", format: v => `${v.toLocaleString()} UF`, lower: true },
            { label: "Superficie", key: "area", format: v => `${v} m²`, lower: false },
            { label: "Dist. metro", key: "metro", format: v => `${v}m`, lower: true },
            { label: "Estacionamiento", key: "estacionamiento", format: v => v ? "✓ Sí" : "✗ No", lower: false },
            { label: "Baños", key: "banhos", format: v => v, lower: false },
            { label: "Habitaciones", key: "habitaciones", format: v => v, lower: false },
            { label: "Orientación", key: "orientacion", format: v => v || "—", info: true },
            { label: "Gastos comunes", key: "gastosCom", format: v => v ? `$${Number(v).toLocaleString()}` : "—", info: true },
          ].map((row, ri) => {
            const vals = selectedProps.map(p => p[row.key]);
            const best = row.info ? null : (row.lower ? Math.min(...vals.filter(v => typeof v === "number")) : Math.max(...vals.filter(v => typeof v === "number")));
            return (
              <div key={row.key} style={{ display: "grid", gridTemplateColumns: `160px repeat(${selectedProps.length}, 1fr)`, borderBottom: ri < 7 ? `1px solid ${T.border}` : "none", background: ri % 2 === 0 ? "transparent" : `${T.bg}80` }}>
                <div style={{ padding: "14px 24px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ color: T.muted, fontWeight: 500 }}>{row.label}</span>
                  {row.info && <span style={{ fontSize: 9, color: T.faint, background: T.border, padding: "1px 6px", borderRadius: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>info</span>}
                </div>
                {selectedProps.map(p => {
                  const val = p[row.key];
                  const numVal = typeof val === "number" ? val : null;
                  const isBest = !row.info && numVal !== null && numVal === best;
                  const color = colorMap[p.id];
                  return (
                    <div key={p.id} style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: row.info ? 400 : 600, color: isBest ? color : row.info ? T.muted : T.text, fontFamily: isBest ? "'Fraunces', serif" : "inherit" }}>
                        {row.format(val)}
                      </span>
                      {isBest && <span style={{ fontSize: 9, color, background: `${color}15`, border: `1px solid ${color}30`, padding: "2px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>mejor</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="fade-in" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", marginTop: 16, boxShadow: "0 2px 20px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}` }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 700 }}>Puntaje por eje <span style={{ fontSize: 13, color: T.faint, fontFamily: "'DM Sans'", fontWeight: 400 }}>(0–10)</span></h3>
          </div>
          {Object.entries(AXIS_LABELS).map(([key, label], ri) => (
            <div key={key} style={{ display: "grid", gridTemplateColumns: `160px repeat(${selectedProps.length}, 1fr)`, borderBottom: ri < 5 ? `1px solid ${T.border}` : "none", background: ri % 2 === 0 ? "transparent" : `${T.bg}80` }}>
              <div style={{ padding: "14px 24px", fontSize: 12, color: T.muted, fontWeight: 500, display: "flex", alignItems: "center" }}>{label.replace("\n", " ")}</div>
              {selectedProps.map(p => {
                const score = +normalize(p)[key].toFixed(1);
                const color = colorMap[p.id];
                return (
                  <div key={p.id} style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ height: 6, width: `${score * 10}%`, minWidth: 4, background: color, borderRadius: 3, opacity: 0.7 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{score}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [screen, setScreen] = useState("config");
  const [filters, setFilters] = useState({ maxPrecio: 3000, minArea: 50 });
  const [props, setProps] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loadingProps, setLoadingProps] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) { setProps([]); setSelected([]); setScreen("config"); }
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoadingProps(true);
    supabase.from("propiedades").select("*").order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
          setProps(data.map(d => ({
            id: d.id, alias: d.alias, link: d.link || "",
            precio: d.precio, area: d.area, metro: d.metro,
            estacionamiento: d.estacionamiento, banhos: d.banhos, habitaciones: d.habitaciones,
            orientacion: d.orientacion || "", gastosCom: d.gastos_com || "",
          })));
        }
        setLoadingProps(false);
      });
  }, [session]);

  const handleAdd = async (data) => {
    const { data: inserted, error } = await supabase.from("propiedades")
      .insert([{ user_id: session.user.id, alias: data.alias, link: data.link, precio: data.precio, area: data.area, metro: data.metro, estacionamiento: data.estacionamiento, banhos: data.banhos, habitaciones: data.habitaciones, orientacion: data.orientacion || null, gastos_com: data.gastosCom || null }])
      .select().single();
    if (!error && inserted) setProps(prev => [...prev, { ...data, id: inserted.id }]);
  };

  const handleEdit = async (id, data) => {
    const { error } = await supabase.from("propiedades")
      .update({ alias: data.alias, link: data.link, precio: data.precio, area: data.area, metro: data.metro, estacionamiento: data.estacionamiento, banhos: data.banhos, habitaciones: data.habitaciones, orientacion: data.orientacion || null, gastos_com: data.gastosCom || null })
      .eq("id", id);
    if (!error) setProps(prev => prev.map(p => p.id === id ? { ...data, id } : p));
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("propiedades").delete().eq("id", id);
    if (!error) { setProps(prev => prev.filter(p => p.id !== id)); setSelected(prev => prev.filter(x => x !== id)); }
  };

  const handleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProps([]); setSelected([]); setScreen("config");
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, fontFamily: "'DM Sans', sans-serif", color: T.faint }}>
        <style>{css}</style>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{css}</style>
      {!session && <LoginScreen />}
      {session && screen === "config" && <ConfigScreen user={session.user} onDone={(f) => { setFilters(f); setScreen("list"); }} onSignOut={handleSignOut} />}
      {session && screen === "list" && <ListScreen props={props} filters={filters} selected={selected} onSelect={handleSelect} onAdd={handleAdd} onEdit={handleEdit} onDelete={handleDelete} onCompare={() => setScreen("compare")} onEditFilters={() => setScreen("config")} user={session.user} onSignOut={handleSignOut} loading={loadingProps} />}
      {session && screen === "compare" && <CompareScreen props={props} selected={selected} onBack={() => setScreen("list")} />}
    </div>
  );
}
