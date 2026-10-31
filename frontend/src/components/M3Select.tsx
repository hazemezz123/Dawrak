import { useState, useRef, useEffect } from 'react';

export interface M3SelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
}

interface M3SelectProps {
  label?: string;
  value: string;
  options: M3SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function M3Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'اختر من القائمة...',
}: M3SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-right ${className}`}>
      {/* Hidden native select for form synchronization and accessibility */}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* M3 Select Trigger */}
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full min-h-[52px] px-4 py-2.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer text-right bg-surface-container-low hover:bg-surface-container ${
          isOpen
            ? 'border-primary ring-2 ring-primary/20 bg-surface-container-lowest'
            : 'border-outline-variant/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="material-symbols-rounded text-primary text-xl shrink-0">
            {selectedOption?.icon || 'view_week'}
          </span>
          <div className="flex flex-col text-right truncate">
            {label && (
              <span className="text-[11px] font-bold text-primary leading-tight uppercase tracking-wider">
                {label}
              </span>
            )}
            <span className="text-body-medium font-bold text-on-surface truncate">
              {selectedOption ? selectedOption.label : placeholder}
            </span>
          </div>
        </div>

        <span
          className={`material-symbols-rounded text-on-surface-variant transition-transform duration-200 text-2xl shrink-0 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        >
          arrow_drop_down
        </span>
      </button>

      {/* M3 Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          tabIndex={-1}
          className="absolute z-50 mt-1.5 w-full min-w-[280px] max-h-[320px] overflow-y-auto bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
        >
          {options.length === 0 ? (
            <div className="px-4 py-3 text-body-medium text-on-surface-variant text-center">
              لا توجد خيارات متاحة
            </div>
          ) : (
            options.map((opt) => {
              const isSelected = opt.value === value;

              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(opt.value)}
                  className={`px-4 py-3 min-h-[48px] flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-primary-container text-on-primary-container font-bold'
                      : 'hover:bg-surface-container text-on-surface'
                  }`}
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <span
                      className={`material-symbols-rounded text-xl shrink-0 ${
                        isSelected ? 'text-on-primary-container' : 'text-outline'
                      }`}
                    >
                      {opt.icon || 'storefront'}
                    </span>
                    <div className="flex flex-col truncate">
                      <span className="text-body-medium leading-snug truncate">{opt.label}</span>
                      {opt.description && (
                        <span
                          className={`text-body-small truncate ${
                            isSelected ? 'text-on-primary-container/80' : 'text-on-surface-variant'
                          }`}
                        >
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <span className="material-symbols-rounded text-primary text-xl shrink-0">
                      check
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
