import React, { useMemo, useRef, useState } from 'react';
import './JsonViewer.css';

type JsonValue =
    | null
    | boolean
    | number
    | string
    | JsonValue[]
    | { [key: string]: JsonValue };

function isPlainObject(value: unknown): value is Record<string, unknown> {
    if (value == null || typeof value !== 'object') return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}

function coerceToJson(value: unknown): { value: unknown; parseError: string | null } {
    if (typeof value !== 'string') return { value, parseError: null };
    const raw = value.trim();
    if (!raw) return { value: '', parseError: null };
    const looksJson = raw.startsWith('{') || raw.startsWith('[');
    if (!looksJson) return { value, parseError: null };
    try {
        return { value: JSON.parse(raw), parseError: null };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid JSON';
        return { value, parseError: msg };
    }
}

function stableKey(path: string) {
    return path.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function escapeHtml(str: string) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function highlightJson(jsonText: string) {
    const escaped = escapeHtml(jsonText);
    const tokenRe =
        /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
    return escaped.replace(tokenRe, (m) => {
        if (m.startsWith('"')) {
            const isKey = /:\s*$/.test(m);
            const raw = isKey ? m.replace(/:\s*$/, '') : m;
            const cls = isKey ? 'json-s-key' : 'json-s-string';
            const suffix = isKey ? ':' : '';
            return `<span class="${cls}">${raw}</span>${suffix}`;
        }
        if (m === 'true' || m === 'false') return `<span class="json-s-boolean">${m}</span>`;
        if (m === 'null') return `<span class="json-s-null">${m}</span>`;
        return `<span class="json-s-number">${m}</span>`;
    });
}

function nodeSummary(value: unknown) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `Array(${value.length})`;
    if (isPlainObject(value)) return `Object(${Object.keys(value).length})`;
    if (typeof value === 'string') return `"${value.length > 80 ? `${value.slice(0, 80)}…` : value}"`;
    return String(value);
}

function isCollapsible(value: unknown) {
    return Array.isArray(value) || isPlainObject(value);
}

function sortObjectKeys(obj: Record<string, unknown>) {
    return Object.keys(obj).sort((a, b) => a.localeCompare(b));
}

function getChildEntries(value: unknown): Array<{ key: string; value: unknown }> {
    if (Array.isArray(value)) {
        return value.map((v, i) => ({ key: String(i), value: v }));
    }
    if (isPlainObject(value)) {
        return sortObjectKeys(value).map((k) => ({ key: k, value: (value as any)[k] }));
    }
    return [];
}

function shouldExpandByDefault(path: string, defaultDepth: number) {
    if (!path) return defaultDepth >= 0;
    const depth = path.split('.').length - 1;
    return depth < defaultDepth;
}

function JsonCodeBlock({ text }: { text: string }) {
    const html = useMemo(() => highlightJson(text), [text]);
    return (
        <pre className="json-code" aria-label="Raw JSON output">
            <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
    );
}

function JsonNodeRow({
    path,
    label,
    value,
    depth,
    expanded,
    onToggle,
    onMoveFocus
}: {
    path: string;
    label: string | null;
    value: unknown;
    depth: number;
    expanded: boolean;
    onToggle: () => void;
    onMoveFocus: (path: string, direction: -1 | 1) => void;
}) {
    const collapsible = isCollapsible(value);
    const id = `json-node-${stableKey(path || 'root')}`;
    const typeClass =
        value === null
            ? 'json-v-null'
            : Array.isArray(value)
                ? 'json-v-array'
                : isPlainObject(value)
                    ? 'json-v-object'
                    : typeof value === 'string'
                        ? 'json-v-string'
                        : typeof value === 'number'
                            ? 'json-v-number'
                            : typeof value === 'boolean'
                                ? 'json-v-boolean'
                                : 'json-v-unknown';
    const shown =
        typeof value === 'string'
            ? `"${value}"`
            : value === null
                ? 'null'
                : typeof value === 'number' || typeof value === 'boolean'
                    ? String(value)
                    : nodeSummary(value);

    return (
        <div
            className="json-row"
            role="treeitem"
            aria-expanded={collapsible ? expanded : undefined}
            aria-level={depth + 1}
            aria-label={label ? `${label}: ${nodeSummary(value)}` : nodeSummary(value)}
            data-json-row="1"
            data-json-path={path || 'root'}
            style={{ paddingLeft: `${depth * 14}px` }}
        >
            <button
                type="button"
                className={`json-toggle ${collapsible ? '' : 'json-toggle--leaf'}`}
                aria-expanded={collapsible ? expanded : undefined}
                aria-controls={collapsible ? id : undefined}
                onClick={() => collapsible && onToggle()}
                onKeyDown={(e) => {
                    if (!collapsible && (e.key === 'Enter' || e.key === ' ')) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (collapsible) onToggle();
                        return;
                    }
                    if (e.key === 'ArrowRight') {
                        if (collapsible && !expanded) {
                            e.preventDefault();
                            onToggle();
                        }
                        return;
                    }
                    if (e.key === 'ArrowLeft') {
                        if (collapsible && expanded) {
                            e.preventDefault();
                            onToggle();
                        }
                        return;
                    }
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        onMoveFocus(path || 'root', 1);
                        return;
                    }
                    if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        onMoveFocus(path || 'root', -1);
                        return;
                    }
                }}
            >
                <span className="json-caret" aria-hidden="true">
                    {collapsible ? (expanded ? '▾' : '▸') : '•'}
                </span>
                {label != null && (
                    <>
                        <span className="json-key">"{label}"</span>
                        <span className="json-colon">:</span>
                    </>
                )}
                <span className={`json-value ${typeClass}`}>{shown}</span>
            </button>
        </div>
    );
}

