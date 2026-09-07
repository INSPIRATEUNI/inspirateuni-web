.PHONY: init

# Comando principal de inicialización para el nuevo desarrollador
init:
	@echo "Configurando Git Hooks personalizados..."
	git config core.hooksPath .githooks
	@echo "Git Hooks configurados correctamente."
