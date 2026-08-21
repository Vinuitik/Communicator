import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavigationBar from './NavigationBar';
import { ToastProvider } from '../../molecules/Toast';
import { ROUTES } from '../../../utils/constants';

const renderNav = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <NavigationBar />
      </ToastProvider>
    </MemoryRouter>,
  );

describe('NavigationBar — Review entry point', () => {
  it('renders a Review nav link pointing at ROUTES.REVIEW', () => {
    renderNav();

    const link = screen.getByRole('link', { name: 'Review' });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe(ROUTES.REVIEW);
  });
});
