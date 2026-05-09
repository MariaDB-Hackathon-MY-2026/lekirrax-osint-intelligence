import React, { useMemo, useRef } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import Markdown from 'react-markdown';
import type { AiAnalysis } from '../types';
import './SecurityReport.css';

interface ExecutiveSummaryMeta {
    target?: string;
    scanId?: number | string;
}

interface SecurityReportProps {
    analysis: AiAnalysis | null;
    loading: boolean;
    meta?: ExecutiveSummaryMeta;
}

function fnv1a32(input: string) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function toSafeFilePart(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 60) || 'report';
}

function downloadTextFile({ filename, text, mime }: { filename: string; text: string; mime: string }) {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function buildMarkdownExport({
    analysis,
    meta,
    exportedAtIso,
    revisionId
}: {
    analysis: AiAnalysis;
    meta?: ExecutiveSummaryMeta;
    exportedAtIso: string;
    revisionId: string;
}) {
    const threatLevel = analysis.threat_level ?? 0;
    const targetLine = meta?.target ? `- Target: ${meta.target}` : null;
    const scanIdLine = meta?.scanId !== undefined && meta?.scanId !== null ? `- Scan ID: ${String(meta.scanId)}` : null;
    const lines = [
        '# Security Executive Summary',
        '',
        '---',
        '',
        ...(targetLine ? [targetLine] : []),
        ...(scanIdLine ? [scanIdLine] : []),
        `- Threat Level: ${threatLevel}/10`,
        `- Exported: ${exportedAtIso}`,
        `- Revision: ${revisionId}`,
        '',
        '---',
        '',
        '## Executive Summary',
        '',
        analysis.summary || 'No summary provided.',
        '',
        '---',
        '',
        '## Top Vulnerabilities',
        ''
    ];

    const vulns = analysis.vulnerabilities || [];
    if (vulns.length) {
        for (const v of vulns) {
            const title = v?.title ? String(v.title) : 'Untitled finding';
            const sev = v?.severity ? String(v.severity) : 'Unknown';
            const desc = v?.description ? String(v.description) : '';
            const suffix = desc ? `: ${desc}` : '';
            lines.push(`- **${title}** (${sev})${suffix}`);
        }
    } else {
        lines.push('- No significant vulnerabilities detected.');
    }

    lines.push('', '---', '', '## Remediation Plan', '');

    const remediation = analysis.remediation || [];
    if (remediation.length) {
        remediation.forEach((step, i) => {
            lines.push(`${i + 1}. ${String(step)}`);
        });
    } else {
        lines.push('No specific remediation steps provided.');
    }

    lines.push('');
    return lines.join('\n');
}

const SecurityReport: React.FC<SecurityReportProps> = ({ analysis, loading, meta }) => {
    const exportSource = useMemo(() => JSON.stringify({ analysis: analysis || null, meta: meta || null }), [analysis, meta]);
    const revisionId = useMemo(() => fnv1a32(exportSource), [exportSource]);
    const exportRef = useRef<HTMLElement | null>(null);

    // Terminal-style loading
    if (loading) {
        return (
            <div className="exec-summary__loading" aria-label="Generating executive summary">
                <div className="exec-summary__loading-title">INITIALIZING REPORT…</div>
                <div className="exec-summary__loading-lines" aria-hidden="true">
                    <div>&gt; Connecting to analysis pipeline</div>
                    <div>&gt; Analyzing attack surface</div>
                    <div>&gt; Computing threat score</div>
                    <div>&gt; Generating remediation plan</div>
                </div>
            </div>
        );
    }

    if (!analysis) return null;

    // Color logic for Risk Meter
    const getRiskColor = (score: number) => {
        if (score >= 8) return '#ef4444'; 
        if (score >= 5) return '#f59e0b'; 
        return '#10b981'; 
    };

    const getRiskLabel = (score: number) => {
        if (score >= 8) return 'Critical';
        if (score >= 5) return 'Elevated';
        return 'Low';
    };

    const getSeverityBadge = (severity: string) => {
        const colors: Record<string, string> = {
            'Critical': 'sev sev--critical',
            'High': 'sev sev--high',
            'Medium': 'sev sev--medium',
            'Low': 'sev sev--low'
        };
        return colors[severity] || 'sev';
    };

    const onDownloadMarkdown = () => {
        const exportedAtIso = new Date().toISOString();
        const md = buildMarkdownExport({
            analysis,
            meta,
            exportedAtIso,
            revisionId
        });
        const targetPart = meta?.target ? toSafeFilePart(meta.target) : 'target';
        const scanPart = meta?.scanId !== undefined && meta?.scanId !== null ? `scan-${String(meta.scanId)}` : 'scan';
        const filename = `executive-summary_${targetPart}_${scanPart}_rev-${revisionId}.md`;
        downloadTextFile({ filename, text: md, mime: 'text/markdown;charset=utf-8' });
    };

    return (
        <section ref={exportRef} className="exec-summary" aria-label="Security executive summary">
            <div className="exec-summary__hero">
                <div className="exec-summary__hero-inner">
                    <div className="exec-summary__meter">
                        <div style={{ width: 100, height: 100 }}>
                            <CircularProgressbar
                                value={(analysis.threat_level || 0) * 10}
                                text={`${analysis.threat_level || 0}/10`}
                                styles={buildStyles({
                                    pathColor: getRiskColor(analysis.threat_level || 0),
                                    textColor: '#fff',
                                    trailColor: 'rgba(148, 163, 184, 0.2)',
                                    textSize: '22px',
                                    pathTransitionDuration: 0.5,
                                })}
                            />
                        </div>
                        <div className="exec-summary__meter-label">Threat Level</div>
                        <div
                            className="exec-summary__risk-pill mt-2"
                            style={{ borderColor: `${getRiskColor(analysis.threat_level || 0)}55` }}
                        >
                            <span
                                className="exec-summary__risk-dot"
                                style={{ background: getRiskColor(analysis.threat_level || 0) }}
                            />
                            {getRiskLabel(analysis.threat_level || 0)}
                        </div>
                    </div>

                    <div className="exec-summary__content">
                        <div className="exec-summary__toolbar">
                            <div className="exec-summary__heading">
                                <h2 className="exec-summary__title">
                                    <span className="exec-summary__title-icon" aria-hidden="true">🛡️</span>
                                    Security Executive Summary
                                </h2>
                                <div className="exec-summary__meta">
                                    {meta?.target ? <span>Target: {meta.target}</span> : null}
                                    {meta?.scanId !== undefined && meta?.scanId !== null ? <span>Scan ID: {String(meta.scanId)}</span> : null}
                                    <span>Revision: {revisionId}</span>
                                </div>
                            </div>
                            <div className="exec-summary__actions">
                                <button type="button" className="exec-summary__action exec-summary__download" onClick={onDownloadMarkdown}>
                                    Download (Editable .md)
                                </button>
                                <button
                                    type="button"
                                    className="exec-summary__action exec-summary__print"
                                    onClick={() => window.print()}
                                >
                                    Print / Save PDF
                                </button>
                            </div>
                        </div>
                        <div className="exec-summary__markdown">
                            <Markdown
                                components={{
                                    h1: ({ children, ...props }) => <h3 {...props} className="exec-summary__h">{children}</h3>,
                                    h2: ({ children, ...props }) => <h4 {...props} className="exec-summary__h">{children}</h4>,
                                    h3: ({ children, ...props }) => <h5 {...props} className="exec-summary__h">{children}</h5>,
                                    p: ({ children, ...props }) => <p {...props} className="exec-summary__p">{children}</p>,
                                    ul: ({ children, ...props }) => <ul {...props} className="exec-summary__ul">{children}</ul>,
                                    ol: ({ children, ...props }) => <ol {...props} className="exec-summary__ol">{children}</ol>,
                                    li: ({ children, ...props }) => <li {...props} className="exec-summary__li">{children}</li>,
                                    hr: (props) => <hr {...props} className="exec-summary__hr" />,
                                    strong: ({ children, ...props }) => <strong {...props} className="exec-summary__strong">{children}</strong>
                                }}
                            >
                                {analysis.summary || "No summary provided."}
                            </Markdown>
                        </div>
                    </div>
                </div>
            </div>

            <div className="exec-summary__grid">
                <div className="exec-summary__panel">
                    <h3 className="exec-summary__panel-title">
                        <span aria-hidden="true">⚠️</span> Top Vulnerabilities
                    </h3>
                    <div className="exec-summary__panel-body">
                        {(analysis.vulnerabilities || []).map((vuln, idx) => (
                            <div key={idx} className="exec-summary__item">
                                <div className="exec-summary__item-head">
                                    <h4 className="exec-summary__item-title">{vuln.title}</h4>
                                    <span className={`exec-summary__sev ${getSeverityBadge(vuln.severity)}`}>
                                        {(vuln.severity || 'Unknown').toUpperCase()}
                                    </span>
                                </div>
                                <p className="exec-summary__vuln">{vuln.description}</p>
                            </div>
                        ))}
                        {(!analysis.vulnerabilities || analysis.vulnerabilities.length === 0) && (
                            <div className="exec-summary__empty">
                                <span aria-hidden="true">✅</span>
                                No significant vulnerabilities detected.
                            </div>
                        )}
                    </div>
                </div>

                <div className="exec-summary__panel">
                    <h3 className="exec-summary__panel-title">
                        <span aria-hidden="true">🔧</span> Remediation Plan
                    </h3>
                    <div className="exec-summary__panel-body">
                        {(analysis.remediation || []).map((step, idx) => (
                            <div key={idx} className="exec-summary__step">
                                <span className="exec-summary__step-idx">
                                    {idx + 1}
                                </span>
                                <span className="exec-summary__step-text">{step}</span>
                            </div>
                        ))}
                         {(!analysis.remediation || analysis.remediation.length === 0) && (
                            <div className="exec-summary__empty">
                                No specific remediation steps provided.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default SecurityReport;
