const steps = [
  ['WELCOME / 新居民报到','欢迎来到物实小城','这里有故事、朋友和等待你发现的角落。','观察顶栏的时间，城市会随昼夜慢慢变化。'],
  ['MOVE / 出发','先走两步看看','点击道路，或使用 W A S D，让角色开始探索。','触屏设备可以按住屏幕拖动，唤出方向盘。'],
  ['DISCOVER / 发现','每栋建筑都有故事','靠近建筑，点开头顶标签，和居民聊聊。','报摊、书院与音乐厅，都藏着城市的线索。'],
  ['MAP / 全景地图','地图记得常打开','从顶栏进入地图，搜索建筑，规划下一站。','走得更远后，还能解锁便捷传送。'],
  ['PHONE / 居民手机','你的生活入口','右下角手机可以打开公聊、住宅和背包。','你的探索记录会在这里慢慢留下痕迹。'],
  ['READY / 上路吧','故事由你继续','准备好了吗？去遇见这座城。','引导可以从 window._mini.tutorial.start() 再次打开。']
];
export function createOnboardingTutorialController({ document: doc, signal, storage = doc.defaultView?.localStorage }: { document: Document; signal: AbortSignal; storage?: Storage }) {
  const overlay = doc.getElementById('tutorialOverlay'); let index = 0;
  const get = (id: string) => doc.getElementById(id)!;
  const render = () => { const [kicker, title, lead, hint] = steps[index] ?? steps[0]; get('tutorialKicker').textContent = kicker; get('tutorialCount').textContent = `${String(index + 1).padStart(2, '0')} / ${String(steps.length).padStart(2, '0')}`; get('tutorialTitle').textContent = title; get('tutorialLead').textContent = lead; get('tutorialHints').innerHTML = `<li>${hint}</li>`; get('tutorialDots').innerHTML = steps.map((_, i) => `<i class="tutorial-dot ${i === index ? 'is-active' : ''}"></i>`).join(''); (get('tutorialPrev') as HTMLButtonElement).disabled = index === 0; get('tutorialNext').textContent = index === steps.length - 1 ? '进入小城' : '继续探索'; };
  const close = () => { if (!overlay) return; overlay.hidden = true; overlay.classList.remove('open'); storage?.setItem('minicity.tutorial.v1', 'done'); };
  const start = () => { if (!overlay) return; index = 0; render(); overlay.hidden = false; requestAnimationFrame(() => overlay.classList.add('open')); };
  get('tutorialNext').addEventListener('click', () => index === steps.length - 1 ? close() : (index++, render())); get('tutorialPrev').addEventListener('click', () => { if (index) index--; render(); }); get('tutorialSkip').addEventListener('click', close); signal.addEventListener('abort', close, { once: true });
  return { start, close, isCompleted: () => storage?.getItem('minicity.tutorial.v1') === 'done' };
}
