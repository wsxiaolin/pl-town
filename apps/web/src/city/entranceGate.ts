/**
 * Defers the city entrance animation until the first frame renders. The render
 * gate stays held through the shader precompile (`frameLoop.holdRender`), so
 * starting the growth earlier would show the first visible frame with the
 * buildings already settled. `run` queues the entrance until `flush`; `flush`
 * runs it immediately once the first frame has rendered.
 */
export function createEntranceGate(onFirstRendered: () => void) {
  let pending: (() => void) | null = null;
  let open = false;
  return {
    run(entrance: () => void): void {
      if (open) entrance();
      else pending = entrance;
    },
    flush(): void {
      open = true;
      pending?.();
      pending = null;
      onFirstRendered();
    },
  };
}
