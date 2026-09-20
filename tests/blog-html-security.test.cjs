const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const dom = new JSDOM('');
const purifier = require('dompurify')(dom.window);
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/utils/blogHtml.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
const mod = { exports: {} }; new Function('require', 'module', 'exports', code)(() => purifier, mod, mod.exports);
const convert = mod.exports.convertToBlogHtml;

test('blog title, emphasis, summary and copy styles remain intact', () => {
  const html = convert('제목: 기존 제목\n\n소제목: 질문\n**강조**와 <b>기존 볼드</b>\n3줄 요약\n첫째\n둘째\n셋째');
  assert.ok(html.includes('font-size: 24pt')); assert.ok(html.includes('font-size: 18pt'));
  assert.ok(html.includes('<b>강조</b>')); assert.ok(html.includes('<b>기존 볼드</b>'));
  assert.ok(html.includes('border: 2px solid')); assert.ok(html.includes('셋째'));
});
test('hostile pasted/AI HTML cannot create scripts, event handlers, frames, CSS or unsafe links', () => {
  for (const payload of ['<img src=x onerror=alert(1)>', '<svg><a onmouseover=alert(1)>x</a></svg>', '<script>alert(1)</script>', '<iframe src="https://attacker.invalid"></iframe>', '<a href="javascript:alert(1)">link</a>', '<span style="background:url(https://attacker.invalid)">text</span>']) {
    const fragment = JSDOM.fragment(convert('제목\n'+payload));
    assert.equal(fragment.querySelector('script,img,svg,iframe,style'),null);
    for(const el of fragment.querySelectorAll('*')) for(const attr of el.attributes) {
      assert.ok(!attr.name.startsWith('on'));assert.ok(!/javascript:|attacker\.invalid/i.test(attr.value));
    }
  }
});
