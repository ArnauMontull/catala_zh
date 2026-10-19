"""7. Escribe app/public/data/febles.json: guía de pronombres débiles para nivel A1.

Contenido redactado a mano (no sale de ninguna fuente descargada).
PENDIENTE DE REVISIÓN POR ARNAU (catalán central, ortografía IEC 2017).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA, dump  # noqa: E402

S = []


def sec(id, title_en, title_zh, body_en, body_zh, examples, table=None):
    d = {"id": id, "title_en": title_en, "title_zh": title_zh, "body_en": body_en.strip(),
         "body_zh": body_zh.strip(), "examples": [dict(ca=c, zh=z, en=e) for c, z, e in examples]}
    if table:
        d["table"] = {"head": table[0], "rows": table[1]}
    S.append(d)


sec("intro", "What are weak pronouns?", "什么是弱代词（pronoms febles）？",
    """
Catalan has small, unstressed pronouns that stick to the verb: **em, et, es, ens, us, el, la, els, les, li, ho, en, hi**.
They replace a noun you already mentioned, so you don't repeat it.

- *Veus **el gos**? — Sí, **el** veig.* (el = the dog)
- They never stand alone: they always go **right before** or **right after** a verb.
- Spanish has some of them (*me, te, se, lo, la, le*), but Catalan also has **en** and **hi**, which Spanish doesn't have.
""",
    """
加泰罗尼亚语有一组很短、不重读、紧贴动词的代词：**em, et, es, ens, us, el, la, els, les, li, ho, en, hi**。
它们用来代替前面已经说过的名词，避免重复。

- *Veus **el gos**? — Sí, **el** veig.*（el = 那只狗）
- 它们不能单独使用，总是紧挨在动词**前面**或**后面**。
- 西班牙语里也有类似的（*me, te, se, lo, la, le*），但加泰罗尼亚语还有 **en** 和 **hi**，西班牙语没有。
""",
    [("Veus el gos? Sí, el veig.", "你看见那只狗了吗？看见了。", "Do you see the dog? Yes, I see it."),
     ("Coneixes la Marta? Sí, la conec.", "你认识玛尔塔吗？认识。", "Do you know Marta? Yes, I know her."),
     ("Vols cafè? No, gràcies, no en vull.", "你要咖啡吗？不用了，谢谢。", "Do you want coffee? No thanks, I don't want any."),
     ("Vas a Girona? Sí, hi vaig demà.", "你去赫罗纳吗？对，我明天去。", "Are you going to Girona? Yes, I'm going there tomorrow.")])

sec("who", "Which pronoun replaces what?", "每个代词代替什么？",
    """
| Pronoun | Replaces | Like English |
|---|---|---|
| **em / et / es / ens / us** | me, you, himself/herself, us, you (pl.) | me, you, oneself… |
| **el, la, els, les** | a *definite* direct object (*el llibre, la casa*) | it, him, her, them |
| **li / els** | an indirect object: the person who receives (*a la Maria*) | to him, to her, to them |
| **ho** | a whole idea, or *això, allò* | it, that |
| **en** | an amount or an indefinite object (*pa, dues pomes*), or *de + something* | some, any, of it |
| **hi** | a place (*a Barcelona, a casa*), and in **hi ha** | there |
""",
    """
| 代词 | 代替什么 | 相当于 |
|---|---|---|
| **em / et / es / ens / us** | 我、你、他/她自己、我们、你们 | me, you… |
| **el, la, els, les** | 有定的直接宾语（*el llibre* 这本书，*la casa* 这个房子） | 它、他、她、他们 |
| **li / els** | 间接宾语：接受东西的人（*a la Maria* 给玛丽亚） | 给他/她/他们 |
| **ho** | 一整件事、一个想法，或 *això, allò*（这、那） | 这件事 |
| **en** | 数量、不定的东西（*pa* 面包、*dues pomes* 两个苹果），或 *de + 某物* | 一些、其中的 |
| **hi** | 地点（*a Barcelona, a casa*），以及固定说法 **hi ha**（有） | 那里 |
""",
    [("Dono el llibre a la Maria. → Li dono el llibre.", "我把书给玛丽亚。→ 我把书给她。", "I give the book to Maria. → I give her the book."),
     ("No sé això. → No ho sé.", "我不知道这个。→ 我不知道。", "I don't know that. → I don't know."),
     ("Tens germans? Sí, en tinc dos.", "你有兄弟姐妹吗？有，我有两个。", "Do you have siblings? Yes, I have two."),
     ("Vius a Barcelona? Sí, hi visc.", "你住在巴塞罗那吗？对，我住在那里。", "Do you live in Barcelona? Yes, I live there."),
     ("Hi ha un bar a prop?", "附近有酒吧吗？", "Is there a bar nearby?")])

sec("forms", "The four shapes of each pronoun", "每个代词的四种形式",
    """
