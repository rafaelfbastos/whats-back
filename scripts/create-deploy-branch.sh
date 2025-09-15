#!/usr/bin/env bash
set -euo pipefail

# Create/update a minimal 'deploy' branch using git worktree
# Includes only the built output and runtime essentials

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Erro: este script precisa ser executado dentro de um repositório git." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Erro: há mudanças não commitadas. Faça commit/stash antes de continuar." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
SHORT_SHA="$(git rev-parse --short HEAD)"
BRANCH_NAME="${DEPLOY_BRANCH:-deploy}"

# Detect remote (prefer origin)
if git remote get-url origin >/dev/null 2>&1; then
  REMOTE_NAME="${DEPLOY_REMOTE:-origin}"
else
  FIRST_REMOTE="$(git remote | head -n1 || true)"
  if [[ -z "${FIRST_REMOTE}" ]]; then
    echo "Erro: nenhum remote git configurado. Adicione um remote (ex.: origin)." >&2
    exit 1
  fi
  REMOTE_NAME="${DEPLOY_REMOTE:-${FIRST_REMOTE}}"
fi

# Project type detection (backend expects dist/)
if [[ ! -d "${REPO_ROOT}/dist" ]]; then
  echo "Erro: build do backend não encontrado em 'dist/'. Rode 'yarn build' antes." >&2
  exit 1
fi

WORKTREE_DIR="${REPO_ROOT}/.deploy-worktree"

# Prune stale worktrees (avoids "already checked out" on reruns)
git worktree prune -v || true

# If a worktree is registered at the same path, remove it first
if git worktree list --porcelain | grep -q "^worktree ${WORKTREE_DIR}$"; then
  git worktree remove --force "${WORKTREE_DIR}" || true
fi

# Clean previous worktree dir if exists on disk
if [[ -d "${WORKTREE_DIR}" ]]; then
  rm -rf "${WORKTREE_DIR}"
fi

# Create worktree for deploy branch (or orphan if it doesn't exist)
if git show-ref --quiet "refs/heads/${BRANCH_NAME}"; then
  git worktree add -B "${BRANCH_NAME}" "${WORKTREE_DIR}"
else
  git worktree add --orphan "${BRANCH_NAME}" "${WORKTREE_DIR}"
fi

pushd "${WORKTREE_DIR}" >/dev/null

# Remove everything except .git
find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +

# Copy minimal runtime files from source repo
SRC="${REPO_ROOT}"
mkdir -p dist
cp -a "${SRC}/dist/." dist/

# package descriptor + lock file
cp -a "${SRC}/package.json" .
if [[ -f "${SRC}/yarn.lock" ]]; then
  cp -a "${SRC}/yarn.lock" .
elif [[ -f "${SRC}/package-lock.json" ]]; then
  cp -a "${SRC}/package-lock.json" .
fi

# Optional runtime assets
[[ -d "${SRC}/public" ]] && { mkdir -p public && cp -a "${SRC}/public/." public/; }
[[ -d "${SRC}/certs" ]] && { mkdir -p certs && cp -a "${SRC}/certs/." certs/; }
[[ -f "${SRC}/.env.example" ]] && cp -a "${SRC}/.env.example" .

git add -A
if git diff --cached --quiet; then
  echo "Nada para atualizar no branch 'deploy'."
else
  git commit -m "chore(deploy): backend build from ${CURRENT_BRANCH}@${SHORT_SHA}"
fi

popd >/dev/null

echo "Fazendo push automático para ${REMOTE_NAME} ${BRANCH_NAME}..."
pushd "${WORKTREE_DIR}" >/dev/null
git push -u "${REMOTE_NAME}" "${BRANCH_NAME}"
popd >/dev/null

echo "Branch '${BRANCH_NAME}' atualizado e enviado para ${REMOTE_NAME}."
