'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';

interface Account {
    id: string;
    email: string;
    name: string;
    tag: string;
}

interface SenderDropdownProps {
    accounts: Account[];
    value: string;
    onChange: (accountId: string) => void;
}

/**
 * Custom dropdown for sender selection in ComposeModal
 * Replaces native select to control dropdown height on mobile
 * 
 * Accessibility features:
 * - ARIA attributes (aria-expanded, aria-haspopup, aria-activedescendant)
 * - Keyboard navigation (Space/Enter to toggle, Escape to close, Arrow keys)
 * - Focus management
 */
export default function SenderDropdown({ accounts, value, onChange }: SenderDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Find selected account index
    const selectedAccount = accounts.find(a => a.id === value);
    const selectedIndex = accounts.findIndex(a => a.id === value);

    // Toggle dropdown and reset focus index
    const toggleDropdown = useCallback(() => {
        setIsOpen(prev => {
            if (!prev) {
                // Opening: set focus to selected item or first item
                setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
            }
            return !prev;
        });
    }, [selectedIndex]);

    // Close dropdown when clicking outside or pressing Escape
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.stopPropagation(); // Prevent global Escape handler (Bug #17 fix)
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscapeKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isOpen]);

    // Scroll focused option into view
    useEffect(() => {
        if (isOpen && focusedIndex >= 0 && listRef.current) {
            const options = listRef.current.querySelectorAll('[role="option"]');
            const focusedOption = options[focusedIndex] as HTMLElement;
            if (focusedOption) {
                focusedOption.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [focusedIndex, isOpen]);

    const handleSelect = useCallback((accountId: string) => {
        onChange(accountId);
        setIsOpen(false);
        // Return focus to trigger
        triggerRef.current?.focus();
    }, [onChange]);

    // Keyboard event handler
    const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
        switch (event.key) {
            case 'Enter':
            case ' ':
                event.preventDefault();
                if (isOpen && focusedIndex >= 0 && accounts[focusedIndex]) {
                    handleSelect(accounts[focusedIndex].id);
                } else {
                    toggleDropdown();
                }
                break;
            case 'Escape':
                event.preventDefault();
                setIsOpen(false);
                triggerRef.current?.focus();
                break;
            case 'ArrowDown':
                event.preventDefault();
                if (!isOpen) {
                    toggleDropdown();
                } else {
                    setFocusedIndex(prev =>
                        prev < accounts.length - 1 ? prev + 1 : prev
                    );
                }
                break;
            case 'ArrowUp':
                event.preventDefault();
                if (isOpen) {
                    setFocusedIndex(prev => prev > 0 ? prev - 1 : prev);
                }
                break;
            case 'Home':
                event.preventDefault();
                if (isOpen) {
                    setFocusedIndex(0);
                }
                break;
            case 'End':
                event.preventDefault();
                if (isOpen) {
                    setFocusedIndex(accounts.length - 1);
                }
                break;
            case 'Tab':
                // Allow Tab to close dropdown and move focus naturally
                if (isOpen) {
                    setIsOpen(false);
                }
                break;
        }
    }, [isOpen, focusedIndex, accounts, handleSelect, toggleDropdown]);

    const listId = useId(); // Bug #18: unique ID per instance

    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            {/* Trigger Button */}
            <button
                ref={triggerRef}
                type="button"
                onClick={toggleDropdown}
                onKeyDown={handleKeyDown}
                className="sender-dropdown-trigger"
                role="combobox" // Bug #18: proper ARIA role
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listId : undefined}
                aria-activedescendant={isOpen && focusedIndex >= 0 ? `sender-option-${focusedIndex}` : undefined}
                style={{
                    width: '100%',
                    padding: '12px',
                    paddingRight: 32,
                    background: 'var(--surface-1)',
                    border: '1px solid var(--stroke-1)',
                    borderRadius: 10,
                    color: selectedAccount ? 'var(--text-1)' : 'var(--text-3)',
                    fontSize: 14,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease-out',
                }}
            >
                {selectedAccount ? `${selectedAccount.name} (${selectedAccount.email})` : '选择发件人...'}
            </button>

            {/* Dropdown Arrow */}
            <div
                style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`,
                    pointerEvents: 'none',
                    color: 'var(--text-3)',
                    transition: 'transform 0.15s ease-out',
                }}
                aria-hidden="true"
            >
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>

            {/* Dropdown List */}
            {isOpen && (
                <div
                    ref={listRef}
                    id={listId}
                    role="listbox"
                    aria-label="选择发件人"
                    className="sender-dropdown-list"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        maxHeight: '40vh',
                        overflowY: 'auto',
                        background: 'var(--bg-2)',
                        border: '1px solid var(--stroke-1)',
                        borderRadius: 10,
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        zIndex: 1000,
                        animation: 'dropdown-appear 0.18s ease-out',
                    }}
                >
                    {accounts.map((account, index) => (
                        <button
                            key={account.id}
                            id={`sender-option-${index}`}
                            type="button"
                            role="option"
                            aria-selected={account.id === value}
                            onClick={() => handleSelect(account.id)}
                            onMouseEnter={() => setFocusedIndex(index)}
                            className={`sender-dropdown-option ${focusedIndex === index ? 'focused' : ''}`}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: focusedIndex === index
                                    ? 'var(--surface-2)'
                                    : account.id === value
                                        ? 'var(--surface-1)'
                                        : 'transparent',
                                border: 'none',
                                color: 'var(--text-1)',
                                fontSize: 14,
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'background 0.1s ease-out',
                                outline: focusedIndex === index ? '2px solid var(--accent-1)' : 'none',
                                outlineOffset: -2,
                            }}
                        >
                            <div style={{ fontWeight: account.id === value ? 600 : 400 }}>
                                {account.name}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                                {account.email}
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
