
export const yieldToMain = (): Promise<void> => {
  if ('scheduler' in globalThis && 'yield' in (globalThis as any).scheduler) {
    return (globalThis as any).scheduler.yield();
  }
  return new Promise(resolve => {
    const Channel = (globalThis as any).MessageChannel;
    if (Channel) {
      const { port1, port2 } = new Channel();
      (port1 as any).onmessage = () => resolve();
      port2.postMessage(null);
    } else {
      setTimeout(resolve, 0);
    }
  });
};


export const processWithTimeBudget = async <T>(
  items: T[],
  processFn: (item: T) => void | boolean,
  budgetMs: number = 12
): Promise<void> => {
  let start = performance.now();
  for (let i = 0; i < items.length; i++) {
    const result = processFn(items[i]);
    if (result === false) break;
    
    if (performance.now() - start > budgetMs) {
      await yieldToMain();
      start = performance.now();
    }
  }
};


