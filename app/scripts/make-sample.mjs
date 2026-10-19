// Generates public/data-sample/ (contract-compliant hand-written sample).
// Entries, simple tenses and the febles guide are written by hand below;
// compound tenses, index.json and manifest.json are derived so they stay consistent.
// Usage: node scripts/make-sample.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data-sample');
mkdirSync(OUT, { recursive: true });

// Same as CONTRATOS.md §1 and src/lib/norm.ts
const norm = (s) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[·.]/g, '').replace(/\s+/g, ' ').trim();

const E = (o) => o;
const entries = [
  E({ id: 'ser', ca: 'ser', pos: 'verb', zh: ['是'], pinyin: ['shì'], en: ['to be'], es: ['ser', 'estar'], ex: { ca: 'Sóc estudiant de català.', zh: '我是学加泰罗尼亚语的学生。', en: 'I am a Catalan student.' }, freq: 2, verb: { conj: 'irregular' } }),
  E({ id: 'i', ca: 'i', pos: 'conj', zh: ['和'], pinyin: ['hé'], en: ['and'], es: ['y'], ex: { ca: 'Pa i aigua, si us plau.', zh: '请给我面包和水。', en: 'Bread and water, please.' }, freq: 3 }),
  E({ id: 'no', ca: 'no', pos: 'adv', zh: ['不', '没有'], pinyin: ['bù', 'méi yǒu'], en: ['no', 'not'], es: ['no'], ex: { ca: 'No tinc temps.', zh: '我没有时间。', en: "I don't have time." }, freq: 5 }),
  E({ id: 'tenir', ca: 'tenir', pos: 'verb', zh: ['有'], pinyin: ['yǒu'], en: ['to have'], es: ['tener'], ex: { ca: 'Tinc un gos.', zh: '我有一只狗。', en: 'I have a dog.' }, freq: 8, verb: { conj: 'irregular' } }),
  E({ id: 'anar', ca: 'anar', pos: 'verb', zh: ['去'], pinyin: ['qù'], en: ['to go'], es: ['ir'], ex: { ca: "Vaig a l'escola.", zh: '我去学校。', en: "I'm going to school." }, freq: 10, verb: { conj: 'irregular' } }),
  E({ id: 'amb', ca: 'amb', pos: 'prep', zh: ['和', '用'], pinyin: ['hé', 'yòng'], en: ['with'], es: ['con'], ex: { ca: 'Vaig amb la meva amiga.', zh: '我和我的朋友一起去。', en: "I'm going with my friend." }, freq: 12 }),
  E({ id: 'molt', ca: 'molt', pos: 'adv', zh: ['很', '非常'], pinyin: ['hěn', 'fēi cháng'], en: ['very', 'a lot'], es: ['muy', 'mucho'], ex: { ca: 'Fa molt de fred.', zh: '天很冷。', en: "It's very cold." }, freq: 18 }),
  E({ id: 'com', ca: 'com', pos: 'adv', zh: ['怎么', '怎样'], pinyin: ['zěn me', 'zěn yàng'], en: ['how', 'like'], es: ['cómo', 'como'], ex: { ca: 'Com et dius?', zh: '你叫什么名字？', en: "What's your name?" }, freq: 20 }),
  E({ id: 'jo', ca: 'jo', pos: 'pron', zh: ['我'], pinyin: ['wǒ'], en: ['I', 'me'], es: ['yo'], ex: { ca: 'Jo sóc de Xangai.', zh: '我是上海人。', en: "I'm from Shanghai." }, freq: 22 }),
  E({ id: 'què', ca: 'què', pos: 'pron', zh: ['什么'], pinyin: ['shén me'], en: ['what'], es: ['qué'], ex: { ca: 'Què vols?', zh: '你想要什么？', en: 'What do you want?' }, freq: 25 }),
  E({ id: 'voler', ca: 'voler', pos: 'verb', zh: ['想要', '要'], pinyin: ['xiǎng yào', 'yào'], en: ['to want'], es: ['querer'], ex: { ca: 'Vull un cafè.', zh: '我要一杯咖啡。', en: 'I want a coffee.' }, freq: 30, verb: { conj: 'irregular' } }),
  E({ id: 'on', ca: 'on', pos: 'adv', zh: ['哪里'], pinyin: ['nǎ lǐ'], en: ['where'], es: ['dónde', 'donde'], ex: { ca: 'On és el lavabo?', zh: '洗手间在哪里？', en: 'Where is the toilet?' }, freq: 35 }),
  E({ id: 'quan', ca: 'quan', pos: 'adv', zh: ['什么时候'], pinyin: ['shén me shí hou'], en: ['when'], es: ['cuándo', 'cuando'], ex: { ca: 'Quan comença la classe?', zh: '什么时候上课？', en: 'When does the class start?' }, freq: 38 }),
  E({ id: 'tu', ca: 'tu', pos: 'pron', zh: ['你'], pinyin: ['nǐ'], en: ['you'], es: ['tú'], ex: { ca: 'I tu, com estàs?', zh: '你呢，你好吗？', en: 'And you, how are you?' }, freq: 40 }),
  E({ id: 'sí', ca: 'sí', pos: 'adv', zh: ['是', '对'], pinyin: ['shì', 'duì'], en: ['yes'], es: ['sí'], ex: { ca: 'Sí, parlo una mica de català.', zh: '是的，我会说一点加泰罗尼亚语。', en: 'Yes, I speak a little Catalan.' }, freq: 42 }),
  E({ id: 'dia', ca: 'dia', pos: 'noun', gender: 'm', plural: 'dies', zh: ['天', '白天'], pinyin: ['tiān', 'bái tiān'], en: ['day'], es: ['día'], ex: { ca: 'Bon dia!', zh: '早上好！', en: 'Good morning!' }, freq: 45 }),
  E({ id: 'casa', ca: 'casa', pos: 'noun', gender: 'f', plural: 'cases', zh: ['家', '房子'], pinyin: ['jiā', 'fáng zi'], en: ['house', 'home'], es: ['casa'], ex: { ca: 'La meva casa és petita.', zh: '我的房子很小。', en: 'My house is small.' }, freq: 50 }),
  E({ id: 'temps', ca: 'temps', pos: 'noun', gender: 'm', plural: 'temps', zh: ['时间', '天气'], pinyin: ['shí jiān', 'tiān qì'], en: ['time', 'weather'], es: ['tiempo'], ex: { ca: 'Quin temps fa avui?', zh: '今天天气怎么样？', en: "What's the weather like today?" }, freq: 55 }),
  E({ id: 'gran', ca: 'gran', pos: 'adj', gender: 'mf', plural: 'grans', zh: ['大'], pinyin: ['dà'], en: ['big', 'large'], es: ['grande'], ex: { ca: 'És una ciutat gran.', zh: '这是一个大城市。', en: "It's a big city." }, freq: 60 }),
  E({ id: 'bo', ca: 'bo', pos: 'adj', gender: 'm', fem: 'bona', plural: 'bons', zh: ['好', '好吃'], pinyin: ['hǎo', 'hǎo chī'], en: ['good', 'tasty'], es: ['bueno'], ex: { ca: 'Aquest pa és molt bo.', zh: '这个面包很好吃。', en: 'This bread is very good.' }, freq: 65 }),
  E({ id: 'avui', ca: 'avui', pos: 'adv', zh: ['今天'], pinyin: ['jīn tiān'], en: ['today'], es: ['hoy'], ex: { ca: 'Avui fa sol.', zh: '今天是晴天。', en: "It's sunny today." }, freq: 70 }),
  E({ id: 'amic', ca: 'amic', pos: 'noun', gender: 'm', fem: 'amiga', plural: 'amics', zh: ['朋友'], pinyin: ['péng you'], en: ['friend'], es: ['amigo'], ex: { ca: 'És el meu amic.', zh: '他是我的朋友。', en: "He's my friend." }, freq: 80 }),
  E({ id: 'parlar', ca: 'parlar', pos: 'verb', zh: ['说', '说话'], pinyin: ['shuō', 'shuō huà'], en: ['to speak', 'to talk'], es: ['hablar'], ex: { ca: 'Parles català?', zh: '你会说加泰罗尼亚语吗？', en: 'Do you speak Catalan?' }, freq: 90, verb: { conj: '1a' } }),
  E({ id: 'petit', ca: 'petit', pos: 'adj', gender: 'm', fem: 'petita', plural: 'petits', zh: ['小'], pinyin: ['xiǎo'], en: ['small', 'little'], es: ['pequeño'], ex: { ca: 'Tinc un pis petit.', zh: '我有一套小公寓。', en: 'I have a small flat.' }, freq: 95 }),
  E({ id: 'nit', ca: 'nit', pos: 'noun', gender: 'f', plural: 'nits', zh: ['晚上', '夜晚'], pinyin: ['wǎn shang', 'yè wǎn'], en: ['night', 'evening'], es: ['noche'], ex: { ca: 'Bona nit!', zh: '晚安！', en: 'Good night!' }, freq: 100 }),
  E({ id: 'menjar', ca: 'menjar', pos: 'verb', zh: ['吃'], pinyin: ['chī'], en: ['to eat'], es: ['comer'], ex: { ca: 'Mengem a casa.', zh: '我们在家吃饭。', en: 'We eat at home.' }, freq: 120, verb: { conj: '1a' } }),
  E({ id: 'menjar#2', ca: 'menjar', pos: 'noun', gender: 'm', plural: 'menjars', zh: ['食物', '饭菜'], pinyin: ['shí wù', 'fàn cài'], en: ['food', 'meal'], es: ['comida'], ex: { ca: 'El menjar és molt bo.', zh: '饭菜很好吃。', en: 'The food is very good.' }, freq: 400 }),
  E({ id: 'carrer', ca: 'carrer', pos: 'noun', gender: 'm', plural: 'carrers', zh: ['街道', '街'], pinyin: ['jiē dào', 'jiē'], en: ['street'], es: ['calle'], ex: { ca: 'Visc en aquest carrer.', zh: '我住在这条街上。', en: 'I live on this street.' }, freq: 130 }),
  E({ id: 'aigua', ca: 'aigua', pos: 'noun', gender: 'f', plural: 'aigües', zh: ['水'], pinyin: ['shuǐ'], en: ['water'], es: ['agua'], ex: { ca: 'Vull aigua, si us plau.', zh: '请给我水。', en: 'I want water, please.' }, freq: 140 }),
  E({ id: 'demà', ca: 'demà', pos: 'adv', zh: ['明天'], pinyin: ['míng tiān'], en: ['tomorrow'], es: ['mañana'], ex: { ca: 'Fins demà!', zh: '明天见！', en: 'See you tomorrow!' }, freq: 150 }),
  E({ id: 'dos', ca: 'dos', pos: 'num', zh: ['二', '两'], pinyin: ['èr', 'liǎng'], en: ['two'], es: ['dos'], ex: { ca: 'Tinc dos gats.', zh: '我有两只猫。', en: 'I have two cats.' }, freq: 160 }),
  E({ id: 'llibre', ca: 'llibre', pos: 'noun', gender: 'm', plural: 'llibres', zh: ['书'], pinyin: ['shū'], en: ['book'], es: ['libro'], ex: { ca: 'Llegeixo un llibre.', zh: '我在看书。', en: "I'm reading a book." }, freq: 170 }),
  E({ id: 'escola', ca: 'escola', pos: 'noun', gender: 'f', plural: 'escoles', zh: ['学校'], pinyin: ['xué xiào'], en: ['school'], es: ['escuela'], ex: { ca: "L'escola és a prop.", zh: '学校就在附近。', en: 'The school is nearby.' }, freq: 180 }),
  E({ id: 'català', ca: 'català', pos: 'adj', gender: 'm', fem: 'catalana', plural: 'catalans', zh: ['加泰罗尼亚语', '加泰罗尼亚的'], pinyin: ['jiā tài luó ní yà yǔ', 'jiā tài luó ní yà de'], en: ['Catalan'], es: ['catalán'], ex: { ca: 'Estudio català al CPNL.', zh: '我在CPNL学加泰罗尼亚语。', en: 'I study Catalan at the CPNL.' }, freq: 190 }),
  E({ id: 'ahir', ca: 'ahir', pos: 'adv', zh: ['昨天'], pinyin: ['zuó tiān'], en: ['yesterday'], es: ['ayer'], ex: { ca: 'Ahir vaig anar al mercat.', zh: '昨天我去了市场。', en: 'Yesterday I went to the market.' }, freq: 200 }),
  E({ id: 'nen', ca: 'nen', pos: 'noun', gender: 'm', fem: 'nena', plural: 'nens', zh: ['男孩', '孩子'], pinyin: ['nán hái', 'hái zi'], en: ['boy', 'child'], es: ['niño'], ex: { ca: 'El nen juga al parc.', zh: '男孩在公园里玩。', en: 'The boy is playing in the park.' }, freq: 210 }),
  E({ id: 'nena', ca: 'nena', pos: 'noun', gender: 'f', plural: 'nenes', zh: ['女孩'], pinyin: ['nǚ hái'], en: ['girl'], es: ['niña'], ex: { ca: 'La nena té cinc anys.', zh: '这个女孩五岁。', en: 'The girl is five years old.' }, freq: 215 }),
  E({ id: 'gràcies', ca: 'gràcies', pos: 'intj', zh: ['谢谢'], pinyin: ['xiè xie'], en: ['thank you', 'thanks'], es: ['gracias'], ex: { ca: 'Moltes gràcies!', zh: '非常感谢！', en: 'Thank you very much!' }, freq: 220 }),
  E({ id: 'hola', ca: 'hola', pos: 'intj', zh: ['你好'], pinyin: ['nǐ hǎo'], en: ['hello', 'hi'], es: ['hola'], ex: { ca: 'Hola, com estàs?', zh: '你好，你怎么样？', en: 'Hi, how are you?' }, freq: 230 }),
  E({ id: 'xinès', ca: 'xinès', pos: 'adj', gender: 'm', fem: 'xinesa', plural: 'xinesos', zh: ['中文', '中国的'], pinyin: ['zhōng wén', 'zhōng guó de'], en: ['Chinese'], es: ['chino'], ex: { ca: 'Parlo xinès i anglès.', zh: '我会说中文和英语。', en: 'I speak Chinese and English.' }, freq: 240 }),
  E({ id: 'mercat', ca: 'mercat', pos: 'noun', gender: 'm', plural: 'mercats', zh: ['市场', '菜市场'], pinyin: ['shì chǎng', 'cài shì chǎng'], en: ['market'], es: ['mercado'], ex: { ca: 'El mercat obre a les vuit.', zh: '市场八点开门。', en: 'The market opens at eight.' }, freq: 250 }),
  E({ id: 'cafè', ca: 'cafè', pos: 'noun', gender: 'm', plural: 'cafès', zh: ['咖啡', '咖啡馆'], pinyin: ['kā fēi', 'kā fēi guǎn'], en: ['coffee', 'café'], es: ['café'], ex: { ca: 'Un cafè amb llet, si us plau.', zh: '请来一杯加奶的咖啡。', en: 'A white coffee, please.' }, freq: 260 }),
  E({ id: 'pa', ca: 'pa', pos: 'noun', gender: 'm', plural: 'pans', zh: ['面包'], pinyin: ['miàn bāo'], en: ['bread'], es: ['pan'], ex: { ca: 'Compro pa al forn.', zh: '我在面包店买面包。', en: 'I buy bread at the bakery.' }, freq: 270 }),
  E({ id: 'llet', ca: 'llet', pos: 'noun', gender: 'f', plural: 'llets', zh: ['牛奶'], pinyin: ['niú nǎi'], en: ['milk'], es: ['leche'], ex: { ca: 'Vull llet, si us plau.', zh: '请给我牛奶。', en: 'I want milk, please.' }, freq: 280 }),
  E({ id: 'adéu', ca: 'adéu', pos: 'intj', zh: ['再见'], pinyin: ['zài jiàn'], en: ['goodbye', 'bye'], es: ['adiós'], ex: { ca: 'Adéu, fins demà!', zh: '再见，明天见！', en: 'Bye, see you tomorrow!' }, freq: 290 }),
  E({ id: 'si us plau', ca: 'si us plau', pos: 'phrase', zh: ['请'], pinyin: ['qǐng'], en: ['please'], es: ['por favor'], ex: { ca: 'Un cafè, si us plau.', zh: '请给我一杯咖啡。', en: 'A coffee, please.' }, freq: 300 }),
  E({ id: 'col·legi', ca: 'col·legi', pos: 'noun', gender: 'm', plural: 'col·legis', zh: ['学校', '中小学'], pinyin: ['xué xiào', 'zhōng xiǎo xué'], en: ['school (primary or secondary)'], es: ['colegio'], ex: { ca: 'Els nens van al col·legi.', zh: '孩子们去上学。', en: 'The children go to school.' }, freq: 350 }),
  E({ id: 'metro', ca: 'metro', pos: 'noun', gender: 'm', plural: 'metros', zh: ['地铁'], pinyin: ['dì tiě'], en: ['metro', 'subway'], es: ['metro'], ex: { ca: 'Agafo el metro cada dia.', zh: '我每天坐地铁。', en: 'I take the metro every day.' }, freq: 420 }),
  E({ id: 'sortida', ca: 'sortida', pos: 'noun', gender: 'f', plural: 'sortides', zh: ['出口'], pinyin: ['chū kǒu'], en: ['exit', 'way out'], es: ['salida'], ex: { ca: 'On és la sortida?', zh: '出口在哪里？', en: 'Where is the exit?' }, freq: 450 }),
  E({ id: 'obert', ca: 'obert', pos: 'adj', gender: 'm', fem: 'oberta', plural: 'oberts', zh: ['开着的', '营业中'], pinyin: ['kāi zhe de', 'yíng yè zhōng'], en: ['open'], es: ['abierto'], ex: { ca: 'La botiga és oberta.', zh: '商店开着。', en: 'The shop is open.' }, freq: 480 }),
  E({ id: 'tancat', ca: 'tancat', pos: 'adj', gender: 'm', fem: 'tancada', plural: 'tancats', zh: ['关着的', '关门'], pinyin: ['guān zhe de', 'guān mén'], en: ['closed'], es: ['cerrado'], ex: { ca: 'Diumenge és tancat.', zh: '星期天关门。', en: 'It is closed on Sunday.' }, freq: 500 }),
];

