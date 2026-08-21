import React from 'react';

interface PaginationProps {
  infoText: string;
  currentPage: number;
  totalPages: number;
  // 'thisWeek' mode shows everything on one page — legacy hides prev/next/page-input then.
  showControls: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoToPage: (page: number) => void;
}

// Ported from the .pagination-container in nginx/static/mainPage/index.html + style.css.
const Pagination: React.FC<PaginationProps> = ({
  infoText, currentPage, totalPages, showControls, onPrev, onNext, onGoToPage,
}) => {
  const [pageInput, setPageInput] = React.useState(String(currentPage));

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const commitPageInput = () => {
    const page = parseInt(pageInput, 10);
    if (page >= 1 && page <= totalPages) {
      onGoToPage(page);
    } else {
      setPageInput(String(currentPage));
    }
  };

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 my-4 p-4 bg-surface border border-hairline rounded-card">
      <div className="text-text-muted text-sm flex-1 min-w-[200px]">{infoText}</div>
      {showControls && (
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button" onClick={onPrev} disabled={currentPage <= 1}
            className="px-4 py-2 border border-white/10 bg-input rounded-input text-sm text-text-secondary enabled:hover:border-accent/40 enabled:hover:text-text-emphasis transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="flex items-center gap-2 text-text-muted text-sm whitespace-nowrap">
            Page
            <input
              type="number" min={1} max={totalPages} value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => { if (e.key === 'Enter') commitPageInput(); }}
              className="w-16 text-center bg-input border border-white/10 rounded-input p-1 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            of {totalPages}
          </span>
          <button
            type="button" onClick={onNext} disabled={currentPage >= totalPages}
            className="px-4 py-2 border border-white/10 bg-input rounded-input text-sm text-text-secondary enabled:hover:border-accent/40 enabled:hover:text-text-emphasis transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default Pagination;
