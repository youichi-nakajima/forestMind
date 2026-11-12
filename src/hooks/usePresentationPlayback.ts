import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { FreeMindNode } from '../types/freemind';
import { PresentationOrderMode, PresentationStep } from '../types/presentation';
import {
  buildPresentationSequence,
  getVisibleNodeIdsAtStep,
} from '../utils/presentationSequence';
import { playBubblePopSound } from '../utils/audio';

interface UsePresentationPlaybackProps {
  rootNode: FreeMindNode;
  onActiveNodeChange?: (nodeId: string) => void;
}

export function usePresentationPlayback({
  rootNode,
  onActiveNodeChange,
}: UsePresentationPlaybackProps) {
  const [isActive, setIsActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<PresentationOrderMode>('topic');
  const [speed, setSpeed] = useState<number>(2.0); // seconds per step
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [autoCenter, setAutoCenter] = useState(true);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);

  // Rebuild steps whenever rootNode or mode changes
  const steps: PresentationStep[] = useMemo(() => {
    return buildPresentationSequence(rootNode, mode);
  }, [rootNode, mode]);

  // Current active step
  const currentStep = useMemo(() => {
    if (!isActive || steps.length === 0) return null;
    const idx = Math.min(Math.max(currentStepIndex, 0), steps.length - 1);
    return steps[idx] || null;
  }, [isActive, steps, currentStepIndex]);

  // Set of visible nodes
  const visibleNodeIds = useMemo(() => {
    if (!isActive) return new Set<string>(); // When inactive, all nodes visible
    return getVisibleNodeIdsAtStep(rootNode, steps, currentStepIndex);
  }, [isActive, rootNode, steps, currentStepIndex]);

  const activeNodeId = currentStep ? currentStep.nodeId : null;

  // Track previous step index to play sound only when stepping forward
  const prevIndexRef = useRef(currentStepIndex);

  // Play bubble pop sound when a new node appears
  useEffect(() => {
    if (isActive && isSoundEnabled && currentStep) {
      // Play pop sound when step index increases or starts
      if (currentStepIndex >= prevIndexRef.current) {
        playBubblePopSound({ depth: currentStep.depth });
      }
    }
    prevIndexRef.current = currentStepIndex;
  }, [isActive, isSoundEnabled, currentStepIndex, currentStep]);

  // Notify active node change
  useEffect(() => {
    if (isActive && activeNodeId && onActiveNodeChange) {
      onActiveNodeChange(activeNodeId);
    }
  }, [isActive, activeNodeId, onActiveNodeChange]);

  // Navigation handlers
  const nextStep = useCallback(() => {
    setCurrentStepIndex(prev => {
      if (prev >= steps.length - 1) {
        setIsPlaying(false);
        return prev;
      }
      return prev + 1;
    });
  }, [steps.length]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex(prev => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      const target = Math.min(Math.max(0, index), steps.length - 1);
      setCurrentStepIndex(target);
    },
    [steps.length]
  );

  const startPresentation = useCallback(
    (initialMode?: PresentationOrderMode) => {
      if (initialMode) {
        setMode(initialMode);
      }
      setCurrentStepIndex(0);
      setIsActive(true);
      setIsPlaying(true);
    },
    []
  );

  const stopPresentation = useCallback(() => {
    setIsActive(false);
    setIsPlaying(false);
    setCurrentStepIndex(0);
  }, []);

  const play = useCallback(() => {
    if (currentStepIndex >= steps.length - 1) {
      setCurrentStepIndex(0);
    }
    setIsPlaying(true);
  }, [currentStepIndex, steps.length]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(p => {
      if (!p && currentStepIndex >= steps.length - 1) {
        setCurrentStepIndex(0);
        return true;
      }
      return !p;
    });
  }, [currentStepIndex, steps.length]);

  // Auto-play timer
  const nextStepRef = useRef(nextStep);
  nextStepRef.current = nextStep;

  useEffect(() => {
    if (!isActive || !isPlaying) return;

    const intervalMs = Math.max(200, speed * 1000);
    const timer = setInterval(() => {
      nextStepRef.current();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isActive, isPlaying, speed]);

  return {
    isActive,
    isPlaying,
    mode,
    setMode,
    speed,
    setSpeed,
    autoCenter,
    setAutoCenter,
    isSoundEnabled,
    setIsSoundEnabled,
    currentStepIndex,
    steps,
    currentStep,
    visibleNodeIds,
    activeNodeId,
    startPresentation,
    stopPresentation,
    play,
    pause,
    togglePlay,
    nextStep,
    prevStep,
    goToStep,
  };
}

