"""Create Waraq's original sample EPUB and small, dependency-free PNG icons."""
from pathlib import Path
import struct
import zlib
import zipfile
from html import escape

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'

def icon(size):
    rows = bytearray()
    for y in range(size):
        rows.append(0)
        for x in range(size):
            u, v = x / size, y / size
            color = (82, 106, 80)
            if .23 < u < .77 and .27 < v < .73:
                color = (247, 245, 232)
            if .485 < u < .515 and .29 < v < .76:
                color = (82, 106, 80)
            if (.29 < u < .43 or .57 < u < .71) and any(a < v < a + .012 for a in [.39, .46, .53, .60]):
                color = (147, 160, 132)
            rows.extend(color)
    def chunk(name, data):
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b'')

chapters = [
    ('نافذة إلى العربية', [
        'في صباح هادئ، فتح سامر نافذة غرفته، ووضع كتابًا صغيرًا على الطاولة. كان يحب القراءة، ولكنه لم يكن يعرف كل الكلمات التي يراها. قال لنفسه: لا أحتاج إلى فهم كل شيء اليوم. أستطيع أن أقرأ صفحة واحدة، وأن أتعلّم منها كلمة جديدة.',
        'جلس قرب النافذة وبدأ يقرأ. كانت القصة عن مسافر يبحث عن مكتبة قديمة في مدينة بعيدة. توقّف سامر عند كلمة «يستكشف». نظر إلى حروفها، ثم بحث عن معناها. وجد أن للكلمة صلة بالكشف والبحث، وأنها تصف عملًا يقوم به المسافر في رحلته.',
        'كتب الكلمة في دفتره، ثم عاد إلى الجملة. هذه المرة، لم تعد الكلمة غريبة. أصبحت جزءًا من صورة واضحة: رجل يسير في شوارع لا يعرفها، ينظر إلى الأبواب، ويسأل الناس عن الطريق.',
        'لم يحاول سامر أن يحفظ صفحة من القاموس. أراد فقط أن يفهم ما يحدث في القصة. كلما عاد إلى الكتاب، وجد أن السياق يساعده، وأن الكلمات التي تعلّمها أمس تظهر أمامه من جديد.',
        'خارج النافذة، كانت الشمس ترتفع ببطء. شرب سامر قليلًا من الشاي، وأكمل القراءة. لم يقرأ كثيرًا في ذلك الصباح، لكنه شعر أن المسافة بينه وبين اللغة أصبحت أقصر.',
    ]),
    ('كلمة تفتح بابًا', [
        'في اليوم التالي، قرأ سامر جملة قصيرة: «كتب الطالب رسالة». كانت الحروف مألوفة، لكن صديقه سأله: هل تستطيع أن تقرأ كلمة «كتب» بطريقة أخرى؟ فكّر سامر قليلًا، ثم قال: نعم، قد تكون «كَتَبَ»، وقد تكون «كُتُب».',
        'ابتسم صديقه وقال: الحروف وحدها لا تخبرنا بكل شيء. ننظر إلى الجملة، وإلى الكلمات التي تسبق الكلمة والتي تأتي بعدها. في هذه الجملة، لدينا طالب ورسالة، ولذلك نبحث عن فعل يربط بينهما.',
        'فتح سامر القاموس ووجد كلمات أخرى من الجذر نفسه: كتاب، وكاتب، ومكتبة. كانت بينها علاقة، لكن لكل كلمة معناها الخاص. ليست المكتبة كتابًا كبيرًا، وليست كل كلمة من الجذر نفسه بديلًا عن الأخرى.',
        'أعجبه هذا الاكتشاف. شعر أن تعلّم العربية يشبه السير في مدينة. قد تتصل شوارع كثيرة بساحة واحدة، لكن كل شارع يأخذك إلى مكان مختلف. معرفة الجذر تساعدك على رؤية الصلة، ثم يأتي دور القاموس والسياق.',
        'عاد إلى الرسالة في القصة. كان الطالب يكتب إلى أخيه عن حياته في الجامعة. وصف له غرفته الصغيرة، وأصدقاءه الجدد، والكتب التي يقرأها. فجأة، لم يعد سامر يفكر في القواعد وحدها. أراد أن يعرف ماذا سيقول الطالب بعد ذلك.',
    ]),
    ('قليل كل يوم', [
        'بعد أسبوع، صار سامر يحمل كتابه معه إلى المقهى. يقرأ بضع صفحات، ثم يتوقف حين يحتاج إلى الراحة. بعض الكلمات يفتحها في القاموس، وبعضها يفهمه من السياق، وبعضها يتركه لوقت آخر.',
        'سألته صديقته عن طريقته، فقال: أحاول أن أختار نصًا يثير فضولي. عندما أهتم بالقصة، يكون الرجوع إلى القاموس جزءًا من القراءة، لا واجبًا منفصلًا عنها. وأحاول أن أعود إلى النص نفسه بعد أيام.',
        'قالت: وهل تفهم كل التفاصيل الآن؟ قال: لا. ما زلت أجد جملًا صعبة، وأحيانًا أختار معنى لا يناسب السياق. لكنني أستطيع أن ألاحظ الخطأ، وأن أبحث مرة أخرى. هذا أيضًا نوع من التعلّم.',
        'في ذلك المساء، أغلق الكتاب عند نهاية الفصل، ووضع علامة على الصفحة. كان يعرف أنه سيعود إليها غدًا. نظر إلى دفتره، فرأى كلمات كثيرة لم تكن مألوفة قبل أسبوع، وأصبحت الآن مرتبطة بأشخاص وأماكن وأحداث.',
        'لم تنته الرحلة عند آخر صفحة. على الرف كتب أخرى، وفي العالم أصوات وحكايات تنتظر من يسمعها. اختار سامر كتابًا جديدًا، وكتب في أول صفحة من دفتره: قليل كل يوم، وكثير مع الوقت.',
    ]),
]

