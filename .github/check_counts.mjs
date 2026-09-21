// 問題数の直書きを見つけて push を止めるチェッカー。
//
// なぜ要るのか: 問題数や合格点を地の文に数字で書くと、JavaScript が一度も書き換えないため、
// 次の回で問題数を変えた瞬間に画面の中で数字が食い違う。第1回・第2回で実際に起きた。
// 正しい書きかたは quiz-data.js の件数から導くこと（例: `全${QUIZ.length}問`、
// 合格点は `Math.ceil(QUIZ.length * 0.8)`）。
//
// 手元で試すとき:  node .github/check_counts.mjs
// チェッカー自身の動作確認:  node .github/check_counts.mjs --selftest

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// 地の文に焼き付いた数字。${QUIZ.length} など式で書いてあるものは \d+ に当たらないので素通りする。
const PATTERNS = [
  { re: /全\s*\d+\s*問/g,                 why: '見出し・修了証の「全N問」' },
  { re: /\d+\s*問中\s*\d+\s*問/g,          why: '注意書き・修了証の「N問中M問」' },
  { re: /\d+\s*\/\s*\d+\s*問回答/g,        why: '進捗表示の初期値「0 / N 問回答済み」' },
  { re: /得点：\s*\d+\s*\/\s*\d+/g,        why: '得点表示の初期値「得点：0 / N」' },
];

function findIndexFiles(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    if (name.startsWith('.')) continue;
    const dir = root === "." ? name : join(root, name);
    if (!statSync(dir).isDirectory()) continue;
    const f = join(dir, 'index.html');
    try { if (statSync(f).isFile()) out.push(f); } catch { /* index.html の無いフォルダは対象外 */ }
  }
  return out.sort();
}

function scan(file) {
  const hits = [];
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    for (const { re, why } of PATTERNS) {
      re.lastIndex = 0;
      const m = re.exec(line);
      if (m) hits.push({ file, line: i + 1, text: line.trim().slice(0, 120), found: m[0], why });
    }
  });
  return hits;
}

if (process.argv.includes('--selftest')) {
  const bad = ['<p>Interactive Quiz · 基本問題 全5問</p>',
               '<p class="notice">1問1点。5問中4問以上正解で合格です。</p>',
               '<span id="quiz-progress">0 / 5 問回答済み</span>',
               '<strong id="quiz-score">得点：0 / 5 点</strong>'];
  const good = ['<p>Interactive Quiz · 基本問題 <span id="quiz-total"></span></p>',
                '<p class="notice" id="quiz-rule"></p>',
                '<p class="intro">全${QUIZ.length}問に回答し、合格基準を達成しました。</p>',
                '<div><dt>得点</dt><dd>${QUIZ.length}問中${score}問正解</dd></div>',
                'document.getElementById("quiz-score").textContent = `得点：${score} / ${QUIZ.length} 点`;'];
  const fires = s => PATTERNS.some(({ re }) => { re.lastIndex = 0; return re.test(s); });
  const missed = bad.filter(s => !fires(s));
  const falsePos = good.filter(s => fires(s));
  console.log(`selftest: 悪い例 ${bad.length} 件中 ${bad.length - missed.length} 件を検出 / 良い例 ${good.length} 件中 ${falsePos.length} 件を誤検出`);
  for (const s of missed)   console.error('  見逃し:', s);
  for (const s of falsePos) console.error('  誤検出:', s);
  process.exit(missed.length || falsePos.length ? 1 : 0);
}

const files = findIndexFiles(".");
// 「何も見つからなかった」と「そもそも何も見ていない」を混同しないこと。
if (files.length === 0) {
  console.error('NG: index.html が 1 つも見つかりません。フォルダ名を変えた場合はこのチェッカーも直してください。');
  process.exit(1);
}
const hits = files.flatMap(scan);
console.log(`検査: ${files.length} ファイル（${files.join(', ')}）`);
if (hits.length === 0) {
  console.log('OK: 問題数の直書きはありません。');
  process.exit(0);
}
console.error(`NG: 問題数の直書きが ${hits.length} 箇所あります。`);
for (const h of hits) console.error(`  ${h.file}:${h.line}  「${h.found}」 ${h.why}\n      ${h.text}`);
console.error('\n直しかた: 数字を消して id を付け、quiz-data.js の件数から JavaScript で書き込んでください。');
console.error('  例）<span id="quiz-total"></span> に `全${QUIZ.length}問` を入れる');
console.error('      合格点は Math.ceil(QUIZ.length * 0.8)');
process.exit(1);
