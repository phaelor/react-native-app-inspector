import { installCommitHook } from '../src/ui/commitHook';
import {
  markInspectorBadgeRender,
  markInspectorUiRender,
} from '../src/ui/uiRenderMark';

const KEY = '__REACT_DEVTOOLS_GLOBAL_HOOK__';
const flushMicrotasks = () => new Promise(process.nextTick);

interface Hook {
  supportsFiber: boolean;
  isDisabled: boolean;
  inject(renderer: unknown): number;
  onCommitFiberRoot(): void;
}

describe('installCommitHook', () => {
  it('installs a hook the production renderer accepts', () => {
    const target: Record<string, unknown> = {};
    const onCommit = jest.fn();
    expect(installCommitHook(target, false, onCommit)).toBe(true);
    const hook = target[KEY] as Hook;
    // What ReactFabric-prod checks before injecting.
    expect(hook.supportsFiber).toBe(true);
    expect(hook.isDisabled).toBe(false);
    expect(hook.inject({})).toBe(1);
    hook.onCommitFiberRoot();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('leaves development and an existing hook alone', () => {
    const dev: Record<string, unknown> = {};
    expect(installCommitHook(dev, true, jest.fn())).toBe(false);
    expect(dev[KEY]).toBeUndefined();

    const existing = { supportsFiber: true };
    const taken: Record<string, unknown> = { [KEY]: existing };
    expect(installCommitHook(taken, false, jest.fn())).toBe(false);
    expect(taken[KEY]).toBe(existing);
  });

  it("ignores the inspector's own commits", async () => {
    const target: Record<string, unknown> = {};
    const onCommit = jest.fn();
    installCommitHook(target, false, onCommit);
    const hook = target[KEY] as Hook;

    markInspectorBadgeRender();
    hook.onCommitFiberRoot();
    await flushMicrotasks();
    markInspectorUiRender();
    hook.onCommitFiberRoot();
    expect(onCommit).not.toHaveBeenCalled();

    await flushMicrotasks();
    hook.onCommitFiberRoot();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
