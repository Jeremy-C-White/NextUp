export interface AudioStreamInfo {
  index: number;
  streamIndex: number;
  codec: string;
  channels: number;
  channelLayout?: string;
  sampleRate?: number;
  language?: string;
  title?: string;
  isDefault: boolean;
}

export interface VideoStreamInfo {
  index: number;
  streamIndex: number;
  codec: string;
  profile?: string;
  pixFmt?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitRate?: number;
  durationSeconds?: number;
  isHevc: boolean;
  isH264: boolean;
}

export interface SubtitleStreamInfo {
  index: number;
  streamIndex: number;
  codec: string;
  language?: string;
  title?: string;
  isForced: boolean;
  isDefault: boolean;
  isImageBased: boolean; // PGS (hdmv_pgs_subtitle) or DVD sub
}

export interface MediaProbeResult {
  sourceUrl: string;
  formatName: string;
  durationSeconds: number;
  bitRate?: number;
  video: VideoStreamInfo | null;
  audioStreams: AudioStreamInfo[];
  subtitleStreams: SubtitleStreamInfo[];
  canVideoCopy: boolean;
  recommendedSegmentType: 'fmp4' | 'mpegts';
  requiresTranscodeReason?: string;
}

export interface TranscodeSessionConfig {
  sourceUrl: string;
  startTime?: number; // seek start in seconds
  audioTrackIndex?: number;
  burnSubtitleTrackIndex?: number;
  forceH264?: boolean;
}

export interface TranscodeSessionStatus {
  id: string;
  token: string;
  clientIp: string;
  createdAt: number;
  lastHeartbeat: number;
  status: 'initializing' | 'ready' | 'running' | 'error' | 'stopped';
  error?: string;
  segmentType: 'fmp4' | 'mpegts';
  streamUrl: string;
  subtitlesUrlPattern?: string;
  currentStartTime: number;
  videoCodec: string;
  isCopied: boolean;
  probe: MediaProbeResult;
}
