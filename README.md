# NextUp Phone

The phone edition of NextUp: the complete v1.0.59 tracking, discovery, recommendation, resume, and autoplay experience with an MP4-first mobile playback path.

The interface is tuned for iPhone portrait and landscape layouts, including safe areas, touch-sized controls, responsive credits/next-episode cards, native captions, and Safari's explicit-tap audio requirement. Playback asks the configured AIOStreams installation for all enabled addon results, tries confirmed H.264/AAC MP4 sources first, exhausts every browser-compatible backup, and then prepares MKV sources as native HLS inside NextUp. VLC remains available only if both native playback and the internal MKV service fail. Proven sources are remembered without storing expiring URLs, and same-release candidates are preferred for the next episode without overriding the iPhone compatibility order.

The mobile Next Up screen uses a finger-tracking fan-card hero, official title-logo artwork when available, a subtle artwork-derived background, a clear Resume/Play action, and one-tap queue cards without thumbnail progress bars. Optional auto-skip waits 10 seconds before skipping a detected intro or recap; IntroDB remains primary and SkipDB fills missing timing data.

## Prerequisites

- Node.js (v18+)
- A provisioned Firebase project (for authentication and database)
- TMDB API Key
- AIOStreams service endpoint
- FFmpeg and FFprobe available to the Node server for in-app MKV playback

## Environment Variables

Copy `.env.example` to `.env` or set these in your deployment environment:

```env
VITE_TMDB_API_KEY=your_tmdb_key
VITE_AIOSTREAMS_BASE_URL=https://your-aiostreams-instance.com
TRANSCODER_SECRET=generate-a-long-random-secret
# Optional when direct media uses another trusted host:
ALLOWED_STREAM_DOMAINS=media.example.com,cdn.example.com
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

The complete app runs from its Node server. That server provides the same-origin stream-provider proxy and the private FFmpeg-backed HLS sessions used to keep MKV playback inside NextUp.

A static deployment can still use native MP4/HLS sources, but it cannot provide internal MKV conversion and will fall back to VLC. For seamless MKV playback, deploy the built Node server in an environment where FFmpeg and FFprobe are installed and temporary storage is writable.
