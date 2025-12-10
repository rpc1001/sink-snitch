# Deployment Guide (Cloud Run + GCS)

Billing has to be enabled because Cloud Run and GCS are billed services (butfree tier covers our usage).

## Overview
- Backend: Flask + Socket.IO container on Cloud Run. Processes browser webcam frames (no server webcam needed).
- Media storage: Google Cloud Storage (GCS) for violation images/clips (durable; Cloud Run filesystem is ephemeral).
- Frontend: Build Vite React app, host static files (Cloud Run static service or GCS/Firebase Hosting). Point it to the backend URL via `VITE_API_BASE_URL`.

## Prerequisites
1. GCP project with billing enabled.
2. gcloud CLI installed and authenticated:
   ```bash
   gcloud auth login
   gcloud config set project <YOUR_PROJECT_ID>
   ```
3. Enable required APIs:
   ```bash
   gcloud services enable run.googleapis.com storage.googleapis.com
   ```
4. Create a GCS bucket for media (unique name, pick a region):
   ```bash
   BUCKET=<your-bucket-name>
   gsutil mb -l us-central1 gs://$BUCKET
   ```

## Backend: Build & Deploy
1. Dockerfile is already present at `backend/Dockerfile`.
2. Build and push the image (Artifact Registry or gcr). Example with Artifact Registry (adjust region):
   ```bash
   REGION=us-central1
   IMAGE=us-central1-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/sink-snitch/backend
   gcloud artifacts repositories create sink-snitch --repository-format=docker --location=$REGION --async || true
   gcloud builds submit --tag $IMAGE backend/
   ```
   (If using gcr: `gcloud builds submit --tag gcr.io/$GOOGLE_CLOUD_PROJECT/sink-snitch-backend backend/`)
4. Deploy to Cloud Run:
   ```bash
   gcloud run deploy sink-snitch-backend \
     --image=$IMAGE \
     --platform=managed \
     --region=$REGION \
     --allow-unauthenticated \
     --set-env-vars=GCS_BUCKET=$BUCKET,GCS_PUBLIC_BASE=https://storage.googleapis.com/$BUCKET,PUBLIC_BASE_URL=<BACKEND_URL_ON_DEPLOY>
   ```
   Notes:
   - Cloud Run sets `PORT` automatically; code binds to `$PORT`.
   - `PUBLIC_BASE_URL` should be the final backend URL (after deploy you can re-set if needed).
   - Service account must have Storage Object Admin (or at least create/get) on the bucket:
     ```bash
     SA=$(gcloud run services describe sink-snitch-backend --region=$REGION --format='value(spec.template.spec.serviceAccount)')
     gcloud projects add-iam-policy-binding $GOOGLE_CLOUD_PROJECT \
       --member=serviceAccount:$SA \
       --role=roles/storage.objectAdmin
     ```

## Frontend: Build & Host
1. Set backend API URL:
   - In `frontend/`, create `.env.production`:
     ```
     VITE_API_BASE_URL=<BACKEND_CLOUD_RUN_URL>
     ```
2. Build:
   ```bash
   cd frontend
   npm install
   npm run build
   ```
3. Host options:
   - Cloud Run static service: Dockerfile already present at `frontend/Dockerfile` (serves `dist/` via `serve` on $PORT). Deploy similarly to backend with a different service name, e.g.:
     ```bash
     REGION=us-central1
     IMAGE_FE=us-central1-docker.pkg.dev/$GOOGLE_CLOUD_PROJECT/sink-snitch/frontend
     gcloud builds submit --tag $IMAGE_FE frontend/
     gcloud run deploy sink-snitch-frontend \
       --image=$IMAGE_FE \
       --platform=managed \
       --region=$REGION \
       --allow-unauthenticated \
       --set-env-vars=PORT=8080
     ```
   - Or host on GCS static site / Firebase Hosting if preferred.

## Runtime Expectations
- Users’ browser webcams stream frames to backend; no server webcam needed.
- Media is uploaded to GCS; frontend prefers the provided URLs. Without `GCS_BUCKET`, media is local/ephemeral on Cloud Run.
- Concurrency: minimal multi-user; global tracking state means sessions are not fully isolated.

## Verification Checklist
1. Hit backend health: `curl https://<backend-url>/health` → `{"status":"ok"}`
2. Frontend loads and connects (socket connects, status shows Connected).
3. Start Detection: browser asks for webcam; frames stream; annotated frames render.
4. Violation media: new violations appear with images/clips; clip/image URLs resolve (GCS or API fallback).

## Env Vars Summary
- `PORT`: (Cloud Run provided)
- `GCS_BUCKET`: bucket name (required for durable media)
- `GCS_PUBLIC_BASE`: optional; e.g., `https://storage.googleapis.com/<bucket>`
- `PUBLIC_BASE_URL`: backend public URL (for link construction)
- Frontend: `VITE_API_BASE_URL` set to backend URL

