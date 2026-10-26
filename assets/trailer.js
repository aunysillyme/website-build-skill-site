// Playback state is isolated so reduced-motion and visibility behavior can be verified.
export function setupTrailer(video, environment = window, documentRef = document) {
  if (!video) return;
  const preference = environment.matchMedia('(prefers-reduced-motion: reduce)');
  let attempted = false;
  let visible = false;
  const maybePlay = () => {
    if (attempted || preference.matches || !visible || documentRef.hidden) return;
    attempted = true;
    video.muted = true;
    video.play().catch(() => {});
  };
  video.addEventListener('play', () => { attempted = true; });
  if ('IntersectionObserver' in environment) {
    const observer = new environment.IntersectionObserver(entries => {
      visible = entries[0].isIntersecting && entries[0].intersectionRatio >= 0.5;
      maybePlay();
    }, {threshold: 0.5});
    observer.observe(video);
  }
  documentRef.addEventListener('visibilitychange', maybePlay);
  preference.addEventListener('change', () => {
    if (preference.matches) {
      video.pause();
      video.currentTime = 0;
      video.load();
      video.controls = true;
      attempted = false;
    }
    maybePlay();
  });
}
