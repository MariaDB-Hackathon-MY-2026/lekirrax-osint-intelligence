
export interface OsintResult {
    module: string;
    risk: 'Low' | 'Medium' | 'High';
    data: any;
}

export interface OsintModuleProps {
    moduleName: string;
    target: string;
}
