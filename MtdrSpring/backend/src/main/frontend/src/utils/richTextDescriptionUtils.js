const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'P', 'BR', 'DIV']);

function cleanNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.cloneNode(true);
  }
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }
  const tag = node.tagName;
  if (!ALLOWED_TAGS.has(tag)) {
    const frag = document.createDocumentFragment();
    node.childNodes.forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) frag.appendChild(cleaned);
    });
    return frag;
  }
  const el = document.createElement(tag.toLowerCase());
  node.childNodes.forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) el.appendChild(cleaned);
  });
  return el;
}

/** Strip unsafe HTML; keep basic formatting tags only. */
export function sanitizeRichDescriptionHtml(dirty) {
  if (dirty == null) return '';
  const input = String(dirty).trim();
  if (!input) return '';
  if (typeof document === 'undefined') return input;
  const template = document.createElement('template');
  template.innerHTML = input;
  const out = document.createElement('div');
  template.content.childNodes.forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) out.appendChild(cleaned);
  });
  return out.innerHTML.trim();
}

export function looksLikeRichDescriptionHtml(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || ''));
}

export function richDescriptionPlainText(value) {
  if (value == null) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  if (typeof document === 'undefined') {
    return raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const div = document.createElement('div');
  div.innerHTML = looksLikeRichDescriptionHtml(raw) ? sanitizeRichDescriptionHtml(raw) : raw;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

export const richDescriptionViewSx = {
  fontSize: 13,
  color: 'text.secondary',
  lineHeight: 1.55,
  '& p': { m: 0, mb: 0.75 },
  '& ul, & ol': { m: 0, pl: 2.5, mb: 0.75 },
  '& li': { mb: 0.25 },
  '& b, & strong': { fontWeight: 700 },
  '& i, & em': { fontStyle: 'italic' },
  '& u': { textDecoration: 'underline' },
};
