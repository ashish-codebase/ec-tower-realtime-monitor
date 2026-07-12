import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SiteSelector from '../SiteSelector';

describe('SiteSelector', () => {
  const mockSites = [
    { name: 'Site A', ip: '192.168.1.1' },
    { name: 'Site B', ip: '192.168.1.2' },
  ];

  it('renders without crashing', () => {
    render(
      <SiteSelector
        sites={mockSites}
        selected=""
        onChange={() => {}}
        siteStatuses={{}}
      />
    );
    expect(screen.getByText('Site A')).toBeInTheDocument();
  });

  it('shows radio buttons for each site', () => {
    render(
      <SiteSelector
        sites={mockSites}
        selected=""
        onChange={() => {}}
        siteStatuses={{}}
      />
    );
    
    expect(screen.getByText('Site A')).toBeInTheDocument();
    expect(screen.getByText('Site B')).toBeInTheDocument();
  });

  it('calls onChange when site is selected', () => {
    const onChange = vi.fn();
    
    render(
      <SiteSelector
        sites={mockSites}
        selected=""
        onChange={onChange}
        siteStatuses={{}}
      />
    );
    
    fireEvent.click(screen.getByText('Site A').closest('label')!);
    expect(onChange).toHaveBeenCalledWith('192.168.1.1');
  });

  it('shows not-found status when site has no data', () => {
    render(
      <SiteSelector
        sites={mockSites}
        selected="192.168.1.1"
        onChange={() => {}}
        siteStatuses={{ '192.168.1.1': 'not-found' }}
      />
    );
    
    const input = document.querySelector('input[value="192.168.1.1"]');
    expect(input).toHaveClass('accent-red-600');
  });
});
