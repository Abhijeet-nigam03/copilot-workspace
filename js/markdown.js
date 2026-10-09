// ==========================================
// SYNAPSE OS: Lightweight Markdown Renderer
// ==========================================

function renderMarkdown(md) {
  if (!md) return '';

  let html = md;

  // Escape raw HTML tags for safety (except allowed markup)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code Blocks ```lang \n code \n ```
  html = html.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Math blocks $$ ... $$
  html = html.replace(/\$\$([\s\S]*?)\$\$/g, '<div class="math-block"><code>$$ $1 $$</code></div>');
  html = html.replace(/\$([^\$\n]+)\$/g, '<span class="math-inline"><code>$1</code></span>');

  // Headers #, ##, ###, ####
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes > quote
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Task list items - [ ] and - [x]
  html = html.replace(/^- \[x\] (.*$)/gim, '<li class="task-done"><input type="checkbox" checked disabled> $1</li>');
  html = html.replace(/^- \[ \] (.*$)/gim, '<li class="task-todo"><input type="checkbox" disabled> $1</li>');

  // Unordered lists - item
  html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>');

  // Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Markdown Tables (| col | col |)
  html = html.replace(/((?:\|[^\n]+\|\r?\n)+)/g, (tableBlock) => {
    const lines = tableBlock.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return tableBlock;

    let tableHtml = '<table>';
    let isHeader = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('---')) continue; // Separator line
      
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (isHeader) {
        tableHtml += '<thead><tr>' + cells.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        isHeader = false;
      } else {
        tableHtml += '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      }
    }
    tableHtml += '</tbody></table>';
    return tableHtml;
  });

  // Paragraphs
  const split = html.split(/\n{2,}/);
  html = split.map(chunk => {
    chunk = chunk.trim();
    if (
      chunk.startsWith('<h1>') || chunk.startsWith('<h2>') || chunk.startsWith('<h3>') ||
      chunk.startsWith('<h4>') || chunk.startsWith('<blockquote>') || chunk.startsWith('<pre>') ||
      chunk.startsWith('<table>') || chunk.startsWith('<li>') || chunk.startsWith('<div class="math-block">')
    ) {
      if (chunk.startsWith('<li>')) return `<ul>${chunk}</ul>`;
      return chunk;
    }
    return `<p>${chunk.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return html;
}
