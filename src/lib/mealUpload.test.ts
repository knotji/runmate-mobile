import { describe, expect, it } from 'vitest';
import { analyzeMealText, inferBangkokMealType, readFunctionError } from '@/lib/mealUpload';

describe('Bangkok meal type inference', () => {
  it.each([
    ['2026-07-17T22:00:00.000Z', 'breakfast'], // 05:00 Bangkok
    ['2026-07-18T04:00:00.000Z', 'lunch'],     // 11:00 Bangkok
    ['2026-07-18T09:00:00.000Z', 'dinner'],    // 16:00 Bangkok
    ['2026-07-18T15:00:00.000Z', 'snack'],     // 22:00 Bangkok
    ['2026-07-18T21:59:00.000Z', 'snack'],     // 04:59 Bangkok
  ])('maps %s to %s', (timestamp, expected) => {
    expect(inferBangkokMealType(new Date(timestamp))).toBe(expected);
  });
});

describe('text meal input', () => {
  it('rejects invalid descriptions before calling the analyzer', async () => {
    await expect(analyzeMealText('  ', 'lunch', '')).rejects.toThrow('Describe At Least One Food Or Drink');
    await expect(analyzeMealText('x'.repeat(1001), 'lunch', '')).rejects.toThrow('Meal Description Is Too Long');
  });
});

describe('readFunctionError', () => {
  it('surfaces the Edge Function\'s specific error body instead of the generic non-2xx message', async () => {
    const context = new Response(JSON.stringify({ error: 'Could Not Identify Food In This Meal. Try A Clearer Photo Or Type What You Ate.' }), { status: 422 });
    const message = await readFunctionError({ message: 'Edge Function returned a non-2xx status code', context });
    expect(message).toBe('Could Not Identify Food In This Meal. Try A Clearer Photo Or Type What You Ate.');
  });

  it('falls back to a generic message when the response body has no error field', async () => {
    const context = new Response(JSON.stringify({ ok: false }), { status: 500 });
    const message = await readFunctionError({ message: 'Edge Function returned a non-2xx status code', context });
    expect(message).toBe('Meal Analysis Failed. Please Try Again.');
  });

  it('falls back to a generic message when there is no context at all', async () => {
    const message = await readFunctionError({ message: 'Edge Function returned a non-2xx status code' });
    expect(message).toBe('Meal Analysis Failed. Please Try Again.');
  });

  it('passes through a non-non-2xx message unchanged', async () => {
    const message = await readFunctionError({ message: 'Failed to send a request to the Edge Function' });
    expect(message).toBe('Failed to send a request to the Edge Function');
  });
});
