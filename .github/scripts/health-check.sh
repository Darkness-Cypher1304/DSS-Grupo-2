#!/usr/bin/env bash
# ============================================================================
# health-check.sh — verificación REFORZADA de un despliegue de NeuroAlert.
# ----------------------------------------------------------------------------
# Uso:  health-check.sh <BASE_URL> [ETIQUETA]
#   <BASE_URL>  URL base del servicio, SIN /health   (p. ej. https://miapp-dev.onrender.com)
#   [ETIQUETA]  texto para los logs                  (p. ej. "Dev" o "Producción")
#
# Lo usan DOS jobs (paridad Dev ↔ Prod): "Health Check + Smoke Test en Dev" y
# "Production Health Check". Ambos invocan este mismo script cambiando solo la URL.
#
# QUÉ VALIDA (y POR QUÉ) — el /health real responde, envuelto por el
# TransformInterceptor, así:
#   {"data":{"status":"ok","uptime":..,"version":"1.0.0",
#            "checks":{"database":true,"cache":true}}, "meta":{...}}
#
#   1) RESPONDE y es el backend NestJS NUEVO (no la app anterior): se reintenta
#      con backoff para dar margen al cold-start de Render free-tier (la instancia
#      se duerme). Distinguir "NestJS" evita el falso verde de que la versión
#      vieja siga sirviendo mientras un build nuevo falla.
#   2) HTTP 200 en GET /health.
#   3) checks.database == true  → GATE DURO: un deploy sin base de datos NO está
#      operativo; se falla a propósito (no tiene sentido promover algo sin BD).
#   4) checks.cache            → SOLO INFORMATIVO: Redis es OPCIONAL (la app
#      degrada a almacén en memoria). "cache:false" ⇒ status:"degraded", pero eso
#      NO debe tumbar el deploy; solo se reporta.
#   5) Cabeceras de seguridad (Helmet: CSP, HSTS, X-Frame-Options,
#      X-Content-Type-Options) → se REPORTAN (no gatean, para no arriesgar la demo
#      si una cabecera cambiara de nombre; su ausencia se marca como aviso).
#
# READ-ONLY: solo hace GET /health (y una lectura de cabeceras). No escribe nada.
# Por eso es seguro incluso contra PRODUCCIÓN.
#
# Dependencias: curl + jq (ambos preinstalados en los runners ubuntu-latest).
# Config opcional por env: HEALTH_ATTEMPTS (18) · HEALTH_SLEEP (20s) · HEALTH_TIMEOUT (15s)
# ============================================================================
set -uo pipefail

BASE_URL="${1:?Falta la URL base (uso: health-check.sh <BASE_URL> [ETIQUETA])}"
LABEL="${2:-servicio}"
HEALTH_URL="${BASE_URL%/}/health"

ATTEMPTS="${HEALTH_ATTEMPTS:-18}"
SLEEP_SECS="${HEALTH_SLEEP:-20}"
CURL_TIMEOUT="${HEALTH_TIMEOUT:-15}"

echo "== Health Check reforzado — ${LABEL} (${HEALTH_URL}) =="

ok=""
for i in $(seq 1 "$ATTEMPTS"); do
  # -s: silencioso · -w '\n%{http_code}': anexa el código HTTP en la última línea.
  resp="$(curl -s -w $'\n%{http_code}' --max-time "$CURL_TIMEOUT" "$HEALTH_URL" || true)"
  code="$(printf '%s' "$resp" | tail -n1)"
  body="$(printf '%s' "$resp" | sed '$d')"

  # ¿HTTP 200 Y el cuerpo es JSON del NestJS (trae el objeto "checks")?
  # (.data // .) tolera que /health venga envuelto o no.
  if [ "$code" = "200" ] && printf '%s' "$body" | jq -e '(.data // .) | has("checks")' >/dev/null 2>&1; then
    db="$(printf '%s' "$body"     | jq -r '(.data.checks.database // .checks.database) // "missing"')"
    cache="$(printf '%s' "$body"  | jq -r '(.data.checks.cache // .checks.cache) // "missing"')"
    status="$(printf '%s' "$body" | jq -r '(.data.status // .status) // "?"')"

    if [ "$db" = "true" ]; then
      echo "✅ ${LABEL} OK — status=${status}, database=up, cache=${cache} (intento ${i}/${ATTEMPTS})"
      ok="1"
      break
    fi
    echo "Intento ${i}/${ATTEMPTS}: NestJS responde pero database=${db} (status=${status}); reintentando…"
  else
    echo "Intento ${i}/${ATTEMPTS}: aún no responde como NestJS (HTTP ${code:-timeout}); body: $(printf '%s' "$body" | head -c 80)…"
  fi
  sleep "$SLEEP_SECS"
done

if [ -z "$ok" ]; then
  echo "❌ ${LABEL} no quedó saludable tras ${ATTEMPTS} intentos (¿build falló, sigue en curso, o BD caída?)."
  exit 1
fi

# --- Smoke de seguridad: cabeceras de Helmet (informativo, NO gatea) ---
echo "-- Cabeceras de seguridad (Helmet) en ${LABEL} — informativo --"
headers="$(curl -s -o /dev/null -D - --max-time "$CURL_TIMEOUT" "$HEALTH_URL" || true)"
for h in "content-security-policy" "strict-transport-security" "x-frame-options" "x-content-type-options"; do
  if printf '%s' "$headers" | grep -iq "^${h}:"; then
    echo "  ✅ ${h} presente"
  else
    echo "  ⚠️  ${h} ausente (revisar configuración de Helmet en ${LABEL})"
  fi
done

echo "== ${LABEL}: verificación de salud completada con éxito =="
