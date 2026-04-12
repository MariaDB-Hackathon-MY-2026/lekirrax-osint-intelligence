import React from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import Markdown from 'react-markdown';
import type { AiAnalysis } from '../types';

interface SecurityReportProps {
    analysis: AiAnalysis | null;
    loading: boolean;
}

const SecurityReport: React.FC<SecurityReportProps> = ({ analysis, loading }) => {
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
        if (score >= 8) return '#ef4444'; // Red
        if (score >= 5) return '#f59e0b'; // Amber
        return '#10b981'; // Emerald
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

    return (
        <div className="space-y-4">
            {/* Header / Summary */}
            <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700 backdrop-blur-md shadow-xl relative overflow-hidden group">
                {/* Decorative background glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                
                <div className="flex flex-col md:flex-row items-start gap-8 relative z-10">
                    {/* Visual Risk Meter */}
                    <div className="flex flex-col items-center justify-center flex-shrink-0 min-w-[100px]">
                        <div style={{ width: 100, height: 100 }} className="relative">
                            <CircularProgressbar
                                value={analysis.threat_level * 10}
                                text={`${analysis.threat_level}/10`}
                                styles={buildStyles({
                                    pathColor: getRiskColor(analysis.threat_level),
                                    textColor: '#fff',
                                    trailColor: '#1e293b',
                                    textSize: '22px',
                                    pathTransitionDuration: 0.5,
                                })}
                            />
                        </div>
                        <p className="text-center mt-3 font-bold text-slate-400 text-xs tracking-widest uppercase">Threat Level</p>
                    </div>

                    {/* Executive Summary */}
                    <div className="flex-1 pt-2">
                        <h2 className="text-2xl font-bold text-white mb-4 flex items-center tracking-tight">
                            <span className="mr-3 text-3xl">🛡️</span> 
                            Security Executive Summary
                        </h2>
                        <div className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm md:text-base border-l-4 border-slate-600 pl-4 bg-slate-800/30 py-2 rounded-r-lg">
                            <Markdown>{analysis.summary}</Markdown>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Findings List */}
                <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700 backdrop-blur-sm shadow-lg hover:border-slate-600 transition-colors">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center border-b border-slate-700 pb-3">
                        <span className="mr-3 text-xl">⚠️</span> Top Vulnerabilities
                    </h3>
                    <div className="space-y-4">
                        {analysis.vulnerabilities.map((vuln, idx) => (
                            <div key={idx} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 hover:border-slate-600 transition-all group">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-white text-sm group-hover:text-cyan-400 transition-colors">{vuln.title}</h4>
                                    <span className={`text-[10px] px-2 py-0.5 rounded border font-medium tracking-wide ${getSeverityBadge(vuln.severity)}`}>
                                        {vuln.severity.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{vuln.description}</p>
                            </div>
                        ))}
                        {analysis.vulnerabilities.length === 0 && (
                            <div className="text-center py-8 text-slate-500 italic flex flex-col items-center">
                                <span className="text-2xl mb-2">✅</span>
                                No significant vulnerabilities detected.
                            </div>
                        )}
                    </div>
                </div>

                {/* Remediation Plan */}
                <div className="bg-slate-800/80 rounded-xl p-6 border border-slate-700 backdrop-blur-sm shadow-lg hover:border-slate-600 transition-colors">
                    <h3 className="text-lg font-bold text-white mb-5 flex items-center border-b border-slate-700 pb-3">
                        <span className="mr-3 text-xl">🔧</span> Remediation Plan
                    </h3>
                    <div className="space-y-4">
                        {analysis.remediation.map((step, idx) => (
                            <div key={idx} className="flex items-start gap-4 text-sm text-slate-300 group">
                                <span className="bg-slate-700/50 text-cyan-400 border border-slate-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5 group-hover:bg-cyan-900/30 group-hover:border-cyan-700 transition-colors">
                                    {idx + 1}
                                </span>
                                <span className="leading-relaxed pt-0.5">{step}</span>
                            </div>
                        ))}
                         {analysis.remediation.length === 0 && (
                            <div className="text-center py-8 text-slate-500 italic">
                                No specific remediation steps provided.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SecurityReport;
