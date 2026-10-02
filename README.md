# NextUp Phone

The phone edition of NextUp: the complete v1.0.59 tracking, discovery, recommendation, resume, and autoplay experience with an MP4/HLS-first mobile playback path.

The interface is tuned for iPhone portrait and landscape layouts, including safe areas, touch-sized controls, responsive credits/next-episode cards, native captions, and Safari's explicit-tap audio requirement. Playback asks the configured AIOStreams installation for all enabled addon results, tries confirmed H.264/AAC MP4 and native HLS sources first, and exhausts every browser-compatible backup. If only an MKV source remains, NextUp offers a direct VLC handoff instead of asking a computer to download or convert the video. Proven sources are remembered without storing expiring URLs, and same-release candidates are preferred for the next episode without overriding the iPhone compatibility order.

The mobile Next Up screen uses a finger-tracking fan-card hero, official title-logo artwork when available, a subtle artwork-derived background, a clear Resume/Play action, and one-tap queue cards without thumbnail progress bars. Optional auto-skip waits 10 seconds before skipping a detected intro or recap; IntroDB remains primary and SkipDB fills missing timing data.

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

The Node server provides the same-origin AIOStreams proxy used by the phone app. It does not download, remux, or transcode media, and FFmpeg is not required.

A static deployment can also play compatible MP4/HLS sources, although provider CORS rules may limit which results Safari can open directly. When no browser-compatible source works, the app preserves the source list and offers the best available MKV options in VLC.
