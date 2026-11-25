---
name: clima-local
description: Obtiene el clima actual y el pronóstico de los próximos días para Santiago, Chile (ubicación por defecto) o para una ciudad indicada. Úsala cuando el usuario pregunte por el clima, la temperatura, si va a llover, el pronóstico o "cómo está el tiempo".
---

# Clima local

Consulta el clima con servicios gratuitos que no requieren API key. Responde siempre en español.

## Pasos

1. **Determinar la ubicación**
   - Si el usuario indicó una ciudad, úsala (reemplaza espacios por `+`).
   - Si no, usa por defecto **Santiago, Chile**: `Santiago,Chile` (lat -33.4489, lon -70.6693).

2. **Clima actual y pronóstico (resumen legible)**

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=3&lang=es"
   ```

   Para más detalle (3 días, en JSON):

   ```bash
   curl -s "https://wttr.in/<CIUDAD>?format=j1&lang=es"
   ```

   Campos útiles del JSON:
   - `current_condition[0]`: `temp_C`, `FeelsLikeC`, `humidity`, `windspeedKmph`, `precipMM`, `lang_es[0].value` (descripción).
   - `weather[0..2]`: `date`, `maxtempC`, `mintempC`, `hourly[].chanceofrain`.
   - `nearest_area[0]`: `areaName[0].value` y `country[0].value` (para confirmar la ubicación detectada).

3. **Fallback**: si `wttr.in` falla o no responde, usa Open-Meteo (necesita coordenadas; para Santiago usa lat -33.4489, lon -70.6693; para otra ciudad, geocodifícala con `https://geocoding-api.open-meteo.com/v1/search?name=<CIUDAD>&count=1`):

   ```bash
   curl -s "https://api.open-meteo.com/v1/forecast?latitude=<LAT>&longitude=<LON>&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto"
   ```

## Formato de respuesta

Resume en pocas líneas:

- 📍 Ubicación (Santiago, Chile salvo que se pida otra)
- 🌡️ Temperatura actual y sensación térmica
- ☁️ Condición, 💧 humedad, 💨 viento
- 📅 Pronóstico de hoy y los próximos 2 días (mín/máx y probabilidad de lluvia)
- Una recomendación breve si aplica (paraguas, abrigo, etc.)

## Notas

- Temperaturas en °C, viento en km/h.
- Solo se envía el nombre de la ciudad (o nada) a los servicios externos; no incluyas datos personales del usuario en las peticiones.
- Si no hay conexión a internet, díselo al usuario en lugar de inventar datos.
