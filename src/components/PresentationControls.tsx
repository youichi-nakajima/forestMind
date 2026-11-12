import React, { useEffect } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  X,
  Crosshair,
  Clock,
  GitBranch,
  Layers,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PresentationOrderMode, PresentationStep } from '../types/presentation';

interface PresentationControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReset: () => void;
  onClose: () => void;
  currentStepIndex: number;
  totalSteps: number;
  currentStep: PresentationStep | null;
  mode: PresentationOrderMode;
  onChangeMode: (mode: PresentationOrderMode) => void;
  speed: number;
  onChangeSpeed: (speed: number) => void;
  autoCenter: boolean;
  onToggleAutoCenter: () => void;
  isSoundEnabled?: boolean;
  onToggleSound?: () => void;
  onSeek: (stepIndex: number) => void;
}

export const PresentationControls: React.FC<PresentationControlsProps> = ({
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onReset,
  onClose,
  currentStepIndex,
  totalSteps,
  currentStep,
  mode,
  onChangeMode,
  speed,
  onChangeSpeed,
  autoCenter,
  onToggleAutoCenter,
  isSoundEnabled = true,
  onToggleSound,
  onSeek,
}) => {
  // Global presentation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not trigger if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay();
      } else if (e.code === 'ArrowRight' || e.code === 'ArrowDown') {
        e.preventDefault();
        onNext();
      } else if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') {
        e.preventDefault();
        onPrev();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.code === 'Home') {
        e.preventDefault();
        onReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onTogglePlay, onNext, onPrev, onClose, onReset]);

  const progressPercent =
    totalSteps > 1 ? (currentStepIndex / (totalSteps - 1)) * 100 : 0;

  return (
    <div className="presentation-player-wrapper">
      <div className="presentation-player-card">
        {/* Top Info Bar */}
        <div className="player-header">
          <div className="player-node-info">
            <span className="player-step-badge">
              {totalSteps > 0 ? `${currentStepIndex + 1} / ${totalSteps}` : '0 / 0'}
            </span>
            <span className="player-node-title" title={currentStep?.node.text}>
              {currentStep?.node.text || 'ノード'}
            </span>
            {currentStep?.parentText && (
              <span className="player-parent-hint">
                (親: {currentStep.parentText})
              </span>
            )}
          </div>

          <div className="player-header-actions">
            {/* Mode Selector */}
            <div className="player-mode-selector">
              <button
                type="button"
                className={`player-mode-btn ${mode === 'topic' ? 'active' : ''}`}
                title="トピック順 (深さ優先・主題ごとに展開)"
                onClick={() => onChangeMode('topic')}
              >
                <GitBranch size={13} />
                <span>トピック順</span>
              </button>
              <button
                type="button"
                className={`player-mode-btn ${mode === 'breadth' ? 'active' : ''}`}
                title="階層順 (幅優先・全体の骨格から順次)"
                onClick={() => onChangeMode('breadth')}
              >
                <Layers size={13} />
                <span>階層順</span>
              </button>
              <button
                type="button"
                className={`player-mode-btn ${mode === 'chronological' ? 'active' : ''}`}
                title="時系列順 (CREATED・思考の歴史を再現)"
                onClick={() => onChangeMode('chronological')}
              >
                <Clock size={13} />
                <span>時系列</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              className="player-close-btn"
              title="プレゼンテーションを終了 (Esc)"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Timeline Slider */}
        <div className="player-timeline-container">
          <div className="player-timeline-track">
            <div
              className="player-timeline-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, totalSteps - 1)}
            value={currentStepIndex}
            onChange={e => onSeek(parseInt(e.target.value, 10))}
            className="player-timeline-slider"
            aria-label="再生位置"
          />
        </div>

        {/* Bottom Control Bar */}
        <div className="player-controls-bottom">
          {/* Left Actions: Restart */}
          <div className="player-ctrl-group left">
            <button
              type="button"
              className="player-btn icon-only"
              title="最初から再生 (Home)"
              onClick={onReset}
            >
              <RotateCcw size={15} />
            </button>
          </div>

          {/* Center Actions: Prev, Play/Pause, Next */}
          <div className="player-ctrl-group center">
            <button
              type="button"
              className="player-btn icon-only"
              title="前へ (←)"
              disabled={currentStepIndex <= 0}
              onClick={onPrev}
            >
              <SkipBack size={18} />
            </button>

            <button
              type="button"
              className={`player-btn play-btn ${isPlaying ? 'playing' : ''}`}
              title={isPlaying ? '一時停止 (Space)' : '自動再生 (Space)'}
              onClick={onTogglePlay}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="play-icon-offset" />}
            </button>

            <button
              type="button"
              className="player-btn icon-only"
              title="次へ (→)"
              disabled={currentStepIndex >= totalSteps - 1}
              onClick={onNext}
            >
              <SkipForward size={18} />
            </button>
          </div>

          {/* Right Actions: Speed, Sound, AutoCenter */}
          <div className="player-ctrl-group right">
            {/* Speed Selector */}
            <div className="player-speed-select-wrap">
              <select
                className="player-speed-select"
                value={speed}
                onChange={e => onChangeSpeed(parseFloat(e.target.value))}
                title="1ステップあたりの間隔"
              >
                <option value="0.5">最速 (0.5秒)</option>
                <option value="1.0">速め (1秒)</option>
                <option value="2.0">標準 (2秒)</option>
                <option value="3.5">ゆったり (3.5秒)</option>
                <option value="5.0">じっくり (5秒)</option>
              </select>
            </div>

            {/* Bubble Pop Sound Toggle */}
            {onToggleSound && (
              <button
                type="button"
                className={`player-btn icon-only ${isSoundEnabled ? 'active' : ''}`}
                title={
                  isSoundEnabled
                    ? 'シャボン玉効果音: ON (ノード出現時にポップ音)'
                    : 'シャボン玉効果音: OFF (ミュート)'
                }
                onClick={onToggleSound}
              >
                {isSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
            )}

            {/* Auto Center Toggle */}
            <button
              type="button"
              className={`player-btn icon-only ${autoCenter ? 'active' : ''}`}
              title={
                autoCenter
                  ? '自動カメラ追従: ON (ノードを中央にフォーカス)'
                  : '自動カメラ追従: OFF'
              }
              onClick={onToggleAutoCenter}
            >
              <Crosshair size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

