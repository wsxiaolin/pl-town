import { gsap } from 'gsap';

export type SceneAnimationsOptions = {
  getBuildings: () => any[];
  reduced: boolean;
};

export function createSceneAnimations(options: SceneAnimationsOptions) {
  function entranceAnimation() {
    options.getBuildings().forEach((b, i) => {
      gsap.to(b.group.position, { y: 0, duration: 0.85, delay: 0.1 + i * 0.06, ease: 'back.out(1.6)' });
    });
    gsap.from('.welcome-block', { opacity: 0, y: 8, duration: 0.9, delay: 0.2, ease: 'power2.out' });
    gsap.from('.ui-header', { opacity: 0, y: -6, duration: 0.7, delay: 0.1, ease: 'power2.out' });
    gsap.from('.you-block', { opacity: 0, y: 8, duration: 0.9, delay: 0.4, ease: 'power2.out' });
    document.getElementById('labelsWrap')?.classList.remove('hidden');
  }

  function initAnimations() {
    if (options.reduced) return;
    const sb = options.getBuildings().find(b => b.isStats);
    if (sb && sb.glowMat) {
      gsap.to(sb.glowMat, { emissiveIntensity: 0.55, duration: 1.6, ease: 'sine.inOut', repeat: -1, yoyo: true });
    }
  }

  return { entranceAnimation, initAnimations };
}
