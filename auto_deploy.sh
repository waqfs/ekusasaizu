#!/usr/bin/env bash
set -euo pipefail

REGION="us-central1"
REPO_NAME="app-repo"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <PROJECT_ID> [BACKEND_NAME] [GEMINI_API_KEY]"
  echo ""
  echo "  PROJECT_ID      Your Google Cloud project ID"
  echo "  BACKEND_NAME    Name for the Cloud Run service (default: app-backend)"
  echo "  GEMINI_API_KEY  Optional Gemini API key to set on the deployed service"
  exit 1
fi

PROJECT_ID="$1"
BACKEND_NAME="${2:-app-backend}"
GEMINI_KEY="${3:-}"
IMAGE_TAG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${BACKEND_NAME}"

echo "==> Setting project to ${PROJECT_ID}"
gcloud config set project "$PROJECT_ID"

echo "==> Enabling required services..."
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com

echo "==> Creating Artifact Registry repository (if it does not exist)..."
gcloud artifacts repositories create "$REPO_NAME" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Docker repo for Ekusasaizu" 2>/dev/null || true

echo "==> Building and pushing backend image..."
gcloud builds submit backend \
  --tag "$IMAGE_TAG"

echo "==> Deploying to Cloud Run..."
DEPLOY_FLAGS=(
  --image "$IMAGE_TAG"
  --region "$REGION"
  --platform managed
  --allow-unauthenticated
  --format="value(status.url)"
)
if [[ -n "$GEMINI_KEY" ]]; then
  DEPLOY_FLAGS+=(--set-env-vars "GEMINI_API_KEY=${GEMINI_KEY}")
fi
SERVICE_URL=$(gcloud run deploy "$BACKEND_NAME" "${DEPLOY_FLAGS[@]}")

echo ""
echo "========================================"
echo " Deployment complete!"
echo " Service URL: ${SERVICE_URL}"
echo "========================================"
echo ""
echo "To build the frontend with this backend:"
echo "  cd frontend"
echo "  VITE_API_URL=${SERVICE_URL} bun run build"
echo ""
echo "To deploy to GitHub Pages:"
echo "  VITE_BASE_PATH=/repo_name/ VITE_API_URL=${SERVICE_URL} bun run gh-deploy"
