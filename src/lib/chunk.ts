export function cleanText(input: string) {
  return input.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function simpleChunk(text: string, max = 900) {
  const paras = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = '';
  for (const p of paras) {
    if ((buf + '\n\n' + p).length > max && buf) {
      chunks.push(buf.trim());
      buf = p;
    } else {
      buf = buf ? buf + '\n\n' + p : p;
    }
  }
  if (buf) chunks.push(buf.trim());
  return chunks;
}
