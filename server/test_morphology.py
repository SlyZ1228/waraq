"""Integration tests against the real downloaded CAMeL Morph database."""
import pytest
from fastapi import HTTPException
from server import app as service

@pytest.fixture(scope='module', autouse=True)
def engine():
    from camel_tools.morphology.analyzer import Analyzer
    from camel_tools.morphology.database import MorphologyDB
    path = service.DATA / 'camel_morph_msa_v1.0.db'
    assert path.exists(), 'Run scripts/prepare_data.py before the integration tests.'
    service.analyzer = Analyzer(MorphologyDB(str(path)))
    service.analyze_word.cache_clear()

def test_ambiguous_unvowelled_word_keeps_noun_and_verb():
    result = service.analyze(service.AnalyzeRequest(surface='كتب'))
    assert {'noun', 'verb'}.issubset({a['features']['pos'] for a in result['analyses']})
    assert result['total'] > 1

def test_supplied_vowels_are_preserved():
    result = service.analyze(service.AnalyzeRequest(surface='كَتَبَ'))
    assert result['analyses']
    assert all(service.compatible_vowels('كَتَبَ', a['diac']) for a in result['analyses'])
    assert all(a['features']['pos'] == 'verb' for a in result['analyses'])
    assert not service.compatible_vowels('كَتَبَ', 'كُتُبٌ')

def test_form_ten_root_and_grammar_are_real_analyzer_fields():
    result = service.analyze(service.AnalyzeRequest(surface='يستكشف'))
    reading = next(a for a in result['analyses'] if a['diac'] == 'يَسْتَكْشِفُ')
    assert reading['root'] == 'ك ش ف'
    assert reading['features']['mod'] == 'i'
    assert reading['features']['per'] == '3'
    assert 'explore' in reading['gloss']
    assert 'سْتَ' in reading['pattern']

def test_attached_particles_preserve_lemma_and_root():
    result = service.analyze(service.AnalyzeRequest(surface='وبالكتاب'))
    readings = [a for a in result['analyses'] if a['root'] == 'ك ت ب']
    assert readings
    assert any(a['features'].get('prc2') == 'wa_conj' and a['features'].get('prc1') == 'bi_prep' for a in readings)

@pytest.mark.parametrize('surface', ['two words', 'كتاب مدرسة', '<script>', '123'])
def test_rejects_non_word_requests(surface):
    with pytest.raises(HTTPException) as error:
        service.analyze(service.AnalyzeRequest(surface=surface))
    assert error.value.status_code == 422
