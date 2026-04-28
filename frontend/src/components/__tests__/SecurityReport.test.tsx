import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SecurityReport from '../SecurityReport';

describe('SecurityReport', () => {
  it('renders executive summary sections', () => {
    render(
      <SecurityReport
        loading={false}
        analysis={{
          threat_level: 5,
          summary: 'Executive summary text',
          vulnerabilities: [{ title: 'V1', severity: 'Medium', description: 'D1' }],
          remediation: ['Step 1']
        } as any}
      />
    );

    expect(screen.getByText('Security Executive Summary')).toBeInTheDocument();
    expect(screen.getByText('Top Vulnerabilities')).toBeInTheDocument();
    expect(screen.getByText('Remediation Plan')).toBeInTheDocument();
  });
});

