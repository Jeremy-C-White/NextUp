const fs = require('fs');
let code = fs.readFileSync('src/components/VideoPlayerModal.tsx', 'utf8');

const target = `  const [hasError, setHasError] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);`;

const replacement = `  const [hasError, setHasError] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let mounted = true;
    const resolveUrl = async () => {
      try {
        // We explicitly resolve the redirect to get the final Real-Debrid URL.
        // Some browser video players time out or fail when following 302 redirects.
        const response = await fetch(streamUrl, { method: 'HEAD' });
        if (mounted) {
          setResolvedUrl(response.url || streamUrl);
        }
      } catch (err) {
        console.error("Failed to pre-resolve URL:", err);
        // Fallback to original URL
        if (mounted) {
          setResolvedUrl(streamUrl);
        }
      }
    };
    resolveUrl();
    return () => { mounted = false; };
  }, [streamUrl]);
`;

code = code.replace(target, replacement);

const target2 = `  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(e => console.error("Auto-play blocked:", e));
    }
  }, [streamUrl]);`;

const replacement2 = `  useEffect(() => {
    if (videoRef.current && resolvedUrl) {
      videoRef.current.play().catch(e => console.error("Auto-play blocked:", e));
    }
  }, [resolvedUrl]);`;

code = code.replace(target2, replacement2);

const target3 = `  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;`;

const replacement3 = `  useEffect(() => {
    const video = videoRef.current;
    if (!video || !resolvedUrl) return;`;

code = code.replace(target3, replacement3);

const target4 = `    };
  }, [streamUrl]);`;

const replacement4 = `    };
  }, [resolvedUrl]);`;

code = code.replace(target4, replacement4);

const target5 = `          <video
            ref={videoRef}
            src={streamUrl}
            controls`;

const replacement5 = `          <video
            ref={videoRef}
            src={resolvedUrl || ""}
            controls`;

code = code.replace(target5, replacement5);

fs.writeFileSync('src/components/VideoPlayerModal.tsx', code);
