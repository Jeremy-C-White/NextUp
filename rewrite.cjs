const fs = require('fs');
let code = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8');

const target = `  const [hasError, setHasError] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);`;

const replacement = `  const [hasError, setHasError] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);`;

code = code.replace(target, replacement);

const target2 = `  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const checkVideoTrack = () => {`;

const replacement2 = `  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleWaiting = () => setIsLoading(true);
    const handlePlaying = () => setIsLoading(false);
    const handleCanPlay = () => setIsLoading(false);
    const handleLoadStart = () => setIsLoading(true);
    const handleLoadedData = () => setIsLoading(false);

    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);

    const checkVideoTrack = () => {`;

code = code.replace(target2, replacement2);

const target3 = `    video.addEventListener('loadedmetadata', checkVideoTrack);
    video.addEventListener('playing', checkVideoTrack);

    return () => {
      video.removeEventListener('loadedmetadata', checkVideoTrack);
      video.removeEventListener('playing', checkVideoTrack);
    };
  }, [streamUrl]);`;

const replacement3 = `    video.addEventListener('loadedmetadata', checkVideoTrack);
    video.addEventListener('playing', checkVideoTrack);

    return () => {
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('loadedmetadata', checkVideoTrack);
      video.removeEventListener('playing', checkVideoTrack);
    };
  }, [streamUrl]);`;

code = code.replace(target3, replacement3);

const target4 = `        <button 
          onClick={onClose}
          className="absolute top-4 right-4 pointer-events-auto p-3 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>`;

const replacement4 = `        <button 
          onClick={onClose}
          className="absolute top-4 right-4 pointer-events-auto p-3 bg-black/50 hover:bg-black/80 rounded-full text-white transition-colors z-[105]"
        >
          <X className="w-6 h-6" />
        </button>`;

code = code.replace(target4, replacement4);

const target5 = `      ) : (
        <video
          ref={videoRef}
          src={streamUrl}
          controls
          playsInline
          autoPlay
          onPause={() => setShowUI(true)}
          onError={() => setHasError(true)}
          className="absolute inset-0 w-full h-full object-contain"
        >
          Your browser does not support the video tag.
        </video>
      )}
    </div>`;

const replacement5 = `      ) : (
        <>
          {isLoading && !hasError && (
            <div className="absolute inset-0 z-[90] flex items-center justify-center pointer-events-none">
              <div className="flex flex-col items-center gap-4 bg-black/50 p-6 rounded-3xl backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
                <p className="text-white font-medium text-sm drop-shadow-md">Resolving & Buffering...</p>
              </div>
            </div>
          )}
          <video
            ref={videoRef}
            src={streamUrl}
            controls
            playsInline
            autoPlay
            onPause={() => setShowUI(true)}
            onError={(e) => {
              console.error("Video error:", e);
              setIsLoading(false);
              setHasError(true);
            }}
            className="absolute inset-0 w-full h-full object-contain z-[80]"
          >
            Your browser does not support the video tag.
          </video>
        </>
      )}
    </div>`;

code = code.replace(target5, replacement5);

fs.writeFileSync('src/components/VideoPlayerModal.tsx', code);
