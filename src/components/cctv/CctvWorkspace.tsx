'use client';

// src/components/cctv/CctvWorkspace.tsx — SafeGrid Relay · Universal Camera Ingest
//
// Engineered from the SafeGrid CCTV HTML template into a proper React component.
// Supports 3 camera source types:
//   1. CCTV / RTSP (HLS .m3u8 streams via hls.js)
//   2. Local device camera (getUserMedia)
//   3. Remote phone via QR code (WebRTC via PeerJS)
//
// 8 channels in a responsive grid. Each channel can mix-and-match sources.

import { useEffect, useRef, useState, useCallback } from 'react';

// Lazy-load heavy libraries only when needed
let HlsModule: typeof import('hls.js').default | null = null;
let PeerModule: typeof import('peerjs').default | null = null;

async function loadHls() {
  if (!HlsModule) {
    const mod = await import('hls.js');
    HlsModule = mod.default;
  }
  return HlsModule;
}

async function loadPeer() {
  if (!PeerModule) {
    const mod = await import('peerjs');
    PeerModule = mod.default;
  }
  return PeerModule;
}

const NUM_CHANNELS = 8;

interface ChannelState {
  active: boolean;
  sourceType: string;
  status: 'STANDBY' | 'LIVE' | 'CONNECTING' | 'ERROR';
}

