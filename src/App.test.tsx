import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  test('renders HelloSpeech title', () => {
    render(<App />);
    const titleElement = screen.getByText(/HelloSpeech/i);
    expect(titleElement).toBeInTheDocument();
  });
});