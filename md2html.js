const fs = require('fs');
const md = fs.readFileSync('PROJECT_GUIDE.md', 'utf8');

// Minimal markdown-to-HTML converter
let html = md
  .replace(/^### (.+)$/gm, '<h3 id="$1">$1</h3>')
  .replace(/^## (.+)$/gm, '<h2 id="$1">$1</h2>')
  .replace(/^# (.+)$/gm, '<h1 id="$1">$1</h1>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
  .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code class="code-block">$2</code></pre>')
  .replace(/^---$/gm, '<hr>')
  .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

// Tables: collect rows between pipes
function convertTables(text) {
  const lines = text.split('\n');
  let result = [];
  let tableLines = [];
  let inTable = false;

  function flushTable() {
    if (tableLines.length > 0) {
      // Separate header, separator, data rows
      const sepIdx = tableLines.findIndex(l => /^<!-->/.test(l));
      let headerRows = '', dataRows = '';
      for (let i = 0; i < sepIdx; i++) {
        headerRows += tableLines[i] + '\n';
      }
      for (let i = sepIdx + 1; i < tableLines.length; i++) {
        dataRows += tableLines[i] + '\n';
      }
      result.push('<table class="data-table">' + headerRows + dataRows + '</table>');
    }
    tableLines = [];
    inTable = false;
  }

  for (const line of lines) {
    if (/^\|/.test(line)) {
      inTable = true;
      const cells = line.split('|').map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) {
        tableLines.push('<!--table-sep-->');
      } else {
        const tag = 'td';
        tableLines.push('<tr>' + cells.map(c => '<' + tag + '>' + c + '</' + tag + '>').join('') + '</tr>');
      }
    } else {
      if (inTable) flushTable();
      result.push(line);
    }
  }
  if (inTable) flushTable();
  return result.join('\n');
}

html = convertTables(html);

// Unordered lists
html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

// Paragraphs for remaining text lines
html = html.replace(/^(?!<[a-z/])(?<!--)(.+)$/gm, function(match, p1) {
  if (p1.trim() === '') return '';
  return '<p>' + p1 + '</p>';
});

const css = `
  :root {
    --bg: #ffffff; --text: #1a1a2e; --muted: #6c757d; --border: #dee2e6;
    --code-bg: #f4f4f8; --accent: #4361ee; --accent-light: rgba(67,97,238,.08);
    --table-stripe: #f8f9fa; --blockquote-bg: #fff8e1;
  }
  .dark {
    --bg: #1a1a2e; --text: #eaeaea; --muted: #a0a0b0; --border: #2d3748;
    --code-bg: #16213e; --accent: #60a5fa; --accent-light: rgba(96,165,250,.12);
    --table-stripe: #16213e; --blockquote-bg: #3d2e00;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: var(--bg); color: var(--text); line-height: 1.7;
         max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
  h1 { font-size: 2rem; border-bottom: 2px solid var(--accent); padding-bottom: .4rem; margin: 1.5rem 0 .5rem; }
  h2 { font-size: 1.5rem; margin: 2rem 0 .6rem; color: var(--accent); }
  h3 { font-size: 1.15rem; margin: 1.5rem 0 .4rem; }
  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
  p { margin: .6rem 0; }
  blockquote { background: var(--blockquote-bg); border-left: 4px solid var(--accent);
               padding: .5rem 1rem; margin: 1rem 0; border-radius: 4px; color: var(--muted); font-size:.92rem; }
  table.data-table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: .88rem; }
  table.data-table th, table.data-table td { border: 1px solid var(--border); padding: .45rem .7rem; text-align: left; }
  table.data-table thead th { background: var(--accent); color: #fff; font-weight: 600; }
  table.data-table tbody tr:nth-child(even) { background: var(--table-stripe); }
  ul { padding-left: 1.5rem; margin: .5rem 0; }
  li { margin: .2rem 0; }
  code.inline-code { background: var(--code-bg); padding: .15rem .4rem; border-radius: 3px;
                     font-family: 'Fira Code', Consolas, monospace; font-size: .88em; color: var(--accent); }
  pre { background: var(--code-bg); padding: 1rem; border-radius: 6px; overflow-x: auto; margin: 1rem 0; }
  code.code-block { font-family: 'Fira Code', Consolas, monospace; font-size: .85em; white-space: pre; color: var(--text); }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  #theme-btn { position: fixed; top: 1rem; right: 1rem; z-index: 99;
               background: var(--bg); border: 1px solid var(--border); padding: .4rem .7rem;
               border-radius: 6px; cursor: pointer; font-size: .85rem; color: var(--text); }
  #theme-btn:hover { background: var(--accent-light); }
  #toc { background: var(--code-bg); padding: 1rem 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
  #toc h3 { margin-top: 0; font-size: 1rem; }
  #toc ul { list-style: none; padding-left: .5rem; }
  #toc li { margin: .2rem 0; }
  #toc a { color: var(--accent); font-size: .9rem; }
  @media print { #theme-btn, #toc { display: none; } body { max-width: 100%; padding: 1rem; } }
`;

const tocItems = md.split('\n').filter(l => l.startsWith('## ')).map(l => l.replace(/^## /, ''));
let tocHtml = '<h3>Table of Contents</h3><ul>';
tocItems.forEach(t => {
  const id = t.toLowerCase().replace(/[^\w]+/g, '-');
  tocHtml += '<li><a href="#' + id + '">' + t + '</a></li>';
});
tocHtml += '</ul>';

const fullPage = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EC Tower Live Monitor - Project Guide</title>
<style>${css}</style>
</head>
<body>
<button id="theme-btn" onclick="toggleTheme()">Dark</button>
<nav id="toc">${tocHtml}</nav>
<article>${html}</article>
<script>
function toggleTheme(){
  document.documentElement.classList.toggle('dark');
  var d=document.documentElement.classList.contains('dark');
  document.getElementById('theme-btn').textContent=d?'Light':'Dark';
  localStorage.setItem('ec-theme',d?'dark':'light');
}
(function(){
  var s=localStorage.getItem('ec-theme');
  if(s==='dark' || (!s && matchMedia('(prefers-color-scheme:dark)').matches)){
    document.documentElement.classList.add('dark');
    document.getElementById('theme-btn').textContent='Light';
  }
})();
</script>
</body>
</html>`;

fs.writeFileSync('PROJECT_GUIDE.html', fullPage, 'utf8');
console.log('Written PROJECT_GUIDE.html (' + fullPage.length + ' bytes)');