function JsonTree({
    root,
    defaultExpandDepth
}: {
    root: unknown;
    defaultExpandDepth: number;
}) {
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const containerRef = useRef<HTMLDivElement | null>(null);

    const isExpanded = (path: string) => {
        if (Object.prototype.hasOwnProperty.call(expanded, path)) return Boolean(expanded[path]);
        return shouldExpandByDefault(path, defaultExpandDepth);
    };

    const togglePath = (path: string) => {
        setExpanded((prev) => ({ ...prev, [path]: !isExpanded(path) }));
    };

    const moveFocus = (path: string, direction: -1 | 1) => {
        const rootEl = containerRef.current;
        if (!rootEl) return;
        const buttons = Array.from(rootEl.querySelectorAll<HTMLButtonElement>('[data-json-row="1"] .json-toggle'));
        const idx = buttons.findIndex((b) => b.closest('[data-json-path]')?.getAttribute('data-json-path') === path);
        const next = idx === -1 ? null : buttons[idx + direction];
        next?.focus();
    };

    const renderNode = (value: unknown, path: string, label: string | null, depth: number): React.ReactNode => {
        const collapsible = isCollapsible(value);
        const open = collapsible ? isExpanded(path || 'root') : false;
        const children = collapsible && open ? getChildEntries(value) : [];
        const id = `json-node-${stableKey(path || 'root')}`;

        return (
            <React.Fragment key={path || 'root'}>
                <JsonNodeRow
                    path={path || ''}
                    label={label}
                    value={value}
                    depth={depth}
                    expanded={open}
                    onToggle={() => togglePath(path || 'root')}
                    onMoveFocus={moveFocus}
                />
                {collapsible && open && (
                    <div id={id} role="group" className="json-children">
                        {children.map((entry) => {
                            const childPath = label == null && !path ? entry.key : path ? `${path}.${entry.key}` : entry.key;
                            return renderNode(entry.value, childPath, entry.key, depth + 1);
                        })}
                    </div>
                )}
            </React.Fragment>
        );
    };

    return (
        <div className="json-tree" role="tree" ref={containerRef} aria-label="JSON viewer">
            {renderNode(root, '', null, 0)}
        </div>
    );
}

export default function JsonViewer({
    value,
    defaultExpandDepth = 2,
    mode = 'tree'
}: {
    value: unknown;
    defaultExpandDepth?: number;
    mode?: 'tree' | 'code';
}) {
    const { value: parsed, parseError } = useMemo(() => coerceToJson(value), [value]);
    const codeText = useMemo(() => {
        if (typeof value === 'string') return value;
        try {
            return JSON.stringify(parsed as JsonValue, null, 2);
        } catch {
            return String(parsed);
        }
    }, [parsed, value]);

    return (
        <div className="json-viewer">
            {parseError && (
                <div className="json-parse-error" role="alert">
                    Invalid JSON: {parseError}
                </div>
            )}
            {mode === 'code' ? <JsonCodeBlock text={codeText} /> : <JsonTree root={parsed} defaultExpandDepth={defaultExpandDepth} />}
        </div>
    );
}
