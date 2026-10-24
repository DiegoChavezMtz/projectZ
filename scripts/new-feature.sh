#!/usr/bin/env bash
# Crea el esqueleto de una feature: scripts/new-feature.sh <nombreEnCamelCase>
set -euo pipefail

NAME="${1:-}"
if [[ -z "$NAME" ]]; then
  echo "Uso: new-feature.sh <nombreEnCamelCase>" >&2
  exit 1
fi
if [[ ! "$NAME" =~ ^[a-z][a-zA-Z0-9]*$ ]]; then
  echo "El nombre debe ser camelCase, ej. userProfile: $NAME" >&2
  exit 1
fi

ROOT="src/features/$NAME"
if [[ -d "$ROOT" ]]; then
  echo "La feature '$NAME' ya existe en $ROOT" >&2
  exit 1
fi

# camelCase -> PascalCase para el componente de entrada: userProfile -> UserProfile
PASCAL="$(echo "${NAME:0:1}" | tr '[:lower:]' '[:upper:]')${NAME:1}"

mkdir -p "$ROOT"/{components,hooks,utils,services,context,types}
mkdir -p "$ROOT/components/${PASCAL}View"

cat > "$ROOT/types/index.ts" <<EOF
// Entidades y DTOs de la feature '$NAME'.
// Define aquí primero; services, hooks y componentes importan de este archivo.
export {};
EOF

cat > "$ROOT/components/${PASCAL}View/${PASCAL}View.module.css" <<EOF
.root {
  padding: var(--space-4);
}
EOF

cat > "$ROOT/components/${PASCAL}View/${PASCAL}View.tsx" <<EOF
import styles from './${PASCAL}View.module.css';

// Server component por defecto. Si necesita estado de cliente,
// agrega 'use client' o mueve la lógica a un hook en ../../hooks.
export function ${PASCAL}View() {
  return <section className={styles.root}>${PASCAL}</section>;
}
EOF

cat > "$ROOT/components/${PASCAL}View/index.ts" <<EOF
export { ${PASCAL}View } from './${PASCAL}View';
EOF

cat > "$ROOT/index.ts" <<EOF
// API pública de la feature '$NAME'. Solo lo que otros módulos necesitan.
export { ${PASCAL}View } from './components/${PASCAL}View';
export type * from './types';
EOF

for d in hooks utils services context; do
  touch "$ROOT/$d/.gitkeep"
done

echo "Feature '$NAME' creada en $ROOT"
echo "Siguiente: define types/ → services/ (fetch vía @/services/http) → hooks|context/ (solo si hay interacción de cliente) → components/, y agrega la page en src/app/."
