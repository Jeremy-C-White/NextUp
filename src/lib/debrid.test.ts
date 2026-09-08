import { expect, test, describe } from 'vitest';
import { 
  getBrowserCompatibility, 
  isHardRejectTrailer, 
  getTrailerPenalty,
  getStreamCacheState,
  calculateStreamScore,
  getStreamAudioLanguage,
  normalizeAioStreamsBaseUrl,
  getWebOSTVCompatibility,
  getWebOSTVPreferenceScore,
  StreamOption
} from './debrid';

const MOVIE = 'movie';

describe('AIOStreams installation URL', () => {
  test('preserves the private installation path while removing manifest.json', () => {
    expect(normalizeAioStreamsBaseUrl(
      'https://aio.example.com/stremio/private-installation/manifest.json'
    )).toBe('https://aio.example.com/stremio/private-installation');
  });
});

describe('Real-Debrid Cache State', () => {
  test('[RD+] cached classification', () => {
    const stream = { name: "[RD+] Torrentio", title: "Video" };
    expect(getStreamCacheState(stream)).toBe("cached");
  });

  test('[RD download] uncached classification', () => {
    const stream = { name: "[RD download] Torrentio", title: "Video" };
    expect(getStreamCacheState(stream)).toBe("uncached");
  });

  test('Unknown cache state', () => {
    const stream = { name: "[XYZ] Torrentio", title: "Video" };
    expect(getStreamCacheState(stream)).toBe("unknown");
  });
});

describe('Large-screen quality preference', () => {
  test('prefers cached 4K over an otherwise equal cached 1080p source', () => {
    const fourK = { name: '[RD+] AIOStreams', title: 'Show.S01E01.2160p.WEB-DL.mkv', url: 'https://example.com/4k.mkv' };
    const fullHD = { name: '[RD+] AIOStreams', title: 'Show.S01E01.1080p.WEB-DL.mkv', url: 'https://example.com/1080.mkv' };

    const fourKScore = calculateStreamScore(fourK, 0, 2, false, 'series', 1, 1);
    const fullHDScore = calculateStreamScore(fullHD, 0, 2, false, 'series', 1, 1);

    expect(fourKScore).toBeGreaterThan(fullHDScore);
  });
});

describe('English audio preference', () => {
  test('recognizes explicit English and multilingual releases', () => {
    expect(getStreamAudioLanguage({ title: 'Show.S01E01.English.1080p.mkv' })).toBe('english');
    expect(getStreamAudioLanguage({ title: 'Show.S01E01.MULTI.Audio.1080p.mkv' })).toBe('multi');
  });

  test('recognizes clearly foreign-only releases', () => {
    expect(getStreamAudioLanguage({ title: 'Show.S01E01.Japanese.Audio.1080p.mkv' })).toBe('non-english');
    expect(getStreamAudioLanguage({ title: 'Show.S01E01.Japanese.English.Subs.1080p.mkv' })).toBe('non-english');
  });

  test('does not mistake a language word in a show title for audio metadata', () => {
    expect(getStreamAudioLanguage({ title: 'The.Spanish.Princess.S01E01.1080p.mkv' })).toBe('unknown');
  });

  test('strongly prefers an English source over an otherwise equal foreign source', () => {
    const english = calculateStreamScore({ title: 'Show.S01E01.English.1080p.mkv' }, 0, 2, false, 'series', 1, 1);
    const spanish = calculateStreamScore({ title: 'Show.S01E01.Spanish.1080p.mkv' }, 0, 2, false, 'series', 1, 1);
    expect(english).toBeGreaterThan(spanish);
  });
});

describe('Browser Compatibility & MKV external routing', () => {
  test('x265 HEVC mp4 routes external', () => {
    const stream = { url: "http://test.com/Video.x265.mp4", title: "Video.x265.mp4" };
    expect(getBrowserCompatibility(stream)).toBe("external");
  });

  test('DTS audio mp4 routes external', () => {
    const stream = { url: "http://test.com/Video.DTS.mp4", title: "Video.DTS.mp4" };
    expect(getBrowserCompatibility(stream)).toBe("external");
  });

  test('mkv routes external', () => {
    const stream = { url: "http://test.com/Video.mkv", title: "Video.mkv" };
    expect(getBrowserCompatibility(stream)).toBe("external");
  });

  test('standard mp4 is compatible', () => {
    const stream = { url: "http://test.com/Video.mp4", title: "Video.mp4" };
    expect(getBrowserCompatibility(stream)).toBe("compatible");
  });

  test('keeps an AAC fallback when a DTS track is also present', () => {
    const stream = { url: "http://test.com/Video.mp4", title: "Video.H264.AAC.DTS.mp4" };
    expect(getBrowserCompatibility(stream)).toBe("compatible");
  });

  test('allows opaque debrid links to be probed by the native phone player', () => {
    const stream = { url: "https://cdn.example.com/direct/opaque-token", title: "Show 1080p AAC" };
    expect(getBrowserCompatibility(stream)).toBe("unknown");
  });
});

