import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { ExportButton } from './ExportButton';

describe('ExportButton', () => {
  it('renders export label', () => {
    const article = document.createElement('article');
    render(<ExportButton tweetId="123" tweetElement={article} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });
});
