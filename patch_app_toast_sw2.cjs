const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{message: string, action?: {label: string, onClick: () => void}} | null>(null);

  useEffect(() => {
    if (toast && !toast.action) {
      const timer = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const updateSW = registerSW({
      onNeedRefresh() {
        setToast({
          message: 'Update available',
          action: {
            label: 'Refresh',
            onClick: () => updateSW(true)
          }
        });
      },
      onOfflineReady() {
        setToast({ message: 'Ready to work offline' });
      }
    });
  }, []);

  // Pull to refresh
  useEffect(() => {
    let startY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      if (window.scrollY === 0) {
        startY = e.touches[0].clientY;
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (window.scrollY === 0 && startY > 0) {
        const y = e.touches[0].clientY;
        if (y - startY > 100) {
          window.location.reload();
        }
      }
    };
    const handleTouchEnd = () => { startY = 0; };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);`;

code = code.replace('const [loading, setLoading] = useState(true);', replacement);
fs.writeFileSync('src/App.tsx', code);