describe('Phone playback preference', () => {
  test('strongly prefers a practical H264 MP4 over a 4K MKV', () => {
    const phoneMp4 = calculateStreamScore({
      title: 'Show.S01E01.1080p.H264.AAC.mp4',
      url: 'https://example.com/phone.mp4'
    }, 1, 2, true, 'series', 1, 1);
    const desktopMkv = calculateStreamScore({
      title: 'Show.S01E01.2160p.H264.AAC.mkv',
      url: 'https://example.com/desktop.mkv'
    }, 0, 2, true, 'series', 1, 1);

    expect(phoneMp4).toBeGreaterThan(desktopMkv);
  });
});

describe('LG webOS 25 native playback compatibility', () => {
  test('accepts 4K HEVC MKV with EAC3 audio', () => {
    const stream = {
      url: 'https://example.com/Show.S01E01.2160p.HEVC.EAC3.mkv',
      title: 'Show.S01E01.2160p.HEVC.EAC3.mkv'
    };
    expect(getWebOSTVCompatibility(stream)).toBe('compatible');
  });

  test('accepts MP4 and transport-stream formats supported by the TV', () => {
    expect(getWebOSTVCompatibility({ url: 'https://example.com/video.H264.AAC.mp4' })).toBe('compatible');
    expect(getWebOSTVCompatibility({ url: 'https://example.com/video.HEVC.EAC3.m2ts' })).toBe('compatible');
  });

  test('rejects unsupported containers and unsupported-audio-only releases', () => {
    expect(getWebOSTVCompatibility({ url: 'https://example.com/video.H264.AAC.flv' })).toBe('external');
    expect(getWebOSTVCompatibility({ url: 'https://example.com/video.HEVC.TrueHD.mkv' })).toBe('external');
    expect(getWebOSTVCompatibility({ url: 'https://example.com/video.HEVC.DTS-HD.mkv' })).toBe('external');
  });

  test('keeps a compatible fallback audio track when TrueHD is also present', () => {
    expect(getWebOSTVCompatibility({
      url: 'https://example.com/video.mkv',
      title: 'Movie.2160p.HEVC.TrueHD.EAC3.mkv'
    })).toBe('compatible');
  });

  test('rejects Dolby Vision-only video but accepts an HDR10 fallback release', () => {
    expect(getWebOSTVCompatibility({ url: 'https://example.com/Movie.2160p.DV.HEVC.EAC3.mkv' })).toBe('external');
    expect(getWebOSTVCompatibility({ url: 'https://example.com/Movie.2160p.DV.HDR10.HEVC.EAC3.mkv' })).toBe('compatible');
  });

  test('prefers proven native codec and audio combinations', () => {
    const proven = getWebOSTVPreferenceScore({ url: 'https://example.com/Movie.HEVC.EAC3.mkv' });
    const unknown = getWebOSTVPreferenceScore({ url: 'https://example.com/Movie.mkv' });
    expect(proven).toBeGreaterThan(unknown);
  });
});

describe('Trailer tests', () => {
  const trailerStream1: StreamOption = {
    title: "Movie.2023.1080p.Official.Trailer.mp4"
  };

  const trailerStream2: StreamOption = {
    title: "Cyrillic.Movie.трейлер.mp4"
  };

  test('isHardRejectTrailer identifies english trailer', () => {
    expect(isHardRejectTrailer(trailerStream1, MOVIE)).toBe(true);
  });

  test('isHardRejectTrailer identifies russian cyrillic trailer', () => {
    expect(isHardRejectTrailer(trailerStream2, MOVIE)).toBe(true);
  });

  test('getTrailerPenalty applies massive penalty to trap', () => {
    expect(getTrailerPenalty(trailerStream1, MOVIE)).toBeGreaterThan(10000);
  });

  test('Non-trailer controls are unaffected', () => {
    const safeStream = { title: "Normal.Movie.1080p.mp4" };
    expect(isHardRejectTrailer(safeStream, MOVIE)).toBe(false);
    expect(getTrailerPenalty(safeStream, MOVIE)).toBe(0);
  });
});