// ---- Conjugation: simple tenses by hand; compounds = haver + participle ----
const S = (pres, imperf, pret, fut, cond, subjPres, subjImperf, imp, np) => ({
  'ind.pres': pres, 'ind.imperf': imperf, 'ind.pret': pret, 'ind.fut': fut, 'cond.pres': cond,
  'subj.pres': subjPres, 'subj.imperf': subjImperf, imp, np,
});
const w = (s) => s.split(' ');
const simple = {
  ser: S(w('sóc ets és som sou són'), w('era eres era érem éreu eren'), w('fui fores fou fórem fóreu foren'),
    w('seré seràs serà serem sereu seran'), w('seria series seria seríem seríeu serien'),
    w('sigui siguis sigui siguem sigueu siguin'), w('fos fossis fos fóssim fóssiu fossin'),
    ['', 'sigues', 'sigui', 'siguem', 'sigueu', 'siguin'], w('ser sent estat estada estats estades')),
  tenir: S(w('tinc tens té tenim teniu tenen'), w('tenia tenies tenia teníem teníeu tenien'),
    w('tinguí tingueres tingué tinguérem tinguéreu tingueren'), w('tindré tindràs tindrà tindrem tindreu tindran'),
    w('tindria tindries tindria tindríem tindríeu tindrien'), w('tingui tinguis tingui tinguem tingueu tinguin'),
    w('tingués tinguessis tingués tinguéssim tinguéssiu tinguessin'),
    ['', 'tingues', 'tingui', 'tinguem', 'tingueu', 'tinguin'], w('tenir tenint tingut tinguda tinguts tingudes')),
  anar: S(w('vaig vas va anem aneu van'), w('anava anaves anava anàvem anàveu anaven'),
    w('aní anares anà anàrem anàreu anaren'), w('aniré aniràs anirà anirem anireu aniran'),
    w('aniria aniries aniria aniríem aniríeu anirien'), w('vagi vagis vagi anem aneu vagin'),
    w('anés anessis anés anéssim anéssiu anessin'),
    ['', 'vés', 'vagi', 'anem', 'aneu', 'vagin'], w('anar anant anat anada anats anades')),
  menjar: S(w('menjo menges menja mengem mengeu mengen'), w('menjava menjaves menjava menjàvem menjàveu menjaven'),
    w('mengí menjares menjà menjàrem menjàreu menjaren'), w('menjaré menjaràs menjarà menjarem menjareu menjaran'),
    w('menjaria menjaries menjaria menjaríem menjaríeu menjarien'), w('mengi mengis mengi mengem mengeu mengin'),
    w('mengés mengessis mengés mengéssim mengéssiu mengessin'),
    ['', 'menja', 'mengi', 'mengem', 'mengeu', 'mengin'], w('menjar menjant menjat menjada menjats menjades')),
  parlar: S(w('parlo parles parla parlem parleu parlen'), w('parlava parlaves parlava parlàvem parlàveu parlaven'),
    w('parlí parlares parlà parlàrem parlàreu parlaren'), w('parlaré parlaràs parlarà parlarem parlareu parlaran'),
    w('parlaria parlaries parlaria parlaríem parlaríeu parlarien'), w('parli parlis parli parlem parleu parlin'),
    w('parlés parlessis parlés parléssim parléssiu parlessin'),
    ['', 'parla', 'parli', 'parlem', 'parleu', 'parlin'], w('parlar parlant parlat parlada parlats parlades')),
};
const AUX = {
  'ind.perf': w('he has ha hem heu han'),
  'ind.plusq': w('havia havies havia havíem havíeu havien'),
  'ind.fut_perf': w('hauré hauràs haurà haurem haureu hauran'),
  'cond.perf': w('hauria hauries hauria hauríem hauríeu haurien'),
  'subj.perf': w('hagi hagis hagi hàgim hàgiu hagin'),
  'subj.plusq': w('hagués haguessis hagués haguéssim haguéssiu haguessin'),
};
const PERIF = w('vaig vas va vam vau van');
const conj = {};
for (const [id, t] of Object.entries(simple)) {
  const part = t.np[2], inf = t.np[0];
  const c = { ...t };
  for (const [tense, aux] of Object.entries(AUX)) c[tense] = aux.map((a) => `${a} ${part}`);
  c['ind.pret_perif'] = PERIF.map((a) => `${a} ${inf}`);
  conj[id] = c;
}

