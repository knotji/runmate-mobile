import { Fragment, type ReactNode } from 'react';

// Renders the light Markdown the prompt asks for (**bold**, "- " bullet
// lines, blank-line-separated paragraphs) without pulling in a Markdown
// library — the model only ever produces this small, fixed subset. A line
// scanner rather than a blank-line block split, since a bullet list is
// often introduced by a line directly above it with no blank line between
// ("สิ่งที่ควรทำวันนี้:\n- ...") — a block-level split would keep that intro
// line and its bullets in one paragraph-shaped block and miss the list.
export function formatCoachMessage(message: string): ReactNode {
  const nodes: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    nodes.push(<p className="ai-coach-message-paragraph" key={key++}>
      {paragraphLines.map((line, index) => <Fragment key={index}>{index > 0 && <br />}{formatInlineBold(line)}</Fragment>)}
    </p>);
    paragraphLines = [];
  };
  const flushList = () => {
    if (listItems.length === 0) return;
    nodes.push(<ul className="ai-coach-message-list" key={key++}>
      {listItems.map((item, index) => <li key={index}>{formatInlineBold(item)}</li>)}
    </ul>);
    listItems = [];
  };

  for (const rawLine of message.split('\n')) {
    const line = rawLine.trim();
    if (!line) { flushParagraph(); flushList(); continue; }
    const bullet = /^[-•]\s+(.*)$/.exec(line);
    if (bullet) { flushParagraph(); listItems.push(bullet[1]); }
    else { flushList(); paragraphLines.push(line); }
  }
  flushParagraph();
  flushList();
  return nodes;
}

export function formatInlineBold(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : <Fragment key={index}>{part}</Fragment>);
}
