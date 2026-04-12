export interface KeyValueItem {
    label: string;
    value: string;
    color?: string;
}

export interface TagItem {
    label: string;
    color?: string;
}

export type CardContentType = 'kv-list' | 'tags' | 'custom';

export interface InfoCardData {
    id: string;
    title: string;
    type: CardContentType;
    data?: KeyValueItem[] | TagItem[]; // Union type for different data structures
    customContentId?: string; // Identifier for special custom renderers (e.g., 'map')
    delay?: number; // Animation delay
}

export interface ScanSection {
    id: string;
    title: string;
    cards: InfoCardData[];
}

// AI Analysis Types
export interface Vulnerability {
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
}

export interface AiAnalysis {
    threat_level: number;
    summary: string;
    vulnerabilities: Vulnerability[];
    remediation: string[]; // Array of strings based on LLM output
}
