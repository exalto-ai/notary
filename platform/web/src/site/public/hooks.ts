import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { COPIED_MS, delayAfter, SCRIPT, type ScriptLine, stepEnds, TIMING } from './replay';

function fallbackCopy(text: string) {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  } catch {
    // Nothing else to try; the text is still on the page to select by hand.
  }
}

/**
 * Copy buttons. The key of the last copied button is kept for 1.6s so its
 * label can read "Copied".
 */
export function useCopied(): [string, (key: string, text: string) => void] {
  const [copied, setCopied] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const copy = useCallback((key: string, text: string) => {
    const done = () => {
      clearTimeout(timer.current);
      setCopied(key);
      timer.current = setTimeout(() => setCopied(''), COPIED_MS);
    };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done, () => {
          fallbackCopy(text);
          done();
        });
      } else {
        fallbackCopy(text);
        done();
      }
    } catch {
      fallbackCopy(text);
      done();
    }
  }, []);
  return [copied, copy];
}

export type ReplayState = { i: number; c: number; playing: boolean; started: boolean };

export type Replay = {
  state: ReplayState;
  script: readonly ScriptLine[];
  ends: number[];
  stepsDone: number;
  done: boolean;
  typing: boolean;
  toggle: () => void;
  goStep: (step: number) => void;
};

/**
 * The hero replay. Lines are revealed one by one; command lines type two
 * characters every 24ms. It starts once, when the terminal body is 30%
 * visible. With reduced motion it shows the final state and never animates.
 */
export function useReplay(
  terminalRef: RefObject<HTMLElement | null>,
  script: readonly ScriptLine[] = SCRIPT,
): Replay {
  // The page is prerendered with the replay complete, so a reader without
  // script, and an agent, gets the whole transcript. Before the first paint
  // the client rewinds it, unless motion is reduced.
  const [state, setState] = useState<ReplayState>({
    i: script.length,
    c: 0,
    playing: false,
    started: true,
  });
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const stateRef = useRef(state);
  stateRef.current = state;
  const ends = stepEnds(script);

  const tick = useCallback(() => {
    const { i, c, playing } = stateRef.current;
    if (!playing) return;
    if (i >= script.length) {
      setState((s) => ({ ...s, playing: false }));
      return;
    }
    const line = script[i];
    if (line[0] === 'cmd' && c < line[1].length) {
      setState((s) => ({ ...s, c: Math.min(line[1].length, s.c + TIMING.typeChars) }));
      timer.current = setTimeout(tick, TIMING.typeTick);
      return;
    }
    setState((s) => ({ ...s, i: s.i + 1, c: 0 }));
    timer.current = setTimeout(tick, delayAfter(script, i));
  }, [script]);

  const play = useCallback(
    (fromStart: boolean) => {
      clearTimeout(timer.current);
      setState((s) => ({ started: true, playing: true, i: fromStart ? 0 : s.i, c: 0 }));
      timer.current = setTimeout(tick, TIMING.startDelay);
    },
    [tick],
  );

  useLayoutEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!reduce) setState({ i: 0, c: 0, playing: false, started: false });
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      setState({ i: script.length, c: 0, playing: false, started: true });
      return;
    }
    const element = terminalRef.current;
    if (!element || !('IntersectionObserver' in window)) {
      play(false);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !stateRef.current.started) {
          observer.disconnect();
          play(false);
        }
      },
      { threshold: TIMING.visibleThreshold },
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      clearTimeout(timer.current);
    };
  }, [play, script.length, terminalRef]);

  const toggle = useCallback(() => {
    const current = stateRef.current;
    if (current.playing) {
      clearTimeout(timer.current);
      setState((s) => ({ ...s, playing: false }));
      return;
    }
    play(current.i >= script.length);
  }, [play, script.length]);

  const goStep = useCallback(
    (step: number) => {
      clearTimeout(timer.current);
      setState({ started: true, playing: false, i: ends[step], c: 0 });
    },
    [ends],
  );

  const done = state.i >= script.length;
  const typing = state.i < script.length && script[state.i][0] === 'cmd' && state.c > 0;
  const stepsDone = ends.filter((end) => state.i >= end).length;
  return { state, script, ends, stepsDone, done, typing, toggle, goStep };
}
