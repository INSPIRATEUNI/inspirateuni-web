.PHONY: init db-reset db-setup db-clean db-seed db-seed-staff functions-serve test-db test-e2e test-load-k6 test-load-pgbench test-all

# Comando principal de inicialización para el nuevo desarrollador
init:
	@echo "Instalando dependencias en la raíz y frontend..."
	npm install
	cd frontend && npm install
	@echo "Git Hooks configurados correctamente a través de Husky."

# Restablece la base de datos local de Supabase aplicando todas las migraciones
db-reset:
	@echo "Restableciendo base de datos y aplicando migraciones..."
	cd backend && npx supabase db reset

# OPCIONAL CASO WSL O POCA MEMORIA (LEVANTAR SOLO CONTENEDORES NECESARIOS)
# Carga esquemas DDL y catálogos de forma directa y ultrarrápida (ideal para WSL2 o máquinas con poca RAM)
db-setup:
	@echo "Cargando esquemas DDL y catálogos iniciales..."
	@for f in backend/supabase/schemas/*.sql; do \
		PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "$$f" > /dev/null 2>&1; \
	done
	@PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backend/supabase/migrations/20261106224210_seed_faculties_careers.sql > /dev/null 2>&1
	@PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backend/supabase/migrations/20261107005211_seed_logistics_options.sql > /dev/null 2>&1
	@echo "Base de datos inicializada y lista."

# Limpia datos de prueba residuales para dejar la base de datos limpia para pgTAP
db-clean:
	@echo "Limpiando datos residuales de pruebas..."
	@PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backend/tests/fixtures/clean_test_db.sql > /dev/null 2>&1 || true

# Aplica el fixture determinista para pruebas de carga y E2E
db-seed: db-clean
	@echo "Aplicando fixture de pruebas de carga y E2E..."
	@PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backend/tests/fixtures/seed_load_and_e2e.sql > /dev/null 2>&1 || \
	echo "Aviso: No se pudo conectar directamente por psql; asegúrate de que Supabase esté iniciado."

# Crea dos usuarios del staff (board y admin) para probar /intranet/open-day en local
db-seed-staff:
	@echo "Creando usuarios del staff de prueba (ver backend/tests/fixtures/seed_staff_dev.sql)..."
	@PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backend/tests/fixtures/seed_staff_dev.sql > /dev/null

# Sirve las Edge Functions con backend/supabase/functions/.env (copia de .env.example)
functions-serve:
	cd backend && npx supabase functions serve --env-file supabase/functions/.env

# Ejecuta las pruebas unitarias y E2E de base de datos con pgTAP
test-db: db-clean
	@echo "Ejecutando pruebas de base de datos (pgTAP)..."
	cd backend && npx supabase test db

# Ejecuta el flujo automatizado E2E de colegio, persona libre y expiración 48h
test-e2e: db-seed
	@echo "Ejecutando suite E2E automatizada (Node.js)..."
	node backend/tests/e2e/openday_e2e_runner.mjs

# Ejecuta la prueba de carga con k6 sobre sesiones populares
test-load-k6: db-seed
	@echo "Ejecutando prueba de carga con k6..."
	@which k6 > /dev/null 2>&1 && k6 run backend/tests/load/k6_open_day_hold.js || \
	docker run --rm -i --network=host grafana/k6 run - < backend/tests/load/k6_open_day_hold.js

# Ejecuta la prueba de estrés de concurrencia con pgbench en PostgreSQL
test-load-pgbench: db-seed
	@echo "Ejecutando benchmark de concurrencia con pgbench..."
	bash backend/tests/load/run_pgbench.sh

# Ejecuta todas las pruebas E2E (pgTAP y runner de integración)
test-all: test-db test-e2e
