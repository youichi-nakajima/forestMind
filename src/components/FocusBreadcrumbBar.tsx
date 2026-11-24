import React from 'react';
import { ChevronRight, Focus, X } from 'lucide-react';
import type { FocusBreadcrumb } from '../utils/focusMode';

interface FocusBreadcrumbBarProps {
  breadcrumbs: FocusBreadcrumb[];
  onSelectBreadcrumb: (nodeId: string) => void;
  onExitFocus: () => void;
}

export const FocusBreadcrumbBar: React.FC<FocusBreadcrumbBarProps> = ({
  breadcrumbs,
  onSelectBreadcrumb,
  onExitFocus,
}) => {
  if (breadcrumbs.length === 0) return null;

  return (
    <nav
      className="focus-breadcrumb-bar"
      aria-label="フォーカスモードのパンくず"
      onMouseDown={e => e.stopPropagation()}
      onWheel={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <span className="focus-breadcrumb-badge">
        <Focus size={13} />
        <span>フォーカス中</span>
      </span>

      <div className="focus-breadcrumb-trail">
        {breadcrumbs.map((crumb, idx) => {
          const isLast = idx === breadcrumbs.length - 1;
          return (
            <React.Fragment key={crumb.id}>
              {idx > 0 && <ChevronRight size={12} className="focus-crumb-sep" />}
              {isLast ? (
                <span className="focus-crumb-current" aria-current="location" title={crumb.text}>
                  {crumb.text}
                </span>
              ) : (
                <button
                  type="button"
                  className="focus-crumb-btn"
                  title={idx === 0 ? '全体表示に戻る' : `「${crumb.text}」にフォーカスを移動`}
                  onClick={() => {
                    if (idx === 0) {
                      onExitFocus();
                    } else {
                      onSelectBreadcrumb(crumb.id);
                    }
                  }}
                >
                  {crumb.text}
                </button>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <button
        type="button"
        className="focus-exit-btn"
        title="フォーカス解除 (Esc)"
        onClick={onExitFocus}
      >
        <X size={13} />
        <span>フォーカス解除</span>
      </button>
    </nav>
  );
};
