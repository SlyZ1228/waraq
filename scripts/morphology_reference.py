"""Create deterministic parity fixtures from the independent Python implementation."""
from pathlib import Path
import json
import random
import sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from server import app
from camel_tools.morphology.database import MorphologyDB
from camel_tools.morphology.analyzer import Analyzer

random.seed(714)
db=MorphologyDB(str(ROOT/'.data/camel_morph_msa_v1.0.db'))
app.analyzer=Analyzer(db)
words=['كتب','كُتُب','كَتَبَ','كتاب','الكتاب','وَبِكِتَابِهِ','استغفر','يستغفرون','مكتبة','مدرسة','الشمس','للشمس','قال','يقول','قلت','دعا','يدعو','رمى','يرمي','شدّ','مدّ','مسؤول','مسئول','إيمان','آمن','فتى','كتاباً','كتابًا','رجال','بيوت','هذه','الذي','في','من','يا','هو','هم','والمدارس','سأكتب','فسيكتبون','أفبالحق','أعطيتكموها','لاشيءهنا','ٱلكِتَاب','قُرْآن','مُحَمَّد','العربية']
for stem in random.sample([k for k in db.stem_hash if k!='NOAN'],360):
    words.append(stem)
    if len(words)%3==0:words.append(db.stem_hash[stem][0][1]['diac'])
    if len(words)%5==0:words.append('وال'+stem)
fixtures=[{'word':word,'expected':app.analyze_word(word)} for word in dict.fromkeys(words)
          if app.re.fullmatch('[\u0621-\u063a\u0641-\u064a\u0671\u064b-\u065f\u0670\u0640]+',word)]
(ROOT/'.data/morphology-parity.json').write_text(json.dumps(fixtures,ensure_ascii=False),encoding='utf-8')
print(f'{len(fixtures)} reference words; {sum(bool(x["expected"]["total"]) for x in fixtures)} with analyses.')