Each pronoun changes shape depending on **where** it goes and **what sound** is next to it:

- **Before** the verb: the *reinforced* form before a consonant (**el** veig), the *elided* form with an apostrophe before a vowel or *h* (**l'**escolto).
- **After** the verb (joined with a hyphen or an apostrophe): the *full* form after a consonant or *-u* (menjar-**lo**), the *reduced* form after a vowel (menja**'l**).

Don't memorise the whole table at once: start with **el / la / els / les** and **em / et**.
""",
    """
每个代词的形式会根据它的**位置**和旁边的**发音**而改变：

- 在动词**前面**：动词以辅音开头时用*强化形式*（**el** veig）；以元音或 *h* 开头时用*省略形式*，加撇号（**l'**escolto）。
- 在动词**后面**（用连字符或撇号连接）：动词以辅音或 *-u* 结尾时用*完整形式*（menjar-**lo**）；以元音结尾时用*缩减形式*（menja**'l**）。

不用一次背完整张表：先学 **el / la / els / les** 和 **em / et**。
""",
    [("El veig. / L'escolto.", "我看见他。/ 我听他说。", "I see him. / I listen to him."),
     ("Vull menjar-lo.", "我想吃它。", "I want to eat it."),
     ("Menja'l!", "把它吃了！", "Eat it!"),
     ("M'agrada. / Em diu hola.", "我喜欢。/ 他跟我说你好。", "I like it. / He says hello to me.")],
    table=(["", "before + consonant", "before + vowel/h", "after consonant / -u", "after vowel"],
           [["1s (me)", "em", "m'", "-me", "'m"],
            ["2s (you)", "et", "t'", "-te", "'t"],
            ["3 reflexive", "es", "s'", "-se", "'s"],
            ["1p (us)", "ens", "ens", "-nos", "'ns"],
            ["2p (you pl.)", "us", "us", "-vos", "-us"],
            ["direct m. (him/it)", "el", "l'", "-lo", "'l"],
            ["direct f. (her/it)", "la", "l'", "-la", "-la"],
            ["direct m. pl.", "els", "els", "-los", "'ls"],
            ["direct f. pl.", "les", "les", "-les", "-les"],
            ["indirect sg. (to him/her)", "li", "li", "-li", "-li"],
            ["indirect pl. (to them)", "els", "els", "-los", "'ls"],
            ["neuter (it/that)", "ho", "ho", "-ho", "-ho"],
            ["en (some/of it)", "en", "n'", "-ne", "'n"],
            ["hi (there)", "hi", "hi", "-hi", "-hi"]]))

sec("position", "Before or after the verb?", "放在动词前面还是后面？",
    """
- **Before** a normal conjugated verb: ***La** compro.* (I buy it.)
- **After** an **infinitive** (*-ar, -er, -re, -ir*), a **gerund** (*-ant, -ent, -int*) or an **imperative**: *Vull comprar-**la**.* / *Compra-**la**!*
- With **two verbs** (*vull + infinitive, puc, vaig a…*) you can choose: ***La** vull comprar* = *Vull comprar-**la***. Both are correct.
- With **no**, the pronoun stays before the conjugated verb: *No **el** veig.*
""",
    """
- 在普通的变位动词**前面**：***La** compro.*（我买它。）
- 在**不定式**（*-ar, -er, -re, -ir*）、**副动词**（*-ant, -ent, -int*）或**命令式**的**后面**：*Vull comprar-**la**.* / *Compra-**la**!*
- 有**两个动词**时（*vull + 不定式、puc、vaig a…*）两种位置都可以：***La** vull comprar* = *Vull comprar-**la***。
- 有否定词 **no** 时，代词仍在变位动词前面：*No **el** veig.*
""",
    [("La compro.", "我买它。", "I buy it."),
     ("Vull comprar-la. = La vull comprar.", "我想买它。", "I want to buy it."),
     ("Compra-la!", "买下它吧！", "Buy it!"),
     ("No el veig.", "我看不见他。", "I can't see him."),
     ("Estic mirant-te.", "我正在看着你。", "I'm looking at you.")])

sec("reflexive", "Reflexive verbs: em dic, et dius…", "自反动词：em dic, et dius…",
    """
Many everyday verbs carry a pronoun that refers back to the subject. In the dictionary they end in **-se**: *dir-se* (to be called), *llevar-se* (to get up), *dutxar-se* (to shower).

| | dir-se |
|---|---|
| jo | **em** dic |
| tu | **et** dius |
| ell / ella | **es** diu |
| nosaltres | **ens** diem |
| vosaltres | **us** dieu |
| ells / elles | **es** diuen |
""",
    """
很多日常动词带一个指回主语的代词。在词典里它们以 **-se** 结尾：*dir-se*（名叫）、*llevar-se*（起床）、*dutxar-se*（洗澡）。

| | dir-se |
|---|---|
| jo 我 | **em** dic |
| tu 你 | **et** dius |
| ell / ella 他/她 | **es** diu |
| nosaltres 我们 | **ens** diem |
| vosaltres 你们 | **us** dieu |
| ells / elles 他们 | **es** diuen |
""",
    [("Com et dius? Em dic Mei.", "你叫什么名字？我叫梅。", "What's your name? My name is Mei."),
     ("Em llevo a les set.", "我七点起床。", "I get up at seven."),
     ("Ens veiem demà!", "明天见！", "See you tomorrow!"),
     ("Ella es dutxa al matí.", "她早上洗澡。", "She showers in the morning.")])

sec("combos", "Two pronouns together", "两个代词连用",
    """
Sometimes you need two pronouns: *give **it** to **me***. Order: **em / et / ens / us** (or **es**) first, then **el / la / ho / en**.
Before the verb, *em, et, es* become **me, te, se**:

- em + el → **me'l** · em + la → **me la** · em + ho → **m'ho** · em + en → **me'n**
- es + en → **se'n** (*Se'n va.* He's leaving.)
- **li** + el → **l'hi** · li + la → **la hi** · li + ho → **li ho** (in speech it often sounds like *l'hi*)
- **hi ha** + en → **n'hi ha** (there are some)

Very common fixed phrases: *me'n vaig* (I'm leaving), *n'hi ha prou* (that's enough), *m'ho dius?* (will you tell me?).
""",
    """
