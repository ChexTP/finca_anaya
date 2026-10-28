import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDocumentNotes } from './documentNotes.js';

test('nota libre conserva lineas y caracteres, con HTML escapado', () => {
  const html = renderDocumentNotes('Primera linea\nSegunda: <cafe> & "precio"');
  assert.ok(html.includes('white-space:pre-wrap'));
  assert.ok(html.includes('Primera linea\nSegunda: &lt;cafe&gt; &amp; &quot;precio&quot;'));
  assert.ok(!html.includes('<cafe>'));
});

test('notas vacias no generan seccion y se puede traducir el titulo', () => {
  for (const value of [null, undefined, '', '  \n ']) assert.equal(renderDocumentNotes(value), '');
  assert.ok(renderDocumentNotes('Free text', 'Notes').includes('>Notes</h3>'));
});