export function CctvWorkspace() {
  const [channels, setChannels] = useState<ChannelState[]>(
    Array.from({ length: NUM_CHANNELS }, () => ({ active: false, sourceType: '', status: 'STANDBY' as const }))
  );
  const [activeCount, setActiveCount] = useState(0);
  const [urlModalChannel, setUrlModalChannel] = useState<number | null>(null);
  const [streamUrl, setStreamUrl] = useState('');
  const [qrModalChannel, setQrModalChannel] = useState<number | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [qrStatus, setQrStatus] = useState('Waiting for connection...');
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const peersRef = useRef<Record<number, any>>({});

  // Clock
  const [clock, setClock] = useState('--:--:--');
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Update active count
  useEffect(() => {
    setActiveCount(channels.filter(c => c.active).length);
  }, [channels]);

  const activateFeed = useCallback((id: number, sourceType: string) => {
    setChannels(prev => prev.map((c, i) => i === id ? { ...c, active: true, sourceType, status: 'LIVE' } : c));
  }, []);

  // CCTV / HLS stream
  const submitUrl = async () => {
    if (urlModalChannel === null || !streamUrl) return;
    const id = urlModalChannel;
    const video = videoRefs.current[id];
    if (!video) return;

    setChannels(prev => prev.map((c, i) => i === id ? { ...c, status: 'CONNECTING' } : c));

    try {
      if (streamUrl.includes('.m3u8')) {
        const Hls = await loadHls();
        if (Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = streamUrl;
          video.play();
        }
      } else {
        video.src = streamUrl;
        video.play();
      }
      video.style.display = 'block';
      activateFeed(id, 'CCTV / IP');
    } catch (err) {
      setChannels(prev => prev.map((c, i) => i === id ? { ...c, status: 'ERROR' } : c));
    }
    setUrlModalChannel(null);
    setStreamUrl('');
  };

  // Local device camera
  const startLocalCamera = async (id: number) => {
    const video = videoRefs.current[id];
    if (!video) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      video.srcObject = stream;
      video.play();
      video.style.display = 'block';
      activateFeed(id, 'LOCAL CAM');
    } catch (err) {
      console.error('Camera access denied:', err);
      alert('Camera access denied or unavailable. Make sure you are on HTTPS or localhost.');
    }
  };

  // Remote camera via QR + WebRTC
  const startRemoteCamera = async (id: number) => {
    setQrModalChannel(id);
    setQrStatus('Generating QR code...');

    const peerId = `safegrid-relay-ch${id}-${Date.now().toString(36)}`;
    const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    const senderUrl = `${baseUrl}#/cctv?sender&peer=${peerId}`;
    setQrUrl(senderUrl);

    try {
      const Peer = await loadPeer();
      if (peersRef.current[id]) peersRef.current[id].destroy();
      peersRef.current[id] = new Peer(peerId);

      peersRef.current[id].on('open', () => {
        setQrStatus('Waiting for scan...');
      });

      peersRef.current[id].on('call', (call: any) => {
        setQrStatus('Device connected! Establishing stream...');
        call.answer();
        call.on('stream', (remoteStream: MediaStream) => {
          const video = videoRefs.current[id];
          if (video) {
            video.srcObject = remoteStream;
            video.play();
            video.style.display = 'block';
            activateFeed(id, 'REMOTE WEBCAM');
            setQrModalChannel(null);
          }
        });
      });
    } catch (err) {
      setQrStatus('Error: ' + (err as Error).message);
    }
  };

  // Sender mode (when URL has ?sender&peer=)
  const [isSender, setIsSender] = useState(false);
  const [senderPeerId, setSenderPeerId] = useState('');
  const senderVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash.includes('sender')) {
      const params = new URLSearchParams(hash.split('?')[1] || '');
      const peer = params.get('peer');
      if (peer) {
        setIsSender(true);
        setSenderPeerId(peer);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSender || !senderPeerId) return;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (senderVideoRef.current) {
          senderVideoRef.current.srcObject = stream;
          senderVideoRef.current.play();
        }
        const Peer = await loadPeer();
        const peer = new Peer();
        peer.on('open', () => {
          const call = peer.call(senderPeerId, stream);
          call.on('close', () => {
            console.log('Connection closed by hub');
          });
        });
        peer.on('error', (err: Error) => {
          console.error('Peer error:', err);
        });
      } catch (err) {
        console.error('Camera error:', err);
      }
    })();
  }, [isSender, senderPeerId]);

  // Sender mode UI
  if (isSender) {
    return (
      <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black">
        <video ref={senderVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        <div className="absolute left-5 top-5 rounded-full bg-black/70 px-5 py-2.5 font-mono text-sm text-white">
          {senderPeerId ? 'Connected! Streaming live to SafeGrid.' : 'Connecting to SafeGrid...'}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#0a0b0e] text-[#e2e8f0]">
      {/* Header */}
      <header className="flex h-[60px] items-center justify-between border-b border-[#2a2e38] bg-[#121419] px-5">
        <div className="flex items-center gap-3 text-base font-bold tracking-wide">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
          SAFEGRID RELAY
          <span className="ml-2 text-xs text-[#64748b]">{'// INGEST HUB'}</span>
        </div>
        <div
          className="flex items-center gap-2 rounded border px-2.5 py-1 font-mono text-xs uppercase"
          style={{
            color: activeCount > 0 ? '#10b981' : '#64748b',
            background: activeCount > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)',
            borderColor: activeCount > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.2)',
          }}
        >
          <div
            className="size-2 rounded-full"
            style={{ background: activeCount > 0 ? '#10b981' : '#64748b', animation: 'pulse 2s infinite' }}
          />
          {activeCount > 0 ? `${activeCount} FEEDS ACTIVE` : 'WAITING FOR FEEDS'}
        </div>
      </header>

      {/* Grid */}
      <main className="grid flex-1 gap-3 p-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {channels.map((channel, i) => (
          <div
            key={i}
            className="relative flex items-center justify-center overflow-hidden rounded-lg border border-[#2a2e38] bg-black"
            style={{
              backgroundImage: `repeating-linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%, #111), repeating-linear-gradient(45deg, #111 25%, #0a0b0e 25%, #0a0b0e 75%, #111 75%, #111)`,
              backgroundPosition: '0 0, 10px 10px',
              backgroundSize: '20px 20px',
              minHeight: '200px',
            }}
          >
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              autoPlay
              muted
              playsInline
              className="absolute inset-0 z-[1] hidden h-full w-full object-cover bg-black"
            />

            {/* No signal text */}
            {!channel.active && (
              <div className="absolute z-[2] font-mono text-sm text-[#64748b]">AWAITING SOURCE</div>
            )}

            {/* Overlay */}
            <div className="pointer-events-none absolute inset-0 z-[2] flex flex-col justify-between p-3">
              <div className="flex items-start justify-between">
                <div className="border-l-2 border-[#f59e0b] bg-black/70 px-2 py-1 font-mono text-xs font-semibold tracking-wide text-white">
                  CH {String(i + 1).padStart(2, '0')}
                </div>
                <div
                  className="flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 font-mono text-[10px] font-bold"
                  style={{ color: channel.active ? '#10b981' : '#64748b' }}
                >
                  <div
                    className="size-2 rounded-full"
                    style={{ background: channel.active ? '#10b981' : '#64748b' }}
                  />
                  {channel.status}
                </div>
              </div>
              <div className="flex items-end justify-between font-mono text-[11px] text-white" style={{ textShadow: '1px 1px 2px #000' }}>
                <div>{clock}</div>
                <div>{channel.sourceType || '--'}</div>
              </div>
            </div>

            {/* Connect menu (shown when not active) */}
            {!channel.active && (
              <div className="z-[3] flex flex-col gap-2 rounded-lg border border-[#2a2e38] bg-[rgba(10,11,14,0.85)] p-4 text-center">
                <h4 className="mb-1 text-xs uppercase tracking-wide text-[#64748b]">Select Source</h4>
                <button
                  onClick={() => setUrlModalChannel(i)}
                  className="flex items-center justify-center gap-2 rounded border border-[#2a2e38] bg-[#121419] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#64748b] hover:bg-[#1a1d24]"
                >
                  🌐 CCTV / RTSP
                </button>
                <button
                  onClick={() => startLocalCamera(i)}
                  className="flex items-center justify-center gap-2 rounded border border-[#2a2e38] bg-[#121419] px-3 py-2 text-xs font-semibold transition-colors hover:border-[#64748b] hover:bg-[#1a1d24]"
                >
                  📱 This Device
                </button>
                <button
                  onClick={() => startRemoteCamera(i)}
                  className="flex items-center justify-center gap-2 rounded border border-[#f59e0b] bg-[#f59e0b] px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#d97706]"
                >
                  📷 Remote QR
                </button>
              </div>
            )}
          </div>
        ))}
      </main>

      {/* URL Modal */}
      {urlModalChannel !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur" onClick={() => setUrlModalChannel(null)}>
          <div className="w-[90%] max-w-[400px] rounded-xl border border-[#2a2e38] bg-[#121419] p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-base">Connect CCTV Stream</h3>
            <p className="mb-3 text-xs text-[#64748b]">Paste an HLS (.m3u8) URL from your NVR or Camera.</p>
            <input
              type="text"
              value={streamUrl}
              onChange={e => setStreamUrl(e.target.value)}
              placeholder="http://camera-ip/stream.m3u8"
              className="mb-3 w-full rounded border border-[#2a2e38] bg-[#0a0b0e] px-2.5 py-2.5 text-white outline-none focus:border-[#f59e0b]"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => setUrlModalChannel(null)} className="flex-1 rounded border border-[#2a2e38] bg-[#121419] px-3 py-2 text-xs font-semibold transition-colors hover:bg-[#1a1d24]">Cancel</button>
              <button onClick={submitUrl} className="flex-1 rounded border border-[#f59e0b] bg-[#f59e0b] px-3 py-2 text-xs font-semibold text-black transition-colors hover:bg-[#d97706]">Connect</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {qrModalChannel !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur" onClick={() => setQrModalChannel(null)}>
          <div className="w-[90%] max-w-[400px] rounded-xl border border-[#2a2e38] bg-[#121419] p-6 text-center" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-base">Connect Remote Camera</h3>
            <p className="mb-4 text-xs text-[#64748b]">Scan this QR code with another phone to use its camera as a live feed.</p>
            <div className="mb-4 inline-block rounded-lg bg-white p-4">
              <QrCode data={qrUrl} size={200} />
            </div>
            <p className="mb-4 text-xs text-[#f59e0b]">{qrStatus}</p>
            <button onClick={() => setQrModalChannel(null)} className="w-full rounded border border-[#2a2e38] bg-[#121419] px-3 py-2 text-xs font-semibold transition-colors hover:bg-[#1a1d24]">Cancel</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// Simple QR code renderer using an external API fallback
function QrCode({ data, size }: { data: string; size: number }) {
  if (!data) return <div style={{ width: size, height: size }} className="flex items-center justify-center text-black">Loading...</div>;
  return (
    <img
      src={`https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`}
      width={size}
      height={size}
      alt="QR Code"
      style={{ display: 'block' }}
    />
  );
}