def main():
    PUBLIC.mkdir(exist_ok=True)
    for size in (192, 512):
        (PUBLIC / f'icon-{size}.png').write_bytes(icon(size))
    with zipfile.ZipFile(PUBLIC / 'sample.epub', 'w', zipfile.ZIP_DEFLATED) as book:
        book.writestr('mimetype', 'application/epub+zip', compress_type=zipfile.ZIP_STORED)
        book.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        items = ''.join(f'<item id="ch{i}" href="chapter{i}.xhtml" media-type="application/xhtml+xml"/>' for i in range(3))
        spine = ''.join(f'<itemref idref="ch{i}"/>' for i in range(3))
        book.writestr('EPUB/package.opf', f'''<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">urn:waraq:sample:1</dc:identifier><dc:title>نافذة إلى العربية</dc:title><dc:creator>Waraq · An original sample</dc:creator><dc:language>ar</dc:language><dc:rights>CC0 1.0 — original Waraq sample text.</dc:rights><meta property="dcterms:modified">2026-10-24T00:00:00Z</meta></metadata><manifest>{items}<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="cover" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/></manifest><spine page-progression-direction="rtl">{spine}</spine></package>''')
        nav = ''.join(f'<li><a href="chapter{i}.xhtml">{escape(title)}</a></li>' for i, (title, _) in enumerate(chapters))
        book.writestr('EPUB/nav.xhtml', f'<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ar" dir="rtl"><head><title>المحتويات</title></head><body><nav epub:type="toc"><h1>المحتويات</h1><ol>{nav}</ol></nav></body></html>')
        book.writestr('EPUB/cover.svg', '''<svg xmlns="http://www.w3.org/2000/svg" width="400" height="600" viewBox="0 0 400 600"><rect width="400" height="600" fill="#566b52"/><rect x="25" y="25" width="350" height="550" rx="1" fill="none" stroke="#e8e4ce" opacity=".35"/><path d="M90 230 Q200 80 310 230 V440 H90Z" fill="#e5e0c5" opacity=".12"/><path d="M120 250 Q200 130 280 250 V440 H120Z" fill="none" stroke="#e8e4ce" opacity=".35"/><text x="200" y="290" text-anchor="middle" font-family="serif" font-size="35" fill="#f3edd7">نافذة إلى العربية</text><text x="200" y="350" text-anchor="middle" font-family="serif" font-size="14" letter-spacing="3" fill="#dbdcc7">A WINDOW TO ARABIC</text><text x="200" y="530" text-anchor="middle" font-family="serif" font-size="13" letter-spacing="4" fill="#dbdcc7">WARAQ</text></svg>''')
        for i, (title, paragraphs) in enumerate(chapters):
            body = ''.join(f'<p>{escape(p)}</p>' for p in paragraphs)
            book.writestr(f'EPUB/chapter{i}.xhtml', f'<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="ar" lang="ar" dir="rtl"><head><title>{escape(title)}</title><style>body{{font-family:serif;line-height:2;text-align:justify}}h1{{font-size:1.4em;font-weight:normal;margin:1em 0}}p{{margin:0 0 1em}}</style></head><body><h1>{escape(title)}</h1>{body}</body></html>')
    print('Sample EPUB and icons ready.')

if __name__ == '__main__':
    main()
