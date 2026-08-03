import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MealAnalysis } from '@/types/logs';
import MealUploadFlow from '@/components/MealUploadFlow';

const analyzeMealText = vi.fn();
const createHistoryItem = vi.fn();
const saveHistoryItems = vi.fn();

vi.mock('@/lib/mealUpload', () => ({
  analyzeMealImages: vi.fn(),
  analyzeMealText: (...args: unknown[]) => analyzeMealText(...args),
  inferBangkokMealType: () => 'lunch',
}));
vi.mock('@/lib/cloudHistory', () => ({
  createHistoryItem: (...args: unknown[]) => createHistoryItem(...args),
  saveHistoryItems: (...args: unknown[]) => saveHistoryItems(...args),
}));
vi.mock('@/lib/haptics', () => ({ hapticNotification: vi.fn(), hapticSelection: vi.fn() }));
vi.mock('@/lib/mealDetailCache', () => ({ cacheMealDetailItem: vi.fn() }));

const analyzedMeal: MealAnalysis = {
  mealType: 'lunch',
  inputMode: 'text',
  originalMealText: 'Chicken rice, one plate',
  detectedFoods: [{ name: 'Chicken Rice', quantity: 1, unit: 'plate' }],
  nutrition: { caloriesKcal: 520, proteinG: 28, carbsG: 65, fatG: 16, fiberG: 3 },
  confidence: 'medium',
  needsReview: true,
};

describe('MealUploadFlow text input', () => {
  beforeEach(() => {
    analyzeMealText.mockReset();
    analyzeMealText.mockResolvedValue(analyzedMeal);
    createHistoryItem.mockReset();
    createHistoryItem.mockReturnValue({ id: 'meal-test', type: 'meal', createdAt: '2026-08-04T00:00:00.000Z', data: {} });
    saveHistoryItems.mockReset();
    saveHistoryItems.mockResolvedValue({ ok: true });
  });

  it('starts in text mode and analyzes a typed meal without requiring photos', async () => {
    render(<MemoryRouter><MealUploadFlow /></MemoryRouter>);

    expect(screen.getByRole('button', { name: /Type Meal/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Use Photos/i })).toHaveAttribute('aria-pressed', 'false');

    const reviewButton = screen.getByRole('button', { name: 'Review Meal Description' });
    expect(reviewButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Food And Amount'), { target: { value: 'Chicken rice, one plate' } });
    expect(reviewButton).toBeEnabled();
    fireEvent.click(reviewButton);

    expect(await screen.findByText('Check Your Meal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back To Description' })).toBeInTheDocument();
    expect(analyzeMealText).toHaveBeenCalledWith('Chicken rice, one plate', 'lunch', '');
  });

  it('keeps the existing photo entry available as an explicit alternative', () => {
    render(<MemoryRouter><MealUploadFlow /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /Use Photos/i }));

    expect(screen.getByText('Add Photos')).toBeInTheDocument();
    expect(screen.getByText('Choose Meal Photos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Meal' })).toBeDisabled();
  });

  it('locks inputs while analyzing so request provenance cannot change', async () => {
    let resolveAnalysis!: (meal: MealAnalysis) => void;
    analyzeMealText.mockReturnValue(new Promise<MealAnalysis>((resolve) => { resolveAnalysis = resolve; }));
    render(<MemoryRouter><MealUploadFlow /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText('Food And Amount'), { target: { value: 'Chicken rice, one plate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review Meal Description' }));

    expect(screen.getByRole('button', { name: /Type Meal/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Use Photos/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Lunch' })).toBeDisabled();
    expect(screen.getByLabelText('Food And Amount')).toBeDisabled();

    resolveAnalysis(analyzedMeal);
    expect(await screen.findByText('Check Your Meal')).toBeInTheDocument();
  });

  it('saves typed meals with manual provenance and the analyzed meal type', async () => {
    render(<MemoryRouter><MealUploadFlow /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Food And Amount'), { target: { value: 'Chicken rice, one plate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review Meal Description' }));
    fireEvent.click(await screen.findByRole('button', { name: /Save Meal/i }));

    await waitFor(() => expect(saveHistoryItems).toHaveBeenCalledTimes(1));
    expect(createHistoryItem).toHaveBeenCalledWith('meal', expect.objectContaining({ mealType: 'lunch', mealSlot: 'lunch' }));
    const savedItem = saveHistoryItems.mock.calls[0][0][0];
    expect(savedItem.source).toMatchObject({ provider: 'manual', importType: 'manual' });
  });

  it('shows analysis errors and allows retrying', async () => {
    analyzeMealText.mockRejectedValueOnce(new Error('Meal Analysis Failed. Please Try Again.'));
    render(<MemoryRouter><MealUploadFlow /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Food And Amount'), { target: { value: 'Chicken rice, one plate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review Meal Description' }));

    expect(await screen.findByText('Meal Analysis Failed. Please Try Again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review Meal Description' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Use Photos/i })).toBeEnabled();
  });
});
