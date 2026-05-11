# DSS-Grupo-2

## Descripción

Aplicación Flask con pipeline CI/CD automatizado usando GitHub Actions, Docker y Render.

---

## Tecnologías utilizadas

- Python 3.11
- Flask
- Docker
- GitHub Actions
- Render
- Pytest
- Bandit

---

## Pipeline CI/CD

El pipeline automatizado ejecuta el siguiente flujo:

1. Push a `main`
2. Ejecución automática de tests
3. Análisis de seguridad con Bandit
4. Deploy automático a entorno Dev
5. Smoke Test sobre el endpoint `/health`
6. Deploy automático a Producción

---

## URLs de despliegue

### Dev
https://miapp-dev.onrender.com

### Producción
https://miapp-6ex5.onrender.com

---

## Seguridad

El pipeline incluye análisis SAST automatizado utilizando Bandit para detectar posibles vulnerabilidades en código Python.

---

## Evidencia del pipeline

El pipeline fue probado exitosamente en los siguientes escenarios:

- Pipeline exitoso con deploy completo Dev → Prod
- Bloqueo automático del pipeline cuando los tests fallan
- Validación automática mediante smoke tests

---

- Pull Requests creados desde GitHub CLI

---

Prueba de protección de rama

---

Prueba del merge en la rama main
