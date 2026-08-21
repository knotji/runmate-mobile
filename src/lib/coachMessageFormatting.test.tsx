import { render } from '@testing-library/react';
import { formatCoachMessage } from '@/lib/coachMessageFormatting';

describe('formatCoachMessage', () => {
  it('renders paragraphs, bullet lists, and bold spans from the light Markdown the AI Coach prompt produces', () => {
    const message = 'Today is a **light** day.\nFocus on recovery.\n\nสิ่งที่ควรทำวันนี้:\n- นอนให้เพียงพอ\n- ดื่มน้ำให้พอ';
    const { container } = render(<div>{formatCoachMessage(message)}</div>);

    const paragraphs = container.querySelectorAll('p.ai-coach-message-paragraph');
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0].querySelector('strong')?.textContent).toBe('light');
    expect(paragraphs[0].textContent).toContain('Focus on recovery.');

    const list = container.querySelector('ul.ai-coach-message-list');
    expect(list?.textContent).toContain('นอนให้เพียงพอ');
    expect(list?.textContent).toContain('ดื่มน้ำให้พอ');
    expect(list?.querySelectorAll('li')).toHaveLength(2);
  });

  it('keeps a bullet list that immediately follows an intro line with no blank line between them in the same block as its intro', () => {
    const message = 'สิ่งที่ควรทำวันนี้:\n- Easy run\n- Stretch';
    const { container } = render(<div>{formatCoachMessage(message)}</div>);

    expect(container.querySelector('p.ai-coach-message-paragraph')?.textContent).toBe('สิ่งที่ควรทำวันนี้:');
    expect(container.querySelector('ul.ai-coach-message-list')?.querySelectorAll('li')).toHaveLength(2);
  });
});
