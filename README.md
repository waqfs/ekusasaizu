### Deployment Steps

1. Install the [`gcloud`](https://cloud.google.com/cli) and [`firebase`](https://firebase.google.com/docs/cli/) CLI tools (Firebase is an optional step in this process, our frontend can be hosted anywhere)
2. Authenticate both tools:

```zsh
gcloud auth login
firebase login
```

3. Set the project for `glcoud`:

```zsh
gcloud config set project YOUR_PROJECT_ID
```

4. Enable requires services:

```zsh
gcloud services enable \
 run.googleapis.com \
 artifactregistry.googleapis.com \
 cloudbuild.googleapis.com \
 firebase.googleapis.com
```

5. If hosting on `firebase`, make sure you have accepted the Firebase terms by following these steps:
   - Head to https://console.firebase.google.com
   - Select "Get started by setting up a Firebase project", then "Add Firebase to Google Cloud project"
   - Then select a Google Cloud project and check "I accept the Firebase terms"
   - Read the terms, especially the billing terms, then press "Continue" and "Confirm and continue".
   - You'll finish on a "Your Firebase project is ready"

If you have already used Firebase before, you can do this in the CLI:

```zsh
firebase projects:addfirebase
```

6. Set up the Cloud Run repository:

```zsh
gcloud artifacts repositories create app-repo \
 --repository-format=docker \
 --location=us-central1 \
 --description="Docker repo for app"
```

7. Clone the repository and change directory into the source code:

```zsh
git clone https://github.com/waqfs/ekusasaizu.git
cd ekusasaizu
```

8. Then upload the backend to Cloud Run:

```zsh
gcloud builds submit backend \
 --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/app-repo/maomao-backend

gcloud run deploy maomao-backend \
 --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/app-repo/maomao-backend \
 --region us-central1 \
 --platform managed \
 --allow-unauthenticated
```

> These two commands can be ran again to update the backend after changes have been made.

9. After deploying, you'll receive a service URL like `https://project-backend-XXXXXX.us-central1.run.app` which will be used in the next steps to host the frontend.

10. To host on GitHub pages, `cd` into `frontend` and run the build+deploy script with the service URL:

```zsh
# Dev Server
VITE_API_URL=https://project-backend-XXXXXX.us-central1.run.app bun run dev

# Build Bundle
VITE_API_URL=https://project-backend-XXXXXX.us-central1.run.app bun run build

# Build + Deploy on GitHub
VITE_BASE_PATH=/repo_name/ VITE_API_URL=https://project-backend-XXXXXX.us-central1.run.app bun run gh-deploy
```

> You will have to provide `VITE_BASE_PATH=/repo_name/` for the project to work as root on a custom path of the domain.
