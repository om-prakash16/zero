/**
 * Generates an animated HTML5 Canvas virtual video stream & synthetic audio tone
 * for testing video calls when no physical webcam/microphone hardware is available,
 * or when browser media permissions are restricted.
 */
export function createVirtualMediaStream(displayName: string = 'User'): MediaStream {
  if (typeof window === 'undefined' || typeof MediaStream === 'undefined') {
    return null as unknown as MediaStream;
  }

  // 1. Create a 640x480 off-screen canvas with live animation
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  let animFrameId: number;
  let frame = 0;

  function draw() {
    if (!ctx) return;
    frame++;

    // Sleek dark gradient background
    const grad = ctx.createLinearGradient(0, 0, 640, 480);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 640, 480);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 640; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 480);
      ctx.stroke();
    }
    for (let y = 0; y < 480; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(640, y);
      ctx.stroke();
    }

    // Outer pulsating aura
    const pulse = Math.sin(frame * 0.06) * 12;
    ctx.beginPath();
    ctx.arc(320, 200, 75 + pulse, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
    ctx.fill();

    // Secondary ring
    ctx.beginPath();
    ctx.arc(320, 200, 68 + pulse * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.fill();

    // Central avatar disk
    const diskGrad = ctx.createLinearGradient(260, 140, 380, 260);
    diskGrad.addColorStop(0, '#f43f5e');
    diskGrad.addColorStop(1, '#6366f1');
    ctx.beginPath();
    ctx.arc(320, 200, 60, 0, Math.PI * 2);
    ctx.fillStyle = diskGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Display Name Initial
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (displayName.charAt(0) || 'U').toUpperCase();
    ctx.fillText(initial, 320, 202);

    // Display Name Label
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(displayName, 320, 305);

    // Virtual badge
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(320 - 90, 325, 180, 26, 13);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('✨ VIRTUAL TEST CAMERA', 320, 339);

    // Animated Audio Spectrum Wave
    const barCount = 20;
    const barWidth = 10;
    const spacing = 6;
    const startX = 320 - (barCount * (barWidth + spacing)) / 2;
    for (let i = 0; i < barCount; i++) {
      const h = Math.abs(Math.sin((frame + i * 7) * 0.08)) * 32 + 5;
      const barGrad = ctx.createLinearGradient(0, 420 - h, 0, 420);
      barGrad.addColorStop(0, '#f43f5e');
      barGrad.addColorStop(1, '#38bdf8');
      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(startX + i * (barWidth + spacing), 420 - h, barWidth, h, 4);
      ctx.fill();
    }

    animFrameId = requestAnimationFrame(draw);
  }

  draw();

  const videoStream = canvas.captureStream(25);
  const videoTrack = videoStream.getVideoTracks()[0];

  // Stop canvas animation loop when the video track is stopped
  if (videoTrack) {
    const origStop = videoTrack.stop.bind(videoTrack);
    videoTrack.stop = () => {
      cancelAnimationFrame(animFrameId);
      origStop();
    };
  }

  // 2. Synthesize a non-intrusive audio track using Web Audio API
  let audioTrack: MediaStreamTrack | null = null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (AudioContextClass) {
      const actx = new AudioContextClass();
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      // Very gentle near-inaudible test hum (0.0001 gain) so tracks stay active without noise
      gain.gain.setValueAtTime(0.0001, actx.currentTime);
      osc.frequency.setValueAtTime(440, actx.currentTime);
      osc.connect(gain);

      const dest = actx.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();

      audioTrack = dest.stream.getAudioTracks()[0] || null;

      if (audioTrack) {
        const origAudioStop = audioTrack.stop.bind(audioTrack);
        audioTrack.stop = () => {
          try {
            osc.stop();
            actx.close();
          } catch {
            // ignore
          }
          origAudioStop();
        };
      }
    }
  } catch (err) {
    console.warn('Could not initialize synthetic audio track:', err);
  }

  const tracks: MediaStreamTrack[] = [];
  if (videoTrack) tracks.push(videoTrack);
  if (audioTrack) tracks.push(audioTrack);

  return new MediaStream(tracks);
}
