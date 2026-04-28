export interface KeyValueItem {
    label: string;
    value: string;
    color?: string;
    href?: string;
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
    data?: KeyValueItem[] | TagItem[];
    customContentId?: string;
    delay?: number;
}

export interface ScanSection {
    id: string;
    title: string;
    cards: InfoCardData[];
}

export interface Vulnerability {
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
}

export interface AiAnalysis {
    threat_level: number;
    summary: string;
    vulnerabilities: Vulnerability[];
    remediation: string[];
}