// ---- index.json ----
const P = ['1s', '2s', '3s', '1p', '2p', '3p'];
const SIMPLE_TENSES = ['ind.pres', 'ind.imperf', 'ind.pret', 'ind.fut', 'cond.pres', 'subj.pres', 'subj.imperf', 'imp'];
const index = { forms: {}, zh: {}, es: {}, en: {} };
const add = (map, key, val) => {
  if (!key) return;
  const list = (map[key] ??= []);
  if (!list.some((v) => JSON.stringify(v) === JSON.stringify(val))) list.push(val);
};
for (const e of entries) {
  add(index.forms, norm(e.ca), [e.id, 'lemma']);
  e.zh.forEach((z) => add(index.zh, z.trim(), e.id));
  e.es.forEach((x) => add(index.es, norm(x), e.id));
  e.en.forEach((x) => add(index.en, norm(x), e.id));
}
for (const [id, c] of Object.entries(conj)) {
  for (const tense of SIMPLE_TENSES) c[tense].forEach((f, i) => f && add(index.forms, norm(f), [id, `${tense}.${P[i]}`]));
  add(index.forms, norm(c.np[1]), [id, 'np.ger']);
  c.np.slice(2).forEach((f) => add(index.forms, norm(f), [id, 'np.part']));
}

// ---- febles.json (minimal; Arnau should review) ----
const febles = {
  sections: [
    {
      id: 'cd', title_en: 'Direct object pronouns', title_zh: '直接宾语代词',
      body_en: 'They replace the **direct object** (who/what). They go **before** a conjugated verb and **after** an infinitive, gerund or imperative (joined with a hyphen or apostrophe).',
      body_zh: '代替**直接宾语**（谁／什么）。放在变位动词**前面**；放在不定式、副动词或命令式**后面**（用连字符或撇号连接）。',
      table: {
        head: ['', 'before verb 动词前', 'after verb 动词后'],
        rows: [
          ['me 我', "em · m'", "-me · 'm"], ['you 你', "et · t'", "-te · 't"],
          ['him / it (m) 他/它', "el · l'", "-lo · 'l"], ['her / it (f) 她/它', "la · l'", '-la'],
          ['us 我们', 'ens', "-nos · 'ns"], ['you (pl.) 你们', 'us', '-vos · -us'],
          ['them (m) 他们', 'els', "-los · 'ls"], ['them (f) 她们', 'les', '-les'],
        ],
      },
      examples: [
        { ca: 'El veig cada dia.', zh: '我每天都见到他。', en: 'I see him every day.' },
        { ca: 'Vull veure-la.', zh: '我想见她。', en: 'I want to see her.' },
        { ca: "L'estimo.", zh: '我爱他／她。', en: 'I love him / her.' },
      ],
    },
    {
      id: 'en-hi', title_en: '«En» and «hi»', title_zh: '«en» 和 «hi»',
      body_en: '- **en** replaces a quantity or *de* + noun: «Tens pa? Sí, **en** tinc.»\n- **hi** replaces a place (*a*, *en* + place): «Vas a Girona? Sí, **hi** vaig.»',
      body_zh: '- **en** 代替数量或 *de* + 名词：«Tens pa? Sí, **en** tinc.»\n- **hi** 代替地点（*a*、*en* + 地点）：«Vas a Girona? Sí, **hi** vaig.»',
      examples: [
        { ca: 'Tens germans? Sí, en tinc dos.', zh: '你有兄弟姐妹吗？有，我有两个。', en: 'Do you have siblings? Yes, I have two.' },
        { ca: "Vas a l'escola? Sí, hi vaig.", zh: '你去学校吗？是的，我去。', en: 'Are you going to school? Yes, I am going (there).' },
      ],
    },
    {
      id: 'ho', title_en: '«Ho»: this, that, it', title_zh: '«ho»：这个、那个',
      body_en: '**ho** replaces a whole idea or *això* / *allò* (neutral «it»).',
      body_zh: '**ho** 代替一整句话的意思，或 *això* / *allò*（中性的"这／那"）。',
      examples: [
        { ca: 'No ho sé.', zh: '我不知道。', en: "I don't know (it)." },
        { ca: 'Ho entens?', zh: '你明白吗？', en: 'Do you understand (it)?' },
      ],
    },
  ],
};

// ---- write ----
const files = { 'entries.json': entries, 'index.json': index, 'conj.json': conj, 'febles.json': febles };
const list = [];
for (const [name, data] of Object.entries(files)) {
  const buf = Buffer.from(JSON.stringify(data), 'utf8');
  writeFileSync(join(OUT, name), buf);
  list.push({ name, bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') });
}
const manifest = {
  version: 'sample-2026-10-17.1',
  counts: { entries: entries.length, forms: Object.keys(index.forms).length },
  files: list,
};
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`data-sample: ${entries.length} entries, ${Object.keys(index.forms).length} forms, ${Object.keys(conj).length} verbs`);
