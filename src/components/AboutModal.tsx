import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Coffee,
  ExternalLink,
  Keyboard,
  Monitor,
  Scale,
  Code2,
  History,
  MessageSquarePlus,
  BookOpen,
  Info,
} from 'lucide-react';
import type { ElectronAppInfo } from '../types/electron';
import {
  APP_INFO,
  buildCopyableEnvText,
  formatEnvironmentSummary,
} from '../utils/aboutInfo';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHelp?: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose, onOpenHelp }) => {
  const [runtimeInfo, setRuntimeInfo] = useState<ElectronAppInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || runtimeInfo !== null) return;
    const getAppInfo = window.electronAPI?.getAppInfo;
    if (!getAppInfo) return;

    let cancelled = false;
    getAppInfo()
      .then(info => {
        if (!cancelled && info) {
          setRuntimeInfo(info);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isOpen, runtimeInfo]);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
    }
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const displayVersion = runtimeInfo?.version || APP_INFO.version;
  const envSummary = formatEnvironmentSummary(runtimeInfo);

  const handleCopyEnv = async () => {
    const text = buildCopyableEnvText(
      displayVersion,
      runtimeInfo,
      typeof navigator !== 'undefined' ? navigator.userAgent : undefined
    );

    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        ok = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch {
        ok = false;
      }
    }

    if (ok) {
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1800);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-dialog about-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-header">
          <div className="modal-title-group">
            <Info size={18} className="modal-icon" />
            <h3 id="about-modal-title">forestMind について</h3>
          </div>
          <button
            type="button"
            className="panel-close-btn"
            aria-label="閉じる"
            title="閉じる"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="modal-body about-modal-body">
          <div className="about-hero">
            <img src="./icon.svg" alt="forestMind" className="about-app-icon" />
            <div className="about-hero-text">
              <div className="about-title-row">
                <h4>{APP_INFO.name}</h4>
                <span className="about-version-pill">v{displayVersion}</span>
                <span className="brand-badge">{APP_INFO.compatBadge}</span>
              </div>
              <p className="about-description">{APP_INFO.description}</p>
            </div>
          </div>

          <div className="about-info-card">
            <div className="about-info-row">
              <div className="about-info-label">
                <Monitor size={14} />
                <span>実行環境</span>
              </div>
              <div className="about-info-value-group">
                <span className="about-env-value">{envSummary}</span>
                <button
                  type="button"
                  className={`about-copy-btn ${copied ? 'copied' : ''}`}
                  title="環境情報をクリップボードにコピー"
                  onClick={handleCopyEnv}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'コピー済' : 'コピー'}</span>
                </button>
              </div>
            </div>

            <div className="about-info-row">
              <div className="about-info-label">
                <Scale size={14} />
                <span>ライセンス</span>
              </div>
              <div className="about-info-value">
                {APP_INFO.license} · {APP_INFO.copyright}
              </div>
            </div>
          </div>

          <div className="about-support-card">
            <div className="about-support-header">
              <Coffee size={16} />
              <span>開発を応援する</span>
            </div>
            <p className="about-support-text">{APP_INFO.supportMessage}</p>
            <a
              href={APP_INFO.links.buyMeACoffee}
              target="_blank"
              rel="noopener noreferrer"
              className="about-coffee-btn"
            >
              <Coffee size={15} />
              <span>Buy Me a Coffee で応援する</span>
              <ExternalLink size={13} />
            </a>
          </div>

          <div className="about-links-row">
            <a
              href={APP_INFO.links.github}
              target="_blank"
              rel="noopener noreferrer"
              className="about-link-chip"
            >
              <Code2 size={14} />
              <span>GitHub</span>
              <ExternalLink size={12} />
            </a>
            <a
              href={APP_INFO.links.releases}
              target="_blank"
              rel="noopener noreferrer"
              className="about-link-chip"
            >
              <History size={14} />
              <span>更新履歴</span>
              <ExternalLink size={12} />
            </a>
            <a
              href={APP_INFO.links.issues}
              target="_blank"
              rel="noopener noreferrer"
              className="about-link-chip"
            >
              <MessageSquarePlus size={14} />
              <span>バグ報告・要望</span>
              <ExternalLink size={12} />
            </a>
            <a
              href={APP_INFO.links.userGuide}
              target="_blank"
              rel="noopener noreferrer"
              className="about-link-chip"
            >
              <BookOpen size={14} />
              <span>ユーザーガイド</span>
              <ExternalLink size={12} />
            </a>
            {onOpenHelp && (
              <button
                type="button"
                className="about-link-chip about-help-btn"
                onClick={() => {
                  onClose();
                  onOpenHelp();
                }}
              >
                <Keyboard size={14} />
                <span>操作ガイド</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