有时需要两个代词：*把**它**给**我***。顺序是：先 **em / et / ens / us**（或 **es**），再 **el / la / ho / en**。
在动词前面，*em, et, es* 变成 **me, te, se**：

- em + el → **me'l** · em + la → **me la** · em + ho → **m'ho** · em + en → **me'n**
- es + en → **se'n**（*Se'n va.* 他要走了。）
- **li** + el → **l'hi** · li + la → **la hi** · li + ho → **li ho**（口语里常常听起来像 *l'hi*）
- **hi ha** + en → **n'hi ha**（有一些）

非常常用的固定说法：*me'n vaig*（我走了）、*n'hi ha prou*（够了）、*m'ho dius?*（你告诉我好吗？）。
""",
    [("Me'l dones?", "你把它给我好吗？", "Will you give it to me?"),
     ("Te la deixo.", "我把它借给你。", "I'll lend it to you."),
     ("Li ho explico.", "我跟他解释这件事。", "I'll explain it to him."),
     ("Hi ha pa? Sí, n'hi ha.", "有面包吗？有。", "Is there bread? Yes, there is some."),
     ("Ja me'n vaig.", "我这就走了。", "I'm leaving now.")])

sec("phrases", "Phrases to learn by heart", "要背下来的常用句",
    """
These everyday phrases all contain a weak pronoun. Learn them as one block; the grammar will make sense later.
""",
    """
下面这些日常用语都含有弱代词。先整句背下来，语法以后自然就懂了。
""",
    [("No ho sé.", "我不知道。", "I don't know."),
     ("Ho sento.", "对不起。/ 很抱歉。", "I'm sorry."),
     ("T'estimo.", "我爱你。", "I love you."),
     ("M'agrada molt.", "我很喜欢。", "I like it a lot."),
     ("Tens pomes? Sí, quantes en vols?", "你有苹果吗？有，你要几个？", "Do you have apples? Yes, how many do you want?")])


def main() -> None:
    out = DATA / "febles.json"
    dump({"sections": S}, out, pretty=True)
    print(f"febles.json: {len(S)} secciones -> {out}")


if __name__ == "__main__":
    main()
