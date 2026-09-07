# NextUp

A modern streaming dashboard that aggregates your library and resolves video streams via AIOStreams.

## Prerequisites

- Node.js (v18+)
- A provisioned Firebase project (for authentication and database)
- TMDB API Key
- AIOStreams service endpoint

## Environment Variables

Copy `.env.example` to `.env` or set these in your deployment environment:

```env
VITE_TMDB_API_KEY=your_tmdb_key
VITE_AIOSTREAMS_BASE_URL=https://your-aiostreams-instance.com
```

You must also configure Firebase credentials. The deployment process requires a `firebase-applet-config.json` file.

## Setup & Development

```sh
npm install
npm run dev
```

The application will start in development mode on port 3000.

## Production Build

To build the static SPA and the Node server entry:

```sh
npm run build
npm run start
```

## Deployment

The application is structured to be deployed as a static Single Page Application (SPA).
The `server.ts` file acts as a simple static file server for local containerized deployment but does not proxy external API requests. 

For GitHub Pages, ensure you build the static assets (`npm run build`) and configure router fallbacks for a client-side single page app. A Node server is not strictly required if you host the static files securely.
