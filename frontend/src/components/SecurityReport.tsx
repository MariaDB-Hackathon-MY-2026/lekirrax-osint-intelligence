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
            <div className="bg-gray-900 text-green-400 p-6 rounded-lg font-mono min-h-[300px] flex flex-col justify-center items-center border border-green-800 shadow-lg shadow-green-900/20">
                <div className="animate-pulse text-xl mb-4">
                    <span className="mr-2">⚡</span>
                    INITIALIZING SENTINEL AI...
                </div>
                <div className="text-sm opacity-80">
                    <p className="mb-1">&gt; Connecting to Neural Network...</p>
                    <p className="mb-1 animate-[fadeIn_0.5s_ease-in-out_0.5s_forwards] opacity-0">&gt; Analyzing Attack Surface...</p>
                    <p className="mb-1 animate-[fadeIn_0.5s_ease-in-out_1.0s_forwards] opacity-0">&gt; Calculating Threat Score...</p>
                    <p className="mb-1 animate-[fadeIn_0.5s_ease-in-out_1.5s_forwards] opacity-0">&gt; Generating Remediation Plan...</p>
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
            'Critical': 'bg-red-900/50 text-red-200 border-red-700',
            'High': 'bg-orange-900/50 text-orange-200 border-orange-700',
            'Medium': 'bg-yellow-900/50 text-yellow-200 border-yellow-700',
            'Low': 'bg-green-900/50 text-green-200 border-green-700'
        };
        return colors[severity] || 'bg-gray-800 text-gray-300';
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
        <section ref={exportRef} className="exec-summary space-y-4" aria-label="Security executive summary">
            <div className="exec-summary__hero bg-slate-800/80 rounded-xl p-6 border border-slate-700 backdrop-blur-md shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="flex flex-col md:flex-row items-start gap-8 relative z-10">
                    <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[100px]">
                        <div style={{ width: 100, height: 100 }} className="relative">
                            <CircularProgressbar
                                value={(analysis.threat_level || 0) * 10}
                                text={`${analysis.threat_level || 0}/10`}
                                styles={buildStyles({
                                    pathColor: getRiskColor(analysis.threat_level || 0),
                                    textColor: '#fff',
                                    trailColor: '#1e293b',
                                    textSize: '22px',
                                    pathTransitionDuration: 0.5,
                                })}
                            />
                        </div>
                        <p className="text-center mt-3 font-bold text-slate-400 text-xs tracking-widest uppercase">Threat Level</p>
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

                    <div className="flex-1 pt-2">
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
                        <div className="exec-summary__markdown prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm md:text-base border-l-4 border-slate-600 pl-4 bg-slate-800/30 py-3 rounded-r-lg">
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700 backdrop-blur-sm shadow-lg hover:border-slate-600 transition-colors">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center border-b border-slate-700 pb-3">
                        <span className="mr-3 text-xl">⚠️</span> Top Vulnerabilities
                    </h3>
                    <div className="space-y-4">
                        {(analysis.vulnerabilities || []).map((vuln, idx) => (
                            <div key={idx} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 hover:border-slate-600 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-white text-sm group-hover:text-cyan-400 transition-colors">{vuln.title}</h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium tracking-wide ${getSeverityBadge(vuln.severity)}`}>
                                        {(vuln.severity || 'Unknown').toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300/80 leading-relaxed exec-summary__vuln">{vuln.description}</p>
                            </div>
                        ))}
                        {(!analysis.vulnerabilities || analysis.vulnerabilities.length === 0) && (
                            <div className="text-center py-8 text-slate-500 italic flex flex-col items-center">
                                <span className="text-2xl mb-2">✅</span>
                                No significant vulnerabilities detected.
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700 backdrop-blur-sm shadow-lg hover:border-slate-600 transition-colors">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center border-b border-slate-700 pb-3">
                        <span className="mr-3 text-xl">🔧</span> Remediation Plan
                    </h3>
                    <div className="space-y-4">
                        {(analysis.remediation || []).map((step, idx) => (
                            <div key={idx} className="flex items-start gap-4 text-sm text-slate-300 group">
                                <span className="bg-slate-700/50 text-cyan-400 border border-slate-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5 group-hover:bg-cyan-900/30 group-hover:border-cyan-700 transition-colors">
                                    {idx + 1}
                                </span>
                                <span className="leading-relaxed pt-0.5">{step}</span>
                            </div>
                        ))}
                         {(!analysis.remediation || analysis.remediation.length === 0) && (
                            <div className="text-center py-8 text-slate-500 italic">
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
